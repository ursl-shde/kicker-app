/* ---------- Settings view ---------- */
import { state } from '../state.js';
import { setPositionStreakLimit, setShowOdds, resetSession, resetAll, exportData } from '../actions.js';
import { openModal, closeModal } from '../ui.js';

export function renderSettings(){
  const el = document.getElementById('view-settings');
  el.innerHTML = `
    <div class="section-title">Regeln</div>
    <div class="settings-row">
      <label for="streakLimit">Positions-Wechsel nach</label>
      <p>Wer so oft hintereinander dieselbe Position gespielt hat, bekommt automatisch die andere zugeteilt.</p>
      <input type="number" id="streakLimit" min="1" max="10" value="${state.settings.positionStreakLimit}"> mal
    </div>

    <div class="section-title">Anzeige</div>
    <div class="settings-row">
      <label for="showOdds">Siegchance vor dem Spiel</label>
      <p>Zeigt bei der Aufstellung, wie die Chancen nach der bisherigen Elo-Wertung stehen.</p>
      <select id="showOdds">
        ${[['tap','Erst nach Antippen'],['always','Immer anzeigen'],['never','Nie anzeigen']].map(([value, label])=>
          `<option value="${value}" ${state.settings.showOdds===value?'selected':''}>${label}</option>`).join('')}
      </select>
    </div>

    <div class="section-title">Session</div>
    <div class="settings-row">
      <p>Setzt nur die „heute gespielt“-Zähler zurück. Anwesenheit und Verlauf bleiben erhalten.</p>
      <button class="btn btn-secondary btn-block" data-action="resetSession">Session zurücksetzen</button>
    </div>

    <div class="section-title">Daten</div>
    <div class="settings-row">
      <p>Sichert Spieler, Verlauf und Einstellungen als Datei – z. B. vor einem Update oder zum Übertragen auf ein anderes Gerät.</p>
      <div class="settings-actions fill-actions">
        <button class="btn btn-secondary" id="exportBtn">⬇ Exportieren</button>
        <button class="btn btn-secondary" id="importBtn">⬆ Importieren</button>
      </div>
    </div>
    <div class="settings-row">
      <p>Löscht Spieler, Anwesenheit, Verlauf und Einstellungen unwiderruflich.</p>
      <button class="btn btn-danger btn-block" data-action="resetAll">Alles zurücksetzen</button>
    </div>

    <div class="section-title">Über</div>
    <div class="settings-row">
      <p>Der Quellcode dieser App liegt auf GitHub.</p>
      <a class="btn btn-secondary btn-block" href="https://github.com/ursl-shde/kicker-app" target="_blank" rel="noopener">GitHub-Repository öffnen ↗</a>
    </div>
    <p class="note">Alle Daten werden nur lokal in diesem Browser auf diesem Gerät gespeichert – es gibt keine Cloud-Synchronisation.</p>
  `;
  document.getElementById('streakLimit').addEventListener('change', e=>{
    setPositionStreakLimit(Math.max(1, Math.min(10, parseInt(e.target.value,10) || 3)));
  });
  document.getElementById('showOdds').addEventListener('change', e=>setShowOdds(e.target.value));
  document.querySelector('[data-action="resetSession"]').addEventListener('click', ()=>{
    openModal('Session zurücksetzen?', 'Die heutigen Runden-Zähler starten bei 0. Der bisherige Verlauf bleibt gespeichert.', ()=>{
      resetSession(); closeModal();
    });
  });
  document.querySelector('[data-action="resetAll"]').addEventListener('click', ()=>{
    openModal('Wirklich alles löschen?', 'Das entfernt sämtliche Spieler, den kompletten Verlauf und alle Einstellungen unwiderruflich. Am besten vorher exportieren.', ()=>{
      resetAll(); closeModal();
    });
  });
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', ()=>document.getElementById('importFile').click());
}
