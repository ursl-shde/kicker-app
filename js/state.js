/* ---------- State ---------- */
import { winnerOf, setNoResult, entryHasPlayer } from './history.js';
import { showToast } from './ui.js';

export const STORAGE_KEY = 'kicker_lose_state_v1';
export const MAX_NAME_LENGTH = 24;

export function uid(){ return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

export function defaultState(){
  return {
    version: 1,
    players: [],
    presentIds: [],
    session: { id: uid(), startedAt: Date.now() },
    pendingRound: null,
    history: [],
    // showOdds: win probability on the draw card – 'tap' | 'always' | 'never'
    settings: { positionStreakLimit: 3, showOdds: 'tap' }
  };
}

// The one app state. Other modules read it through this live binding; only
// this module can replace the object, hence initState() and setState().
export let state = null;

export function initState(){ state = loadState(); }
export function setState(next){ state = next; }

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    return hydrateState(JSON.parse(raw));
  }catch(e){
    console.error('Konnte gespeicherte Daten nicht laden', e);
    return defaultState();
  }
}

// Turns saved or imported data into a complete state: anything missing,
// including settings added in later versions, gets its default.
export function hydrateState(parsed){
  const s = Object.assign(defaultState(), parsed);
  s.settings = Object.assign(defaultState().settings, parsed.settings);
  return normalizeState(s);
}

// History entries carry a result status: 'running' (match in progress),
// 'scored' or 'noResult'. Older entries have none and count as 'noResult'.
// Only the newest running match stays running, so none can get stuck.
export function normalizeState(s){
  let runningSeen = false;
  s.history.slice().sort((a,b)=>b.timestamp-a.timestamp).forEach(h=>{
    if(!h.mixed) h.mixed = { teamA:false, teamB:false };
    if(h.status==='running' && !runningSeen){
      runningSeen = true;
      if(!h.score) h.score = { teamA:0, teamB:0 };
    } else if(h.status==='scored' && h.score){
      h.winner = winnerOf(h.score);
    } else {
      setNoResult(h);
    }
  });
  return s;
}

export function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error('Speichern fehlgeschlagen', e);
    showToast('Speichern fehlgeschlagen – Speicher evtl. voll');
  }
}

/* ---------- Change notification ----------
   main.js registers the app's render function here, so actions and views can
   trigger a re-render without importing main.js. */
const listeners = [];
export function onChange(cb){ listeners.push(cb); }
// Re-render without saving
export function notify(){ listeners.forEach(cb=>cb()); }
// Save, then re-render
export function commit(){ saveState(); notify(); }

/* ---------- Selectors ---------- */
export function playerName(id){
  const p = state.players.find(pl=>pl.id===id);
  return p ? p.name : '—';
}
// Archived players keep their matches and statistics but are out of the pool
export function activePlayers(){
  return state.players.filter(p=>!p.archived);
}
export function presentPlayers(){
  return state.presentIds.filter(id=>state.players.some(p=>p.id===id && !p.archived));
}
export function playerHasMatches(id){
  return state.history.some(h=>entryHasPlayer(h, id));
}
