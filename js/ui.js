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
// The bottom sheet, for content a view fills in itself. It gets a grab handle
// and can be closed by swiping it down or tapping the dimmed area around it.
let sheetCloseTimer;
export function showSheet(html){
  const sheet = document.getElementById('sheet');
  // A sheet that is still sliding out must not close the new one
  clearTimeout(sheetCloseTimer);
  sheet.classList.remove('settling');
  sheet.style.transform = '';
  sheet.innerHTML = '<div class="sheet-handle" aria-hidden="true"></div>' + html;
  sheet.classList.add('swipeable');
  document.getElementById('sheetBackdrop').classList.remove('hidden');
  // Only after showing: a hidden element ignores scrolling and would come
  // back at the position it was closed at
  sheet.scrollTop = 0;
  return sheet;
}
export function hideSheet(){
  const sheet = document.getElementById('sheet');
  // Back to the top while it is still visible, for browsers that keep the
  // position of a hidden element
  sheet.scrollTop = 0;
  sheet.classList.remove('swipeable', 'settling');
  sheet.style.transform = '';
  document.getElementById('sheetBackdrop').classList.add('hidden');
}

/* Swipe down to close. The sheet follows the finger once a downward drag
   starts while its content is scrolled to the top; otherwise the touch scrolls
   the content as usual. Let go far enough down, or with a quick flick, and it
   slides out; otherwise it settles back. */
const SWIPE_CLOSE_DISTANCE = 110;   // px
const SWIPE_FLICK_SPEED = 0.35;     // px per ms
function initSheetSwipe(){
  const sheet = document.getElementById('sheet');
  let drag = null;
  sheet.addEventListener('touchstart', e=>{
    drag = null;
    if(!sheet.classList.contains('swipeable') || e.touches.length!==1 || sheet.scrollTop > 0) return;
    drag = { x:e.touches[0].clientX, y:e.touches[0].clientY, dy:0, active:false, samples:[{ time:Date.now(), dy:0 }] };
  }, { passive:true });
  sheet.addEventListener('touchmove', e=>{
    if(!drag) return;
    const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
    if(!drag.active){
      // Upward or mostly sideways: this is scrolling or the chart's crosshair
      if(dy < 0 || Math.abs(dx) > Math.abs(dy)){ if(Math.abs(dx) > 8 || dy < -8) drag = null; return; }
      if(dy < 8) return;
      drag.active = true;
      sheet.classList.remove('settling');
    }
    e.preventDefault();
    drag.dy = Math.max(0, dy);
    drag.samples.push({ time:Date.now(), dy:drag.dy });
    sheet.style.transform = `translateY(${drag.dy}px)`;
  }, { passive:false });
  const end = ()=>{
    if(!drag || !drag.active){ drag = null; return; }
    // Speed over the last moments of the drag, so a pause before the flick doesn't hide it
    const now = Date.now();
    const from = drag.samples.filter(p=>now - p.time >= 120).pop() || drag.samples[0];
    const speed = (drag.dy - from.dy) / Math.max(1, now - from.time);
    const close = drag.dy > SWIPE_CLOSE_DISTANCE || (drag.dy > 30 && speed > SWIPE_FLICK_SPEED);
    drag = null;
    sheet.classList.add('settling');
    if(close){
      sheet.style.transform = 'translateY(100%)';
      sheetCloseTimer = setTimeout(hideSheet, 200);
    } else {
      sheet.style.transform = '';
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
  document.getElementById('sheetBackdrop').addEventListener('click', e=>{
    if(e.target===e.currentTarget && sheet.classList.contains('swipeable')) hideSheet();
  });
}
export function initUi(){
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalConfirm').addEventListener('click', ()=>{ if(modalConfirmCb) modalConfirmCb(); });
  initSheetSwipe();
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
