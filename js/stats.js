/* ---------- Statistics engine ----------
   Pure: works on the history entries passed in, never on app state or the DOM.
   Only matches with a saved score ('scored') count. */

export const START_RATING = 1000;
export const K_FACTOR = 32;
// Below these numbers of matches a value says too little to be shown as is
export const MIN_GAMES_RATED = 5;     // overall rating is "vorläufig" before that
export const MIN_GAMES_POSITION = 3;  // Tor / Sturm rating
export const MIN_GAMES_PAIR = 3;      // pair rating
export const MIN_GAMES_RELATION = 2;  // best partner, toughest opponent

const DAY = 24 * 60 * 60 * 1000;
// In the order shown; 'all' is the default and comes first
export const PERIODS = [
  { key:'all', label:'Gesamt' },
  { key:'today', label:'Heute' },
  { key:'1w', label:'1 Woche', days:7 },
  { key:'4w', label:'4 Wochen', days:28 },
  { key:'3m', label:'3 Monate', days:91 },
  { key:'6m', label:'6 Monate', days:183 },
  { key:'1y', label:'1 Jahr', days:365 }
];

export function scoredMatches(history){
  return history
    .filter(h=>h.status==='scored' && h.score)
    .sort((a,b)=>a.timestamp-b.timestamp);
}

// Returns a test for "does this match belong to the period". 'today' means the
// current session, the others reach back a number of days from `now`.
export function periodFilter(key, { now, sessionId }){
  if(key==='today') return h=>h.sessionId===sessionId;
  const period = PERIODS.find(p=>p.key===key);
  if(!period || !period.days) return ()=>true;
  const from = now - period.days * DAY;
  return h=>h.timestamp >= from;
}

/* ---------- Elo ---------- */
export function expectedScore(ratingA, ratingB){
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}
// Clear wins count a little more, capped so a rout doesn't dominate
export function marginFactor(goalDiff){
  if(goalDiff <= 1) return 1;
  return Math.min(1.75, 1 + 0.15 * (goalDiff - 1));
}
export function pairKey(idA, idB){
  return idA < idB ? idA + '|' + idB : idB + '|' + idA;
}
const mean = (a,b)=>(a+b)/2;

// Replays all scored matches in order. Returns
//   players: Map id → { overall, tor, sturm, games, gamesTor, gamesSturm,
//                       timeline: [{ t, matchId, rating, delta }] }
//   pairs:   Map pairKey → { ids, rating, games }
// Team strength is the mean of its two players, and both get the same change.
// Tor and Sturm ratings only move for a team whose positions were not mixed;
// a mixed team enters that calculation with its overall ratings.
export function computeRatings(history){
  const players = new Map();
  const pairs = new Map();
  const P = id=>{
    if(!players.has(id)) players.set(id, {
      overall:START_RATING, tor:START_RATING, sturm:START_RATING,
      games:0, gamesTor:0, gamesSturm:0, timeline:[]
    });
    return players.get(id);
  };
  const pairOf = team=>{
    const key = pairKey(team.tor, team.sturm);
    if(!pairs.has(key)) pairs.set(key, { ids:[team.tor, team.sturm].sort(), rating:START_RATING, games:0 });
    return pairs.get(key);
  };

  scoredMatches(history).forEach(m=>{
    const a = { tor:P(m.teamA.tor), sturm:P(m.teamA.sturm) };
    const b = { tor:P(m.teamB.tor), sturm:P(m.teamB.sturm) };
    const resultA = m.score.teamA > m.score.teamB ? 1 : m.score.teamA < m.score.teamB ? 0 : 0.5;
    const k = K_FACTOR * marginFactor(Math.abs(m.score.teamA - m.score.teamB));
    const change = (ra, rb)=>k * (resultA - expectedScore(ra, rb));

    // All three changes are worked out from the ratings before the match
    const overallDelta = change(mean(a.tor.overall, a.sturm.overall), mean(b.tor.overall, b.sturm.overall));
    const posStrength = (team, mixed)=>mixed
      ? mean(team.tor.overall, team.sturm.overall)
      : mean(team.tor.tor, team.sturm.sturm);
    const posDelta = change(posStrength(a, m.mixed.teamA), posStrength(b, m.mixed.teamB));
    const pairA = pairOf(m.teamA), pairB = pairOf(m.teamB);
    const pairDelta = change(pairA.rating, pairB.rating);

    [[a, 1, m.mixed.teamA], [b, -1, m.mixed.teamB]].forEach(([team, sign, mixed])=>{
      [team.tor, team.sturm].forEach(p=>{
        p.overall += sign * overallDelta;
        p.games++;
        p.timeline.push({ t:m.timestamp, matchId:m.id, rating:p.overall, delta:sign * overallDelta });
      });
      if(!mixed){
        team.tor.tor += sign * posDelta; team.tor.gamesTor++;
        team.sturm.sturm += sign * posDelta; team.sturm.gamesSturm++;
      }
    });
    pairA.rating += pairDelta; pairA.games++;
    pairB.rating -= pairDelta; pairB.games++;
  });
  return { players, pairs };
}

