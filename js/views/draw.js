/* ---------- Draw view: presence chips, pending round, running match ---------- */
import { state, saveState, notify, playerName, presentPlayers } from '../state.js';
import { runningMatch, newestFirst, entryPlayerIds, sessionRoundCount } from '../history.js';
import * as actions from '../actions.js';
import { escapeHtml, emptyState, uiState } from '../ui.js';
import { kickerTable, teamPanel, teamPanelStatic, swapButton, resultEditorHTML, attachResultEditor, scoreLine } from './match.js';

function roundsToday(id){
  return sessionRoundCount(state.history, state.session.id, id);
}

function whereIsPlayer(round, id){
  if(round.teamA.tor===id) return 'Team A · Tor';
  if(round.teamA.sturm===id) return 'Team A · Sturm';
  if(round.teamB.tor===id) return 'Team B · Tor';
  if(round.teamB.sturm===id) return 'Team B · Sturm';
  return null;
}
function teamOptionsHTML(teamKey, posKey){
  const round = state.pendingRound;
  const current = round[teamKey][posKey];
  const options = presentPlayers().slice().sort((a,b)=>playerName(a).localeCompare(playerName(b),'de'));
  return options
    .map(id=>{
      let label = playerName(id);
      if(id!==current){
        const loc = whereIsPlayer(round, id);
        if(loc) label += ' — tauscht mit ' + loc;
      }
      return `<option value="${id}" ${id===current?'selected':''}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

export function renderDraw(){
  const el = document.getElementById('view-draw');
  const present = presentPlayers();

  if(state.players.length === 0){
    el.innerHTML = emptyState('Noch keine Spieler', 'Leg zuerst eure Stammspieler im Tab „Spieler“ an.');
    return;
  }
  if(present.length < 4){
    el.innerHTML = `
      ${presenceChips(present, false)}
      ${emptyState('Zu wenig Spieler anwesend', 'Markiert mindestens 4 Spieler als anwesend, um auszulosen.')}
    `;
    attachChipHandlers();
    return;
  }

  let html = presenceChips(present, true);
  const running = runningMatch(state.history);
  const round = running || state.pendingRound;
  const usedIds = round ? entryPlayerIds(round) : [];
  const waiting = present.filter(id=>!usedIds.includes(id));

  if(running){
    html += `
      <div class="match-card" id="runningCard">
        ${resultEditorHTML(running)}
        <div class="match-actions fill-actions">
          <button class="btn btn-ghost btn-block" data-action="abort">✕ Abbrechen</button>
          <button class="btn btn-secondary btn-block" data-action="skip">Ohne Ergebnis</button>
          <button class="btn btn-primary btn-block" data-action="saveResult">✓ Ergebnis speichern</button>
        </div>
      </div>
      ${waiting.length ? waitingSection(waiting) : ''}
    `;
  } else if(state.pendingRound){
    html += `
      <div class="match-card">
        <div class="match-teams on-table">
          ${kickerTable()}
          ${teamPanelEditable('teamA')}
          ${teamPanelEditable('teamB')}
        </div>
        <div class="match-actions fill-actions">
          <button class="btn btn-ghost btn-block" data-action="discard">✕ Verwerfen</button>
          <button class="btn btn-primary btn-block" data-action="confirm">▶ Spiel starten</button>
        </div>
      </div>
      ${waiting.length ? waitingSection(waiting) : ''}
    `;
  } else {
    const last = newestFirst(state.history)[0];
    html += `
      <div class="match-card">
        <div class="match-teams${last?' on-table':''}">${last?kickerTable():''}${lastRoundOrPrompt(last)}</div>
        ${last ? `<div class="match-vs">Letzte Runde · ${scoreLine(last)}</div>` : ''}
        <div class="match-actions fill-actions">
          <button class="btn btn-ghost btn-small" data-action="revanche">↻ Revanche</button>
          <button class="btn btn-ghost btn-small" data-action="manual">✎ Eigene Kombination</button>
          <button class="btn btn-primary btn-block" data-action="draw">🎲 Auslosen</button>
        </div>
      </div>
    `;
  }
  el.innerHTML = html;
  uiState.flashTeam = null;
  attachChipHandlers();
  attachDrawHandlers();
  if(running) attachResultEditor(document.getElementById('runningCard'), running, saveState, notify);
}

function lastRoundOrPrompt(last){
  if(!last){
    return `<div style="padding:20px;color:var(--ink-soft);font-size:.88rem;grid-column:1/-1;text-align:center;">Noch keine Runde gespielt heute.</div>`;
  }
  return teamPanelStatic(last, 'teamA') + teamPanelStatic(last, 'teamB');
}

function teamPanelEditable(teamKey){
  const team = teamKey==='teamA' ? 'A' : 'B';
  return teamPanel(teamKey, (pos, ghost)=>{
    const role = pos==='tor' ? 'Tor' : 'Sturm';
    return `
      <div class="slot-role">${role}</div>
      <div class="slot-pick">
        <span class="slot-name">${escapeHtml(playerName(state.pendingRound[teamKey][pos]))}</span><span class="chev" aria-hidden="true">▾</span>
        ${ghost ? '' : `<select data-team="${teamKey}" data-pos="${pos}" aria-label="Team ${team} ${role}">${teamOptionsHTML(teamKey,pos)}</select>`}
      </div>
    `;
  }, swapButton(teamKey, `data-action="swap${team}"`));
}

function waitingSection(waiting){
  return `
    <div class="waiting-line">
      <span class="label">Pausiert</span>
      ${waiting.map(id=>`<span class="name">${escapeHtml(playerName(id))} <span class="n">${roundsToday(id)}×</span></span>`).join('')}
    </div>
  `;
}

// The chips can be hidden while enough players are present. The flag lives on
// the session, so a new session (Session zurücksetzen) shows them again.
function presenceChips(present, collapsible){
  const hidden = collapsible && state.session.chipsHidden;
  const title = `Heute anwesend · ${present.length} von ${state.players.length}`;
  return `
    ${collapsible ? `
      <button class="section-title section-toggle" data-chips-toggle aria-expanded="${!hidden}">
        <span>${title}</span><span class="toggle-hint">${hidden ? 'Einblenden ▾' : 'Ausblenden ▴'}</span>
      </button>
    ` : `<div class="section-title">${title}</div>`}
    ${hidden ? '' : `
      <div class="waiting-list" id="presenceChips">
        ${state.players.map(p=>`
          <span class="chip ${present.includes(p.id)?'present':''}" data-toggle="${p.id}">
            ${escapeHtml(p.name)} <span class="n">${roundsToday(p.id)}×</span>
          </span>
        `).join('')}
      </div>
    `}
  `;
}

function attachChipHandlers(){
  document.querySelectorAll('[data-toggle]').forEach(el=>{
    el.addEventListener('click', ()=>actions.togglePresent(el.getAttribute('data-toggle')));
  });
  document.querySelectorAll('[data-chips-toggle]').forEach(el=>{
    el.addEventListener('click', actions.toggleChipsHidden);
  });
}
function attachDrawHandlers(){
  const map = {
    draw: actions.doDraw, revanche: actions.doRevanche, manual: actions.doManual,
    confirm: actions.startMatch, discard: actions.discardRound,
    abort: actions.abortMatch, skip: actions.skipResult, saveResult: actions.saveResult,
    swapA: ()=>actions.swapTeamPositions('teamA'), swapB: ()=>actions.swapTeamPositions('teamB')
  };
  Object.keys(map).forEach(action=>{
    document.querySelectorAll(`[data-action="${action}"]`).forEach(el=>{
      el.addEventListener('click', map[action]);
    });
  });
  document.querySelectorAll('select[data-team]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      actions.setSlot(sel.getAttribute('data-team'), sel.getAttribute('data-pos'), sel.value);
    });
  });
}
