import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  START_RATING, K_FACTOR, scoredMatches, periodFilter, expectedScore, marginFactor,
  computeRatings, winProbability, ratingChange, pairKey, computeStats,
  winRate, form, currentStreak, longestRun, bestAndWorst
} from '../js/stats.js';

const DAY = 24 * 60 * 60 * 1000;
let n = 0;
// A scored match; later calls are newer unless a timestamp is given
function match(aTor, aSturm, bTor, bSturm, goalsA, goalsB, extra = {}){
  n++;
  return Object.assign({
    id: 'm' + n,
    sessionId: 's1',
    timestamp: n * 1000,
    status: 'scored',
    score: { teamA:goalsA, teamB:goalsB },
    mixed: { teamA:false, teamB:false },
    teamA: { tor:aTor, sturm:aSturm },
    teamB: { tor:bTor, sturm:bSturm }
  }, extra);
}
const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, msg || `${actual} ≠ ${expected}`);

test('only scored matches count, oldest first', () => {
  const history = [
    match('a','b','c','d', 5, 3, { timestamp:300 }),
    match('a','b','c','d', 0, 0, { timestamp:200, status:'running' }),
    match('a','b','c','d', 0, 0, { timestamp:150, status:'noResult', score:null }),
    match('a','b','c','d', 2, 2, { timestamp:100 })
  ];
  assert.deepEqual(scoredMatches(history).map(h => h.timestamp), [100, 300]);
  assert.equal(computeRatings(history).players.get('a').games, 2);
});

test('period filters', () => {
  const now = 400 * DAY;
  const at = (days, sessionId = 'old') => ({ timestamp: now - days * DAY, sessionId });
  const inside = (key, h) => periodFilter(key, { now, sessionId:'s1' })(h);
  assert.equal(inside('1w', at(6)), true);
  assert.equal(inside('1w', at(8)), false);
  assert.equal(inside('4w', at(27)), true);
  assert.equal(inside('4w', at(29)), false);
  assert.equal(inside('3m', at(90)), true);
  assert.equal(inside('6m', at(184)), false);
  assert.equal(inside('1y', at(364)), true);
  assert.equal(inside('1y', at(366)), false);
  assert.equal(inside('all', at(399)), true);
  // 'today' is the current session, whatever the clock says
  assert.equal(inside('today', at(0)), false);
  assert.equal(inside('today', at(3, 's1')), true);
});

test('expected score and margin factor', () => {
  near(expectedScore(1000, 1000), 0.5);
  near(expectedScore(1400, 1000) + expectedScore(1000, 1400), 1);
  assert.ok(expectedScore(1400, 1000) > 0.9);
  assert.equal(marginFactor(0), 1);
  assert.equal(marginFactor(1), 1);
  near(marginFactor(3), 1.3);
  assert.equal(marginFactor(10), 1.75);
});

test('a win between equal teams moves everyone by the same amount', () => {
  const { players } = computeRatings([match('a','b','c','d', 6, 5)]);
  const delta = K_FACTOR * 0.5;
  near(players.get('a').overall, START_RATING + delta);
  near(players.get('b').overall, START_RATING + delta);
  near(players.get('c').overall, START_RATING - delta);
  near(players.get('d').overall, START_RATING - delta);
  assert.deepEqual(players.get('a').timeline.map(e => e.matchId).length, 1);
  near(players.get('a').timeline[0].delta, delta);
});

test('rating changes sum to zero in every match', () => {
  const history = [
    match('a','b','c','d', 10, 2), match('a','c','b','d', 3, 10), match('d','a','e','b', 7, 7),
    match('e','c','a','b', 10, 9, { mixed:{ teamA:true, teamB:false } }), match('b','d','c','e', 0, 10)
  ];
  const { players, pairs } = computeRatings(history);
  const sum = key => [...players.values()].reduce((s, p) => s + p[key], 0);
  near(sum('overall'), players.size * START_RATING);
  near([...pairs.values()].reduce((s, p) => s + p.rating, 0), pairs.size * START_RATING);
  history.forEach(m => {
    const deltas = [...players.values()].flatMap(p => p.timeline.filter(e => e.matchId === m.id).map(e => e.delta));
    assert.equal(deltas.length, 4);
    near(deltas.reduce((s, d) => s + d, 0), 0);
  });
});

test('a draw between equal teams changes nothing, a clear win counts more', () => {
  const draw = computeRatings([match('a','b','c','d', 4, 4)]);
  near(draw.players.get('a').overall, START_RATING);
  const narrow = computeRatings([match('a','b','c','d', 10, 9)]).players.get('a').overall;
  const clear = computeRatings([match('a','b','c','d', 10, 5)]).players.get('a').overall;
  assert.ok(clear > narrow);
  near(clear - START_RATING, K_FACTOR * 1.6 * 0.5);
});

test('beating a stronger team gains more than beating a weaker one', () => {
  const warmup = [match('a','b','c','d', 10, 0), match('a','b','c','d', 10, 0)];
  const before = computeRatings(warmup).players;
  const upset = computeRatings([...warmup, match('c','d','a','b', 6, 5)]).players;
  const expected = computeRatings([...warmup, match('a','b','c','d', 6, 5)]).players;
  const gainUnderdog = upset.get('c').overall - before.get('c').overall;
  const gainFavourite = expected.get('a').overall - before.get('a').overall;
  assert.ok(gainUnderdog > K_FACTOR * 0.5);
  assert.ok(gainFavourite < K_FACTOR * 0.5);
});

