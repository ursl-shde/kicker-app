/* ---------- Players view ---------- */
import { state, MAX_NAME_LENGTH, playerName, activePlayers, playerHasMatches } from '../state.js';
import { addPlayer, renamePlayer, removePlayer, restorePlayer } from '../actions.js';
import { escapeHtml, escapeAttr, emptyState, openModal, closeModal } from '../ui.js';

// Whether the list of archived players is unfolded
let archiveOpen = false;

export function renderPlayers(){
  const el = document.getElementById('view-players');
  const active = activePlayers();
  const archived = state.players.filter(p=>p.archived);
  el.innerHTML = `
    <div class="section-title">Spieler-Pool (${active.length})</div>
    ${active.length===0 ? emptyState('Noch niemand da', 'Füge unten eure Stammspieler hinzu.') : active.map(p=>`
      <div class="player-row">
        <input type="text" value="${escapeAttr(p.name)}" maxlength="${MAX_NAME_LENGTH}" data-rename="${p.id}">
        <button class="icon-btn danger" data-delete="${p.id}" title="Aus dem Pool nehmen">🗑</button>
      </div>
    `).join('')}
    <div class="add-player-row">
      <input type="text" id="newPlayerName" maxlength="${MAX_NAME_LENGTH}" placeholder="Name eingeben…">
      <button class="btn btn-primary btn-small" id="addPlayerBtn">+ Hinzufügen</button>
    </div>
    <p class="note">Wer anwesend ist, stellt ihr im Tab „Auslosen“ über die Chips ein – auch mitten in der Session.</p>
    ${archived.length ? `
      <button class="section-title section-toggle" data-archive-toggle aria-expanded="${archiveOpen}">
        <span>Archiviert (${archived.length})</span><span class="toggle-hint">${archiveOpen ? 'Ausblenden ▴' : 'Einblenden ▾'}</span>
      </button>
      ${archiveOpen ? `
        ${archived.map(p=>`
          <div class="player-row">
            <span class="player-name">${escapeHtml(p.name)}</span>
            <button class="btn btn-secondary btn-small" data-restore="${p.id}">Wiederherstellen</button>
          </div>
        `).join('')}
        <p class="note">Archivierte Spieler werden nicht mehr ausgelost. Ihre Spiele bleiben im Verlauf und in der Statistik.</p>
      ` : ''}
    ` : ''}
  `;
  el.querySelectorAll('[data-rename]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const id = inp.getAttribute('data-rename');
      renamePlayer(id, inp.value);
      inp.value = playerName(id); // shows the trimmed name, or restores the old one if left empty
    });
  });
  el.querySelectorAll('[data-delete]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-delete');
      const [title, text] = playerHasMatches(id)
        ? ['Spieler archivieren?', `${playerName(id)} wird aus dem Pool genommen und nicht mehr ausgelost. Spiele und Statistik bleiben erhalten; unter „Archiviert“ lässt sich das rückgängig machen.`]
        : ['Spieler löschen?', `${playerName(id)} hat noch kein Spiel und wird endgültig entfernt.`];
      openModal(title, text, ()=>{ removePlayer(id); closeModal(); });
    });
  });
  el.querySelectorAll('[data-restore]').forEach(btn=>{
    btn.addEventListener('click', ()=>restorePlayer(btn.getAttribute('data-restore')));
  });
  const archiveToggle = el.querySelector('[data-archive-toggle]');
  if(archiveToggle) archiveToggle.addEventListener('click', ()=>{ archiveOpen = !archiveOpen; renderPlayers(); });
  const addBtn = document.getElementById('addPlayerBtn');
  const input = document.getElementById('newPlayerName');
  addBtn.addEventListener('click', ()=>{ addPlayer(input.value); input.value=''; });
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ addPlayer(input.value); input.value=''; } });
}
