/* ---------- Match card pieces shared by the draw view and the history sheet ---------- */
import { state, commit, playerName } from '../state.js';
import { winnerOf, setNoResult } from '../history.js';
import { escapeHtml, uiState } from '../ui.js';

// Rods from Team A's goal (top) to Team B's goal (bottom): owner and number of figures
const KICKER_RODS = [['a',1],['a',2],['b',3],['a',5],['b',5],['a',3],['b',2],['b',1]];
export function kickerTable(){
  const rods = KICKER_RODS.map(([team, figures], i)=>{
    const men = Array.from({length:figures}, (_, j)=>`<span class="kt-man" style="left:${(j+1)*100/(figures+1)}%"></span>`).join('');
    return `<div class="kt-rod ${team}" style="top:${(i+1)*100/(KICKER_RODS.length+1)}%">${men}</div>`;
  }).join('');
  return `
    <div class="kicker-table" aria-hidden="true">
      <div class="kt-field"><span class="kt-goal top"></span><span class="kt-goal bottom"></span><span class="kt-circle"></span>${rods}</div>
    </div>
  `;
}
// Team A's goal is at the top of the table, Team B's at the bottom.
// slotHTML(pos, ghost) renders one position's content; controls go between the
// two (an empty row of the same height without controls, so all cards match). Each slot also holds an invisible copy of its teammate's slot, so both
// are as tall as the longer name and a swap never changes the layout.
export function teamPanel(teamKey, slotHTML, controls){
  const order = teamKey==='teamA' ? ['tor','sturm'] : ['sturm','tor'];
  const slot = (pos, other) => `
    <div class="slot">
      <div class="slot-body">${slotHTML(pos, false)}</div>
      <div class="slot-body ghost" aria-hidden="true">${slotHTML(other, true)}</div>
    </div>`;
  return `
    <div class="team-panel ${teamKey}${uiState.flashTeam===teamKey?' flash':''}">
      <div class="team-label"><span class="dot"></span>Team ${teamKey==='teamA'?'A':'B'}</div>
      ${slot(order[0], order[1])}
      <div class="pos-controls">${controls || ''}</div>
      ${slot(order[1], order[0])}
    </div>
  `;
}
export function teamPanelStatic(h, teamKey, controls){
  const role = pos => h.mixed[teamKey] ? 'Tor/Sturm' : (pos==='tor' ? 'Tor' : 'Sturm');
  return teamPanel(teamKey, pos=>`
    <div class="slot-role">${role(pos)}</div><div class="slot-name">${escapeHtml(playerName(h[teamKey][pos]))}</div>
  `, controls);
}
const SWAP_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4"/></svg>';
export function swapButton(teamKey, attr, hidden){
  const label = `Team ${teamKey==='teamA'?'A':'B'}: Tor und Sturm tauschen`;
  return `<button class="swap-btn${hidden?' keep-space':''}" ${attr} aria-label="${label}" title="Tor und Sturm tauschen">${SWAP_ICON}</button>`;
}

