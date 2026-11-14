/* ---------- Entry point: rendering, navigation, global handlers ---------- */
import { state, initState, onChange, presentPlayers } from './state.js';
import { importData } from './actions.js';
import { initUi } from './ui.js';
import { renderDraw } from './views/draw.js';
import { renderPlayers } from './views/players.js';
import { renderHistory } from './views/history.js';
import { renderSettings } from './views/settings.js';

let activeView = 'draw';

function render(){
  document.getElementById('sessionPill').textContent =
    presentPlayers().length + ' anwesend · ' + sessionRoundNumber() + '. Runde heute';
  renderDraw();
  renderPlayers();
  renderHistory();
  renderSettings();
}
function sessionRoundNumber(){
  return state.history.filter(h=>h.sessionId===state.session.id).length + (state.pendingRound?1:0);
}

document.querySelectorAll('.tabbar button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    activeView = btn.getAttribute('data-view');
    document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active', b===btn));
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+activeView));
  });
});
document.getElementById('importFile').addEventListener('change', e=>{
  if(e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
});

initState();
initUi();
onChange(render);
render();