test('position ratings only move for teams with fixed positions', () => {
  const { players } = computeRatings([match('a','b','c','d', 6, 5, { mixed:{ teamA:true, teamB:false } })]);
  const a = players.get('a'), c = players.get('c'), d = players.get('d');
  assert.equal(a.tor, START_RATING);
  assert.equal(a.sturm, START_RATING);
  assert.equal(a.gamesTor + a.gamesSturm, 0);
  assert.ok(a.overall > START_RATING);
  // Team B kept its positions: goalie's Tor and striker's Sturm rating drop
  assert.ok(c.tor < START_RATING);
  assert.equal(c.sturm, START_RATING);
  assert.ok(d.sturm < START_RATING);
  assert.equal(d.tor, START_RATING);
  assert.equal(c.gamesTor, 1);
  assert.equal(d.gamesSturm, 1);
});

test('pair ratings follow the pair, whoever stands in goal', () => {
  const { pairs } = computeRatings([match('a','b','c','d', 6, 5), match('b','a','d','c', 6, 5)]);
  assert.equal(pairs.size, 2);
  const ab = pairs.get(pairKey('b','a'));
  assert.equal(ab.games, 2);
  assert.deepEqual(ab.ids, ['a','b']);
  assert.ok(ab.rating > START_RATING);
});

test('win probability comes from the overall ratings', () => {
  const ratings = computeRatings([match('a','b','c','d', 10, 0), match('a','b','c','d', 10, 0)]);
  near(winProbability(['x','y'], ['v','w'], ratings), 0.5);
  const p = winProbability(['a','b'], ['c','d'], ratings);
  assert.ok(p > 0.5 && p < 1);
  near(p + winProbability(['c','d'], ['a','b'], ratings), 1);
  // One strong and one unknown player against two unknowns
  assert.ok(winProbability(['a','x'], ['y','z'], ratings) > 0.5);
});

test('rating change within a set of matches', () => {
  const history = [match('a','b','c','d', 6, 5), match('a','b','c','d', 5, 6), match('a','b','c','d', 6, 5)];
  const a = computeRatings(history).players.get('a');
  near(ratingChange(a, new Set(history.map(m => m.id))), a.overall - START_RATING);
  near(ratingChange(a, new Set([history[2].id])), a.timeline[2].delta);
  assert.equal(ratingChange(a, new Set()), 0);
  assert.equal(ratingChange(undefined, new Set(['m1'])), 0);
});

test('totals, table sides and records', () => {
  const big = match('a','b','c','d', 10, 0);
  const wild = match('a','c','b','d', 9, 10);
  const { totals, sides, records } = computeStats([big, wild, match('a','d','b','c', 3, 3), match('c','d','a','b', 0, 2)]);
  assert.deepEqual(totals, { matches:4, goals:37, draws:1, avgGoals:9.25 });
  assert.deepEqual(sides, { teamA:1, draw:1, teamB:2 });
  assert.equal(records.biggestWin.match, big);
  assert.equal(records.biggestWin.diff, 10);
  assert.equal(records.mostGoals.match, wild);
  assert.equal(records.cleanSheets, 2);
});

test('per-player records, positions, partners and opponents', () => {
  const { players, records } = computeStats([
    match('a','b','c','d', 10, 4),
    match('a','c','b','d', 10, 6),
    match('b','a','c','d', 2, 10, { mixed:{ teamA:true, teamB:false } }),
    match('d','a','b','c', 5, 5)
  ]);
  const a = players.get('a');
  assert.deepEqual([a.games, a.w, a.d, a.l], [4, 2, 1, 1]);
  assert.deepEqual([a.goalsFor, a.goalsAgainst], [27, 25]);
  assert.equal(winRate(a), 0.5);
  assert.deepEqual([a.byPos.tor.games, a.byPos.tor.w, a.byPos.tor.goalsAgainst], [2, 2, 10]);
  assert.deepEqual([a.byPos.sturm.games, a.byPos.sturm.d], [1, 1]);
  assert.deepEqual([a.byPos.mixed.games, a.byPos.mixed.l], [1, 1]);
  assert.deepEqual(a.results, ['w','w','l','d']);
  assert.deepEqual([a.partners.get('b').games, a.partners.get('b').w, a.partners.get('b').l], [2, 1, 1]);
  assert.deepEqual([a.opponents.get('d').games, a.opponents.get('d').w, a.opponents.get('d').l], [3, 2, 1]);
  assert.equal(a.opponents.has('a'), false);
  assert.deepEqual(records.longestWinStreak, { id:'a', length:2 });
  assert.equal(winRate(undefined), null);
});

test('form and streaks', () => {
  const results = ['l','w','w','d','w','w','w'];
  assert.deepEqual(form(results), ['w','d','w','w','w']);
  assert.deepEqual(currentStreak(results), { result:'w', length:3 });
  assert.deepEqual(currentStreak(['w','l']), { result:'l', length:1 });
  assert.equal(currentStreak([]), null);
  assert.equal(longestRun(results, 'w'), 3);
  assert.equal(longestRun(['l','d'], 'w'), 0);
});

test('best and worst partner need enough matches and known players', () => {
  const rel = new Map([
    ['good', { games:4, w:3, d:1, l:0 }],
    ['bad', { games:3, w:0, d:1, l:2 }],
    ['once', { games:1, w:1, d:0, l:0 }],
    ['gone', { games:5, w:5, d:0, l:0 }]
  ]);
  const { best, worst } = bestAndWorst(rel, id => id !== 'gone');
  assert.equal(best.id, 'good');
  assert.equal(worst.id, 'bad');
  assert.deepEqual(bestAndWorst(new Map([['once', { games:1, w:1, d:0, l:0 }]])), { best:null, worst:null });
  assert.equal(bestAndWorst(new Map([['only', { games:2, w:1, d:0, l:1 }]])).worst, null);
});
