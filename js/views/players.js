/* ---------- Players view ---------- */
import { state, MAX_NAME_LENGTH, playerName } from '../state.js';
import { addPlayer, renamePlayer, deletePlayer } from '../actions.js';
import { escapeHtml, escapeAttr, emptyState, openModal, closeModal } from '../ui.js';

export function renderPlayers(){
  const el = document.getElementById('view-players');
  el.innerHTML = `
    <div class="section-title">Spieler-Pool (${state.players.length})</div>
    ${state.players.length===0 ? emptyState('Noch niemand da', 'Füge unten eure Stammspieler hinzu.') : state.players.map(p=>`
      <div class="player-row">
        <input type="text" value="${escapeAttr(p.name)}" maxlength="${MAX_NAME_LENGTH}" data-rename="${p.id}">
        <button class="icon-btn danger" data-delete="${p.id}" title="Löschen">🗑</button>
      </div>
    `).join('')}
    <div class="add-player-row">
      <input type="text" id="newPlayerName" maxlength="${MAX_NAME_LENGTH}" placeholder="Name eingeben…">
      <button class="btn btn-primary btn-small" id="addPlayerBtn">+ Hinzufügen</button>
    </div>
    <p class="note">Wer anwesend ist, stellt ihr im Tab „Auslosen“ über die Chips ein – auch mitten in der Session.</p>
  `;
  document.querySelectorAll('[data-rename]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const id = inp.getAttribute('data-rename');
      renamePlayer(id, inp.value);
      inp.value = playerName(id); // shows the trimmed name, or restores the old one if left empty
    });
  });
  document.querySelectorAll('[data-delete]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-delete');
      openModal('Spieler löschen?', `${playerName(id)} wird aus dem Pool entfernt. Bereits gespeicherte Runden bleiben in der Historie sichtbar.`, ()=>{
        deletePlayer(id); closeModal();
      });
    });
  });
  const addBtn = document.getElementById('addPlayerBtn');
  const input = document.getElementById('newPlayerName');
  addBtn.addEventListener('click', ()=>{ addPlayer(input.value); input.value=''; });
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ addPlayer(input.value); input.value=''; } });
}
