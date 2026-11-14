/* ---------- Shared UI pieces: modal, toast, small HTML helpers ----------
   Nothing here runs at import time, so the module also loads outside a browser. */

// Transient view state shared between actions and views
export const uiState = {
  // Team whose positions were just swapped; its names fade in once on the next render
  flashTeam: null,
  // The pending round whose win probability was revealed by tapping (see views/draw.js)
  oddsRevealedFor: null
};

/* ---------- Modal / toast ---------- */
let modalConfirmCb = null;
export function openModal(title, text, onConfirm){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  modalConfirmCb = onConfirm;
}
export function closeModal(){
  document.getElementById('modalBackdrop').classList.add('hidden');
  modalConfirmCb = null;
}
let toastTimer;
export function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}
// The bottom sheet, for content a view fills in itself
export function showSheet(html){
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = html;
  sheet.scrollTop = 0;
  document.getElementById('sheetBackdrop').classList.remove('hidden');
  return sheet;
}
export function hideSheet(){
  document.getElementById('sheetBackdrop').classList.add('hidden');
}
export function initUi(){
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalConfirm').addEventListener('click', ()=>{ if(modalConfirmCb) modalConfirmCb(); });
}

/* ---------- Utils ---------- */
export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function escapeAttr(str){ return escapeHtml(str); }

export function emptyState(title, text){
  return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}
export function formatDay(ts){
  return new Date(ts).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
}
export function formatPercent(share){
  return Math.round(share*100) + ' %';
}
export function formatDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) + ' · ' + d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}
