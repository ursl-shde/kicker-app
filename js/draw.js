/* ---------- Draw logic ----------
   Pure: everything a draw depends on is passed in. `rnd` is the random source
   (a function returning 0 ≤ x < 1), replaceable in tests. */
import { sessionRoundCount, pairTeammateCount, positionStreak } from './history.js';

export function opposite(pos){ return pos==='tor' ? 'sturm' : 'tor'; }

export function shuffle(arr, rnd=Math.random){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(rnd()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
export function weightedPick(items, weights, rnd=Math.random){
  const total = weights.reduce((s,w)=>s+w,0);
  let r = rnd()*total;
  for(let i=0;i<items.length;i++){
    r -= weights[i];
    if(r<=0) return items[i];
  }
  return items[items.length-1];
}

export function pickFour(present, history, sessionId, rnd=Math.random){
  const withCounts = present.map(id=>({id, count: sessionRoundCount(history, sessionId, id)}));
  const shuffled = shuffle(withCounts, rnd);
  shuffled.sort((a,b)=>a.count-b.count);
  return {
    selected: shuffled.slice(0,4).map(c=>c.id),
    waiting: shuffled.slice(4).map(c=>c.id)
  };
}
export function splitIntoTeams(fourIds, history, rnd=Math.random){
  const [a,b,c,d] = fourIds;
  const splits = [ [[a,b],[c,d]], [[a,c],[b,d]], [[a,d],[b,c]] ];
  const weights = splits.map(([t1,t2]) => 1 / (1 + pairTeammateCount(history,t1[0],t1[1]) + pairTeammateCount(history,t2[0],t2[1])));
  const chosen = weightedPick(splits, weights, rnd);
  return rnd() < 0.5 ? chosen : [chosen[1], chosen[0]];
}
export function assignPositions(pair, history, limit, rnd=Math.random){
  const [p1,p2] = pair;
  const s1 = positionStreak(history, p1), s2 = positionStreak(history, p2);
  const forced1 = (s1 && s1.streak >= limit) ? opposite(s1.position) : null;
  const forced2 = (s2 && s2.streak >= limit) ? opposite(s2.position) : null;
  let pos1, pos2;
  if(forced1 && forced2){
    if(forced1 !== forced2){ pos1=forced1; pos2=forced2; }
    else if(s1.streak >= s2.streak){ pos1=forced1; pos2=opposite(forced1); }
    else { pos2=forced2; pos1=opposite(forced2); }
  } else if(forced1){ pos1=forced1; pos2=opposite(forced1); }
  else if(forced2){ pos2=forced2; pos1=opposite(forced2); }
  else { pos1 = rnd()<0.5 ? 'tor' : 'sturm'; pos2 = opposite(pos1); }
  return { tor: pos1==='tor'?p1:p2, sturm: pos1==='sturm'?p1:p2 };
}
// present: ids of the players who are here; limit: position streak limit
export function generateRound({ present, history, sessionId, limit }, rnd=Math.random){
  if(present.length < 4) return null;
  const { selected } = pickFour(present, history, sessionId, rnd);
  const [pairA, pairB] = splitIntoTeams(selected, history, rnd);
  return {
    teamA: assignPositions(pairA, history, limit, rnd),
    teamB: assignPositions(pairB, history, limit, rnd),
    mode: 'draw'
  };
}
