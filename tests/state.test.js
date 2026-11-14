import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, defaultState } from '../js/state.js';

const teams = { teamA: { tor:'p1', sturm:'p2' }, teamB: { tor:'p3', sturm:'p4' } };
function stateWith(history){
  return Object.assign(defaultState(), { history });
}

test('entries without a status count as "no result" and get the mixed flags', () => {
  const s = normalizeState(stateWith([{ id:'a', timestamp:1, ...teams }]));
  assert.equal(s.history[0].status, 'noResult');
  assert.equal(s.history[0].score, null);
  assert.equal(s.history[0].winner, null);
  assert.deepEqual(s.history[0].mixed, { teamA:false, teamB:false });
});

test('only the newest running match stays running', () => {
  const s = normalizeState(stateWith([
    { id:'old', timestamp:1, status:'running', score:{ teamA:2, teamB:1 }, ...teams },
    { id:'new', timestamp:2, status:'running', ...teams }
  ]));
  const byId = Object.fromEntries(s.history.map(h => [h.id, h]));
  assert.equal(byId.old.status, 'noResult');
  assert.equal(byId.old.score, null);
  assert.equal(byId.new.status, 'running');
  assert.deepEqual(byId.new.score, { teamA:0, teamB:0 });
});

test('the winner of a scored match is derived from its score', () => {
  const s = normalizeState(stateWith([
    { id:'a', timestamp:1, status:'scored', score:{ teamA:3, teamB:10 }, winner:'teamA', ...teams },
    { id:'b', timestamp:2, status:'scored', score:{ teamA:5, teamB:5 }, ...teams },
    { id:'c', timestamp:3, status:'scored', ...teams }
  ]));
  assert.equal(s.history[0].winner, 'teamB');
  assert.equal(s.history[1].winner, 'draw');
  assert.equal(s.history[2].status, 'noResult');
});
