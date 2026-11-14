/* ---------- History view ---------- */
import { state, playerName } from '../state.js';
import { newestFirst } from '../history.js';
import { deleteHistoryEntry } from '../actions.js';
import { escapeHtml, emptyState, formatDate, openModal, closeModal } from '../ui.js';
import { scoreLine, openResultSheet } from './match.js';

export function renderHistory(){
  const el = document.getElementById('view-history');
  const entries = newestFirst(state.history);
  if(entries.length===0){
    el.innerHTML = emptyState('Noch keine Runden gespeichert', 'Gestartete Spiele erscheinen hier.');
    return;
  }
  const names = (h, teamKey)=>{
    const t = h[teamKey];
    return h.mixed[teamKey]
      ? `${escapeHtml(playerName(t.tor))} / ${escapeHtml(playerName(t.sturm))} <span class="pos">(gemischt)</span>`
      : `${escapeHtml(playerName(t.tor))} <span class="pos">(Tor)</span> / ${escapeHtml(playerName(t.sturm))} <span class="pos">(Sturm)</span>`;
  };
  el.innerHTML = `
    <div class="section-title">Verlauf (${entries.length})</div>
    ${entries.map(h=>`
      <div class="history-entry">
        <div class="history-meta">
          <span>${formatDate(h.timestamp)} · ${modeLabel(h.mode)}</span>
          <span class="history-tools">
            ${h.status==='running' ? '' : `<button class="icon-btn" data-hedit="${h.id}" title="Ergebnis bearbeiten">✎</button>`}
            <button class="icon-btn danger" data-hdel="${h.id}" title="Eintrag löschen">🗑</button>
          </span>
        </div>
        <div class="history-teams"><span class="tA">${names(h,'teamA')}</span></div>
        <div class="history-score">${scoreLine(h)}</div>
        <div class="history-teams"><span class="tB">${names(h,'teamB')}</span></div>
      </div>
    `).join('')}
  `;
  document.querySelectorAll('[data-hedit]').forEach(btn=>{
    btn.addEventListener('click', ()=>openResultSheet(btn.getAttribute('data-hedit')));
  });
  document.querySelectorAll('[data-hdel]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-hdel');
      openModal('Eintrag löschen?', 'Dieser Verlaufs-Eintrag wird endgültig entfernt und fließt nicht mehr in Auslosung oder Statistik ein.', ()=>{
        deleteHistoryEntry(id); closeModal();
      });
    });
  });
}
function modeLabel(mode){
  return { draw:'Auslosung', manual:'Manuell', revanche:'Revanche' }[mode] || mode;
}
