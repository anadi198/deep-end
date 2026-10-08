/* A home feed for 100,000 users whose follower counts follow a power law: a few accounts with tens of
 * thousands of followers, most with a handful. Push copies each post into every follower's timeline;
 * pull merges the followed accounts' recent posts when a feed is opened; the hybrid pushes for ordinary
 * accounts and pulls only the big ones. */
(function (root) {
  'use strict';
  const BS = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.BackendSims;

  const USERS = 100000, MAX_FOLLOWERS = 50000, SKEW = 0.8, INSERTS_PER_SEC = 20000, DAY = 86400;

  BS.define('fanout', {
    title: 'Fan-out on write, on read, or both',
    blurb: '100,000 users with power-law follower counts: the biggest account has 50,000 followers, most have a few.',
    compare: 'strategy',
    params: [
      { id: 'strategy', label: 'Strategy', type: 'select', value: 'write', options: [
        ['write', 'Push: copy each post to every follower\'s timeline'],
        ['read', 'Pull: merge followed accounts when a feed is opened'],
        ['hybrid', 'Hybrid: push, except for big accounts'],
      ] },
      { id: 'threshold', label: 'An account is "big" from', type: 'range', min: 500, max: 50000, step: 500, value: 10000, unit: 'followers', when: { strategy: 'hybrid' } },
      { id: 'postsPerDay', label: 'Posts per user per day', type: 'range', min: 0.5, max: 10, step: 0.5, value: 2 },
      { id: 'readsPerDay', label: 'Feed loads per user per day', type: 'range', min: 1, max: 100, step: 1, value: 20 },
    ],
    run(p) {
      let edges = 0, pushedEdges = 0, pulledEdges = 0, pulledAuthors = 0, maxFollowers = 0, biggestPushed = 0;
      for (let rank = 0; rank < USERS; rank++) {
        const f = Math.max(1, Math.round(MAX_FOLLOWERS / Math.pow(rank + 1, SKEW)));
        edges += f;
        maxFollowers = Math.max(maxFollowers, f);
        const pulled = p.strategy === 'read' || (p.strategy === 'hybrid' && f >= p.threshold);
        if (pulled) { pulledEdges += f; pulledAuthors++; }
        else { pushedEdges += f; biggestPushed = Math.max(biggestPushed, f); }
      }
      const avgFollowees = edges / USERS;
      const insertsPerDay = (pushedEdges + pulledAuthors) * p.postsPerDay;
      const insertsPerSec = insertsPerDay / DAY;
      // pushed posts are written once per follower; pulled posts are stored once, by their author
      // a feed load reads the precomputed timeline (if anything is pushed) plus each pulled account it follows
      const lookupsPerLoad = (p.strategy === 'read' ? 0 : 1) + pulledEdges / USERS;
      const readsPerSec = (USERS * p.readsPerDay * lookupsPerLoad) / DAY;
      const biggestPost = biggestPushed;
      const deliverSec = biggestPost / INSERTS_PER_SEC;
      const fmt = (x) => Math.round(x).toLocaleString('en');
      return {
        out: { insertsPerSec, lookupsPerLoad, biggestPost, maxFollowers, avgFollowees, readsPerSec },
        stats: [
          { label: 'Writes per second', note: 'timeline inserts, plus pulled posts stored once', value: fmt(insertsPerSec), tone: insertsPerSec > 1000 ? 'warn' : 'good' },
          { label: 'Inserts for one post by the biggest pushed account', value: fmt(biggestPost), tone: biggestPost > 20000 ? 'bad' : biggestPost > 5000 ? 'warn' : 'good' },
          { label: 'Time to deliver that post', value: `${deliverSec.toFixed(deliverSec < 1 ? 2 : 1)} s`, note: `at ${fmt(INSERTS_PER_SEC)} inserts/s`, tone: deliverSec > 1 ? 'warn' : 'good' },
          { label: 'Lookups per feed load', value: lookupsPerLoad.toFixed(1), tone: lookupsPerLoad > 10 ? 'bad' : lookupsPerLoad > 3 ? 'warn' : 'good' },
        ],
        bars: {
          title: 'Work per second, averaged over a day',
          items: [
            { label: 'Writes into timelines', value: Math.round(insertsPerSec) },
            { label: 'Lookups to build feeds', value: Math.round(readsPerSec) },
          ],
        },
        notes: [
          { write: `Reads are one lookup each, but every post is copied once per follower: the biggest account's single post means ${fmt(maxFollowers)} inserts, and most of those timelines are never opened.`,
            read: `Writes are cheap, but every feed load must query about ${avgFollowees.toFixed(0)} followed accounts and merge them, and here feed loads outnumber posts ${(p.readsPerDay / p.postsPerDay).toFixed(0)} to one.`,
            hybrid: `Ordinary accounts are pushed; accounts with ${fmt(p.threshold)}+ followers are merged in at read time. Bursts are capped and a feed load costs only a few lookups.` }[p.strategy],
        ],
      };
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = BS.all.fanout;
})(typeof globalThis !== 'undefined' ? globalThis : this);