/* ---------- Result entry (running match card and history sheet) ---------- */
// m: { teamA, teamB, score, mixed }. Steppers update the numbers in place
// instead of re-rendering, so fast taps register immediately.
export function resultEditorHTML(m){
  const w = winnerOf(m.score);
  const stepper = team => `
    <div class="stepper ${team==='teamA'?'a':'b'}" data-stepper="${team}">
      <button data-step="-1" aria-label="Team ${team==='teamA'?'A':'B'}: Tor abziehen">−</button>
      <span class="score-wrap">
        <span class="score-crown ${w===team?'on':''}" data-crown="${team}" aria-label="führt">👑</span>
        <span class="score" data-score="${team}">${m.score[team]}</span>
      </span>
      <button data-step="1" aria-label="Team ${team==='teamA'?'A':'B'}: Tor hinzufügen">+</button>
    </div>`;
  // Swapping is pointless once positions are mixed, so the icon hides (keeping its space)
  const controls = team => `
    ${swapButton(team, `data-rswap="${team}"`, m.mixed[team])}
    <button class="mixed-pill ${m.mixed[team]?'on':''}" data-mixed="${team}" aria-pressed="${m.mixed[team]}">gemischt</button>`;
  return `
    <div class="match-teams on-table">
      ${kickerTable()}
      ${teamPanelStatic(m, 'teamA', controls('teamA'))}
      ${teamPanelStatic(m, 'teamB', controls('teamB'))}
    </div>
    <div class="team-controls">
      ${stepper('teamA')}<div class="score-sep" data-score-sep>${w==='draw'?'🤝':':'}</div>${stepper('teamB')}
    </div>
  `;
}
export function attachResultEditor(root, m, persist, rerender){
  root.querySelectorAll('[data-stepper]').forEach(st=>{
    const team = st.getAttribute('data-stepper');
    st.querySelectorAll('[data-step]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        m.score[team] = Math.max(0, m.score[team] + Number(btn.getAttribute('data-step')));
        persist();
        updateScoreDisplay(root, m);
      });
    });
  });
  root.querySelectorAll('[data-rswap]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      uiState.flashTeam = btn.getAttribute('data-rswap');
      const t = m[uiState.flashTeam];
      [t.tor, t.sturm] = [t.sturm, t.tor];
      persist(); rerender();
    });
  });
  root.querySelectorAll('[data-mixed]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const team = btn.getAttribute('data-mixed');
      m.mixed[team] = !m.mixed[team];
      persist(); rerender();
    });
  });
}
function updateScoreDisplay(root, m){
  const w = winnerOf(m.score);
  ['teamA','teamB'].forEach(team=>{
    root.querySelector(`[data-score="${team}"]`).textContent = m.score[team];
    root.querySelector(`[data-crown="${team}"]`).classList.toggle('on', w===team);
  });
  root.querySelector('[data-score-sep]').textContent = w==='draw' ? '🤝' : ':';
}
export function scoreLine(h){
  if(h.status==='running') return '<span class="result-note live">läuft</span>';
  if(h.status!=='scored') return '<span class="result-note">kein Ergebnis</span>';
  const w = h.winner;
  return `${w==='teamA'?'👑 ':''}Team A <b>${h.score.teamA} : ${h.score.teamB}</b> Team B${w==='teamB'?' 👑':''}${w==='draw'?' 🤝':''}`;
}

/* ---------- Sheet for editing a saved match ---------- */
// Editing a saved match works on a copy until it is saved
let sheetDraft = null;
export function openResultSheet(id){
  const h = state.history.find(x=>x.id===id);
  if(!h) return;
  sheetDraft = {
    id,
    teamA: { ...h.teamA }, teamB: { ...h.teamB },
    mixed: { ...h.mixed },
    score: h.score ? { ...h.score } : { teamA:0, teamB:0 }
  };
  renderSheet();
  document.getElementById('sheetBackdrop').classList.remove('hidden');
}
function renderSheet(){
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `
    <h3>Ergebnis bearbeiten</h3>
    <p>Positionen tauschen, „gemischt“ setzen oder den Spielstand ändern.</p>
    <div class="match-card">${resultEditorHTML(sheetDraft)}</div>
    <div class="sheet-actions">
      <button class="btn btn-ghost btn-block" data-sheet="cancel">Abbrechen</button>
      <button class="btn btn-secondary btn-block" data-sheet="noResult">Ohne Ergebnis speichern</button>
      <button class="btn btn-primary btn-block" data-sheet="save">✓ Ergebnis speichern</button>
    </div>
  `;
  uiState.flashTeam = null;
  attachResultEditor(sheet, sheetDraft, ()=>{}, renderSheet);
  sheet.querySelector('[data-sheet="cancel"]').addEventListener('click', closeSheet);
  sheet.querySelector('[data-sheet="noResult"]').addEventListener('click', ()=>commitSheet(false));
  sheet.querySelector('[data-sheet="save"]').addEventListener('click', ()=>commitSheet(true));
}
function commitSheet(withScore){
  const h = state.history.find(x=>x.id===sheetDraft.id);
  if(h){
    h.teamA = sheetDraft.teamA;
    h.teamB = sheetDraft.teamB;
    h.mixed = sheetDraft.mixed;
    if(withScore){
      h.status = 'scored';
      h.score = sheetDraft.score;
      h.winner = winnerOf(h.score);
    } else {
      setNoResult(h);
    }
    commit();
  }
  closeSheet();
}
function closeSheet(){
  document.getElementById('sheetBackdrop').classList.add('hidden');
  sheetDraft = null;
}