export function overallRating(ratings, id){
  const p = ratings.players.get(id);
  return p ? p.overall : START_RATING;
}
// Chance that team A beats team B, from the players' overall ratings
export function winProbability(teamAIds, teamBIds, ratings){
  const strength = ids=>mean(overallRating(ratings, ids[0]), overallRating(ratings, ids[1]));
  return expectedScore(strength(teamAIds), strength(teamBIds));
}
// How much a player's rating moved through the given matches (a Set of match ids)
export function ratingChange(playerRating, matchIds){
  if(!playerRating) return 0;
  return playerRating.timeline.reduce((sum, e)=>matchIds.has(e.matchId) ? sum + e.delta : sum, 0);
}

/* ---------- Counting statistics ---------- */
const record = ()=>({ games:0, w:0, d:0, l:0, goalsFor:0, goalsAgainst:0 });
function addTo(r, result, goalsFor, goalsAgainst){
  r.games++; r[result]++;
  r.goalsFor += goalsFor; r.goalsAgainst += goalsAgainst;
}

// matches: scored matches, oldest first (e.g. scoredMatches(history).filter(periodFilter(…))).
// Returns totals, per-player records (also by position, partner and opponent),
// wins per table side and a few records.
export function computeStats(matches){
  const totals = { matches:0, goals:0, draws:0, avgGoals:0 };
  const sides = { teamA:0, draw:0, teamB:0 };
  const records = { biggestWin:null, mostGoals:null, cleanSheets:0, longestWinStreak:null };
  const players = new Map();
  const P = id=>{
    if(!players.has(id)) players.set(id, Object.assign(record(), {
      byPos:{ tor:record(), sturm:record(), mixed:record() },
      results:[], partners:new Map(), opponents:new Map()
    }));
    return players.get(id);
  };
  const relation = (map, id)=>{
    if(!map.has(id)) map.set(id, record());
    return map.get(id);
  };

  matches.forEach(m=>{
    const goals = m.score.teamA + m.score.teamB;
    const diff = Math.abs(m.score.teamA - m.score.teamB);
    const winner = m.score.teamA > m.score.teamB ? 'teamA' : m.score.teamB > m.score.teamA ? 'teamB' : 'draw';
    totals.matches++;
    totals.goals += goals;
    sides[winner]++;
    if(winner==='draw') totals.draws++;
    else if(Math.min(m.score.teamA, m.score.teamB)===0) records.cleanSheets++;
    if(winner!=='draw' && (!records.biggestWin || diff > records.biggestWin.diff)) records.biggestWin = { match:m, diff };
    if(!records.mostGoals || goals > records.mostGoals.goals) records.mostGoals = { match:m, goals };

    ['teamA','teamB'].forEach(team=>{
      const other = team==='teamA' ? 'teamB' : 'teamA';
      const result = winner==='draw' ? 'd' : winner===team ? 'w' : 'l';
      const gf = m.score[team], ga = m.score[other];
      ['tor','sturm'].forEach(pos=>{
        const p = P(m[team][pos]);
        addTo(p, result, gf, ga);
        addTo(p.byPos[m.mixed[team] ? 'mixed' : pos], result, gf, ga);
        p.results.push(result);
        addTo(relation(p.partners, m[team][pos==='tor' ? 'sturm' : 'tor']), result, gf, ga);
        [m[other].tor, m[other].sturm].forEach(opp=>addTo(relation(p.opponents, opp), result, gf, ga));
      });
    });
  });

  totals.avgGoals = totals.matches ? totals.goals / totals.matches : 0;
  players.forEach((p, id)=>{
    const length = longestRun(p.results, 'w');
    if(length > 0 && (!records.longestWinStreak || length > records.longestWinStreak.length)){
      records.longestWinStreak = { id, length };
    }
  });
  return { totals, sides, records, players };
}

// Share of matches won, or null without matches
export function winRate(r){
  return r && r.games ? r.w / r.games : null;
}
// The latest results, newest last
export function form(results, n=5){
  return results.slice(-n);
}
// The run the player is currently on: { result:'w'|'d'|'l', length }
export function currentStreak(results){
  if(!results.length) return null;
  const result = results[results.length-1];
  let length = 0;
  for(let i=results.length-1; i>=0 && results[i]===result; i--) length++;
  return { result, length };
}
export function longestRun(results, result){
  let best = 0, run = 0;
  results.forEach(r=>{
    run = r===result ? run + 1 : 0;
    if(run > best) best = run;
  });
  return best;
}
// From a partner or opponent map: the entries with the best and the worst
// record (draws count half), among those with enough matches. `known` limits
// the choice to ids that should be shown.
export function bestAndWorst(relations, known=()=>true, minGames=MIN_GAMES_RELATION){
  const points = r=>(r.w + r.d / 2) / r.games;
  const list = [...relations.entries()]
    .filter(([id, r])=>r.games >= minGames && known(id))
    .map(([id, r])=>({ id, record:r, points:points(r) }))
    .sort((x,y)=>y.points - x.points || y.record.games - x.record.games);
  if(!list.length) return { best:null, worst:null };
  const best = list[0];
  // The worst is the lowest share; among equals the one with more matches
  const worst = list.slice().sort((x,y)=>x.points - y.points || y.record.games - x.record.games)[0];
  return { best, worst: worst.id===best.id ? null : worst };
}
