/* ---------- History entries (matches) ----------
   Pure helpers: they only look at the entries passed in, never at app state
   or the DOM, so they can be tested on their own. */

export function entryPlayerIds(h){
  return [h.teamA.tor, h.teamA.sturm, h.teamB.tor, h.teamB.sturm];
}
export function entryHasPlayer(h, id){
  return h.teamA.tor===id || h.teamA.sturm===id || h.teamB.tor===id || h.teamB.sturm===id;
}
export function positionOfPlayerInEntry(h, id){
  if(h.teamA.tor===id) return 'tor';
  if(h.teamA.sturm===id) return 'sturm';
  if(h.teamB.tor===id) return 'tor';
  if(h.teamB.sturm===id) return 'sturm';
  return null;
}
export function teamOfPlayerInEntry(h, id){
  if(h.teamA.tor===id || h.teamA.sturm===id) return 'teamA';
  if(h.teamB.tor===id || h.teamB.sturm===id) return 'teamB';
  return null;
}
export function winnerOf(score){
  if(score.teamA > score.teamB) return 'teamA';
  if(score.teamB > score.teamA) return 'teamB';
  return 'draw';
}
export function setNoResult(h){
  h.status = 'noResult';
  h.score = null;
  h.winner = null;
}
export function newestFirst(history){
  return history.slice().sort((a,b)=>b.timestamp-a.timestamp);
}
export function runningMatch(history){
  return history.find(h=>h.status==='running') || null;
}
export function sessionRoundCount(history, sessionId, id){
  return history.filter(h=>h.sessionId===sessionId && entryHasPlayer(h,id)).length;
}
export function pairTeammateCount(history, idA, idB){
  let count=0;
  history.forEach(h=>{
    const a=[h.teamA.tor,h.teamA.sturm], b=[h.teamB.tor,h.teamB.sturm];
    if((a.includes(idA)&&a.includes(idB)) || (b.includes(idA)&&b.includes(idB))) count++;
  });
  return count;
}
export function positionStreak(history, id){
  // Matches where the player's team mixed positions say nothing about the streak
  const entries = newestFirst(
    history.filter(h=>entryHasPlayer(h,id) && !h.mixed[teamOfPlayerInEntry(h,id)])
  );
  if(!entries.length) return null;
  const lastPos = positionOfPlayerInEntry(entries[0], id);
  let streak=1;
  for(let i=1;i<entries.length;i++){
    if(positionOfPlayerInEntry(entries[i], id)===lastPos) streak++; else break;
  }
  return { position:lastPos, streak };
}
