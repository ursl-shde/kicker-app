import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFour, splitIntoTeams, assignPositions, generateRound } from '../js/draw.js';
import { positionStreak } from '../js/history.js';

let clock = 1000;
// A history entry; later calls are newer
function match(aTor, aSturm, bTor, bSturm, extra = {}){
  return Object.assign({
    id: 'm' + clock,
    sessionId: 's1',
    timestamp: clock++,
    status: 'noResult',
    score: null,
    winner: null,
    mixed: { teamA:false, teamB:false },
    teamA: { tor:aTor, sturm:aSturm },
    teamB: { tor:bTor, sturm:bSturm }
  }, extra);
}
// Random source that returns the given values in order
function seq(...values){
  let i = 0;
  return () => values[i++ % values.length];
}

test('pickFour takes the four players with the fewest rounds in this session', () => {
  const history = [match('p1','p2','p3','p4'), match('p1','p2','p5','p6')];
  const { selected, waiting } = pickFour(['p1','p2','p3','p4','p5','p6'], history, 's1');
  assert.deepEqual(selected.slice().sort(), ['p3','p4','p5','p6']);
  assert.deepEqual(waiting.slice().sort(), ['p1','p2']);
});

test('pickFour ignores rounds from other sessions', () => {
  const history = [
    match('p1','p2','p3','p4', { sessionId:'old' }),
    match('p1','p2','p3','p4', { sessionId:'old' }),
    match('p5','p6','p3','p4')
  ];
  const { selected } = pickFour(['p1','p2','p3','p4','p5','p6'], history, 's1');
  assert.ok(selected.includes('p1') && selected.includes('p2'));
});

test('a pair that often played together is drawn together less often', () => {
  // a+b were teammates 9 times: that split weighs 1/10, the other two 1 each
  const history = Array.from({ length: 9 }, () => match('a','b','x','y'));
  const four = ['a','b','c','d'];
  const together = t => t.some(pair => pair.includes('a') && pair.includes('b'));
  // 0.04 × 2.1 falls inside the first split's weight of 0.1, 0.05 × 2.1 just outside
  assert.equal(together(splitIntoTeams(four, history, seq(0.04, 0))), true);
  assert.equal(together(splitIntoTeams(four, history, seq(0.05, 0))), false);
});

test('a position streak at the limit forces the other position', () => {
  const history = [match('p1','p2','p3','p4'), match('p1','p3','p2','p4'), match('p1','p4','p2','p3')];
  for(const rnd of [() => 0, () => 0.99]){
    assert.deepEqual(assignPositions(['p1','p9'], history, 3, rnd), { tor:'p9', sturm:'p1' });
    assert.deepEqual(assignPositions(['p9','p1'], history, 3, rnd), { tor:'p9', sturm:'p1' });
  }
});

test('below the limit the position is random', () => {
  const history = [match('p1','p2','p3','p4'), match('p1','p3','p2','p4')];
  assert.deepEqual(assignPositions(['p1','p9'], history, 3, () => 0), { tor:'p1', sturm:'p9' });
  assert.deepEqual(assignPositions(['p1','p9'], history, 3, () => 0.99), { tor:'p9', sturm:'p1' });
});

test('if both players are forced to the same position, the longer streak wins', () => {
  const history = [
    match('p1','x','p2','y'), match('p1','x','p2','y'), match('p1','x','p2','y'),
    match('p1','x','z','y')
  ];
  // p1: 4× Tor, p2: 3× Tor – both should go to Sturm, p1 gets it
  assert.deepEqual(assignPositions(['p1','p2'], history, 3), { tor:'p2', sturm:'p1' });
  assert.deepEqual(assignPositions(['p2','p1'], history, 3), { tor:'p2', sturm:'p1' });
});

test('matches with mixed positions do not count for the streak', () => {
  const mixedA = { mixed: { teamA:true, teamB:false } };
  const history = [match('p1','p2','p3','p4', mixedA), match('p1','p2','p3','p4', mixedA)];
  assert.equal(positionStreak(history, 'p1'), null);
  assert.deepEqual(positionStreak(history, 'p3'), { position:'tor', streak:2 });

  const interrupted = [match('p1','a','b','c'), match('a','p1','b','c', mixedA), match('p1','a','b','c')];
  assert.deepEqual(positionStreak(interrupted, 'p1'), { position:'tor', streak:2 });
});

test('generateRound needs four players and uses each of them once', () => {
  assert.equal(generateRound({ present:['p1','p2','p3'], history:[], sessionId:'s1', limit:3 }), null);
  const round = generateRound({ present:['p1','p2','p3','p4'], history:[], sessionId:'s1', limit:3 });
  const ids = [round.teamA.tor, round.teamA.sturm, round.teamB.tor, round.teamB.sturm];
  assert.deepEqual(ids.sort(), ['p1','p2','p3','p4']);
  assert.equal(round.mode, 'draw');
});
