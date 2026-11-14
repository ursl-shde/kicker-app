/* ---------- Actions ---------- */
import { state, setState, defaultState, hydrateState, saveState, commit, uid, presentPlayers, playerHasMatches } from './state.js';
import { runningMatch, newestFirst, entryPlayerIds, winnerOf, setNoResult } from './history.js';
import { generateRound, shuffle } from './draw.js';
import { showToast, uiState } from './ui.js';

export function doDraw(){
  const round = generateRound({
    present: presentPlayers(),
    history: state.history,
    sessionId: state.session.id,
    limit: state.settings.positionStreakLimit || 3
  });
  if(!round){ showToast('Mindestens 4 anwesende Spieler nötig'); return; }
  state.pendingRound = round;
  commit();
}
export function doRevanche(){
  const last = newestFirst(state.history)[0];
  if(!last){ showToast('Noch keine Runde gespielt'); return; }
  const ids = entryPlayerIds(last);
  const present = presentPlayers();
  if(!ids.every(id=>present.includes(id))){
    showToast('Nicht alle Spieler von damals sind heute anwesend');
    return;
  }
  state.pendingRound = {
    teamA: { tor:last.teamA.tor, sturm:last.teamA.sturm },
    teamB: { tor:last.teamB.tor, sturm:last.teamB.sturm },
    mode: 'revanche'
  };
  commit();
}
export function doManual(){
  const present = presentPlayers();
  if(present.length < 4){ showToast('Mindestens 4 anwesende Spieler nötig'); return; }
  const four = shuffle(present).slice(0,4);
  state.pendingRound = {
    teamA: { tor: four[0], sturm: four[1] },
    teamB: { tor: four[2], sturm: four[3] },
    mode: 'manual'
  };
  commit();
}
export function startMatch(){
  if(!state.pendingRound) return;
  state.history.push(Object.assign({
    id: uid(),
    sessionId: state.session.id,
    timestamp: Date.now(),
    status: 'running',
    score: { teamA:0, teamB:0 },
    winner: null,
    mixed: { teamA:false, teamB:false }
  }, state.pendingRound));
  state.pendingRound = null;
  commit();
}
export function saveResult(){
  const m = runningMatch(state.history);
  if(!m) return;
  m.status = 'scored';
  m.winner = winnerOf(m.score);
  commit();
  showToast('Ergebnis gespeichert');
}
export function skipResult(){
  const m = runningMatch(state.history);
  if(!m) return;
  setNoResult(m);
  commit();
  showToast('Ohne Ergebnis gespeichert');
}
// Removes the match so it doesn't count, and goes back to adjusting the same teams
export function abortMatch(){
  const m = runningMatch(state.history);
  if(!m) return;
  state.history = state.history.filter(h=>h!==m);
  state.pendingRound = { teamA:{ ...m.teamA }, teamB:{ ...m.teamB }, mode:m.mode };
  commit();
  showToast('Spiel abgebrochen');
}
export function discardRound(){
  state.pendingRound = null;
  commit();
}
export function swapTeamPositions(teamKey){
  if(!state.pendingRound) return;
  const t = state.pendingRound[teamKey];
  const tmp = t.tor; t.tor = t.sturm; t.sturm = tmp;
  uiState.flashTeam = teamKey;
  commit();
}
export function setSlot(teamKey, posKey, newId){
  if(!state.pendingRound) return;
  const round = state.pendingRound;
  const oldId = round[teamKey][posKey];
  if(newId === oldId) return;
  let swapAt = null;
  ['teamA','teamB'].forEach(tk=>['tor','sturm'].forEach(pk=>{
    if(!(tk===teamKey && pk===posKey) && round[tk][pk]===newId) swapAt = {tk,pk};
  }));
  if(swapAt) round[swapAt.tk][swapAt.pk] = oldId;
  round[teamKey][posKey] = newId;
  commit();
}
export function togglePresent(id){
  const idx = state.presentIds.indexOf(id);
  if(idx>=0) state.presentIds.splice(idx,1);
  else state.presentIds.push(id);
  commit();
}
export function toggleChipsHidden(){
  state.session.chipsHidden = !state.session.chipsHidden;
  commit();
}
export function addPlayer(name){
  name = name.trim();
  if(!name) return;
  const p = { id: uid(), name };
  state.players.push(p);
  state.presentIds.push(p.id);
  commit();
}
export function renamePlayer(id, name){
  const p = state.players.find(pl=>pl.id===id);
  name = name.trim();
  if(p && name){ p.name = name; saveState(); }
}
// Takes a player out of the pool. With matches in the history the player is
// archived, so names and statistics stay; without any, the player is removed.
export function removePlayer(id){
  if(playerHasMatches(id)){
    const p = state.players.find(pl=>pl.id===id);
    if(p) p.archived = true;
  } else {
    state.players = state.players.filter(p=>p.id!==id);
  }
  state.presentIds = state.presentIds.filter(pid=>pid!==id);
  // A round that is still being set up can't keep a player who left
  if(state.pendingRound && entryPlayerIds(state.pendingRound).includes(id)) state.pendingRound = null;
  commit();
}
export function restorePlayer(id){
  const p = state.players.find(pl=>pl.id===id);
  if(!p) return;
  delete p.archived;
  commit();
}
export function deleteHistoryEntry(id){
  state.history = state.history.filter(h=>h.id!==id);
  commit();
}
export function setPositionStreakLimit(value){
  state.settings.positionStreakLimit = value;
  saveState();
}
export function setShowOdds(value){
  state.settings.showOdds = value;
  commit();
}
export function resetSession(){
  const m = runningMatch(state.history);
  if(m) setNoResult(m);
  state.session = { id: uid(), startedAt: Date.now() };
  state.pendingRound = null;
  commit();
  showToast('Session zurückgesetzt');
}
export function resetAll(){
  setState(defaultState());
  commit();
  showToast('Alle Daten gelöscht');
}
export function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = 'kicker-daten-' + d.toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
export function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.players || !parsed.history) throw new Error('invalid');
      setState(hydrateState(parsed));
      commit();
      showToast('Daten importiert');
    }catch(e){
      showToast('Import fehlgeschlagen – ungültige Datei');
    }
  };
  reader.readAsText(file);
}
