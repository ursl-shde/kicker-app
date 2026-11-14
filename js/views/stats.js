/* ---------- Statistics view ---------- */
import { state, playerName, activePlayers } from '../state.js';
import {
  PERIODS, MIN_GAMES_RATED, MIN_GAMES_POSITION, MIN_GAMES_PAIR,
  scoredMatches, periodFilter, computeRatings, computeStats, ratingChange,
  winProbability, winRate, form, currentStreak, bestAndWorst
} from '../stats.js';
import { SERIES_SLOTS, lineChartSVG, attachLineChart, valueAt, segmentedBarHTML, oddsHTML } from '../charts.js';
import { escapeHtml, emptyState, formatDay, formatPercent, showSheet, hideSheet, showToast } from '../ui.js';

/* View state: lives as long as the page is open */
let period = 'all';
// Players shown in the rating chart: Map id → colour slot. A player keeps the
// slot while selected, so toggling others never recolours a line. null = default.
let chartSlots = null;
let duosExpanded = false;
// The four players in the win probability calculator: [A1, A2, B1, B2]
let calcIds = null;

const DUOS_SHORT = 5;
const RESULT_LETTER = { w:'S', d:'U', l:'N' };
const RESULT_WORD = { w:['Sieg','Siege'], d:['Unentschieden','Unentschieden'], l:['Niederlage','Niederlagen'] };

const round = v=>Math.round(v);
const decimal = v=>v.toLocaleString('de-DE', { minimumFractionDigits:1, maximumFractionDigits:1 });
const plural = (n, one, many)=>n + ' ' + (n===1 ? one : many);
const games = n=>plural(n, 'Spiel', 'Spiele');
const name = id=>escapeHtml(playerName(id));
const periodLabel = ()=>PERIODS.find(p=>p.key===period).label;

// Everything the view shows, worked out from the history
function collect(){
  const scored = scoredMatches(state.history);
  const ratings = computeRatings(state.history);
  const matches = scored.filter(periodFilter(period, { now:Date.now(), sessionId:state.session.id }));
  const stats = computeStats(matches);
  const matchIds = new Set(matches.map(m=>m.id));
  const known = id=>state.players.some(p=>p.id===id);
  // Ranking: players with enough matches by rating, then the provisional ones
  const ranking = state.players
    .filter(p=>ratings.players.has(p.id))
    .map(p=>{
      const r = ratings.players.get(p.id);
      return { id:p.id, archived:!!p.archived, rating:r, provisional:r.games < MIN_GAMES_RATED, record:stats.players.get(p.id) || null };
    })
    .sort((a,b)=>(a.provisional - b.provisional) || (b.rating.overall - a.rating.overall));
  return { scored, ratings, matches, stats, matchIds, known, ranking };
}

export function renderStats(){
  const el = document.getElementById('view-stats');
  const data = collect();
  if(data.scored.length===0){
    el.innerHTML = emptyState('Noch keine Ergebnisse', 'Sobald Spiele mit Ergebnis gespeichert sind, erscheint hier die Statistik.');
    return;
  }
  const hasMatches = data.matches.length > 0;
  const oldRow = el.querySelector('.period-row');
  const rowScroll = oldRow ? oldRow.scrollLeft : 0;
  el.innerHTML = `
    ${periodChips()}
    ${hasMatches ? overviewHTML(data) : emptyState('Keine Spiele in diesem Zeitraum', 'Wertung, Duos und Siegchance gelten trotzdem – sie beruhen auf allen Spielen.')}
    ${rankingHTML(data)}
    ${hasMatches ? chartSectionHTML(data) : ''}
    ${duosHTML(data)}
    ${calculatorHTML(data)}
    ${hasMatches ? sidesAndRecordsHTML(data) : ''}
    <p class="note">Gewertet werden nur Spiele mit gespeichertem Ergebnis. Die Elo-Wertung beruht immer auf allen Spielen; der Zeitraum zeigt, wie sie sich darin verändert hat.</p>
  `;
  restorePeriodRow(el.querySelector('.period-row'), rowScroll);
  attachHandlers(el, data);
}

/* ---------- Period ---------- */
// Rendering rebuilds the chip row, which would jump back to its start. Put it
// where it was, then move it just far enough that the selected chip is fully
// in view. Only the row itself is scrolled, never the page.
function restorePeriodRow(row, scrollLeft){
  row.scrollLeft = scrollLeft;
  const chip = row.querySelector('.period-chip.on');
  const rowBox = row.getBoundingClientRect(), chipBox = chip.getBoundingClientRect();
  const margin = 16;
  if(chipBox.left < rowBox.left + margin) row.scrollLeft -= rowBox.left + margin - chipBox.left;
  else if(chipBox.right > rowBox.right - margin) row.scrollLeft += chipBox.right - (rowBox.right - margin);
}
function periodChips(){
  return `
    <div class="period-row" role="group" aria-label="Zeitraum">
      ${PERIODS.map(p=>`<button class="period-chip ${p.key===period?'on':''}" data-period="${p.key}" aria-pressed="${p.key===period}">${p.label}</button>`).join('')}
    </div>`;
}

/* ---------- Overview ---------- */
function tile(label, value){
  return `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div></div>`;
}
function overviewHTML({ stats }){
  const t = stats.totals;
  return `
    <div class="section-title">Überblick · ${periodLabel()}</div>
    <div class="tiles">
      ${tile('Spiele', t.matches)}
      ${tile('Tore', t.goals)}
      ${tile('Tore pro Spiel', decimal(t.avgGoals))}
      ${tile('Unentschieden', t.draws)}
    </div>`;
}

/* ---------- Ranking ---------- */
function deltaHTML(delta){
  const v = round(delta);
  if(v===0) return `<span class="delta">± 0</span>`;
  return v > 0
    ? `<span class="delta up"><span aria-hidden="true">▲</span><span class="sr-only">plus</span> ${v}</span>`
    : `<span class="delta down"><span aria-hidden="true">▼</span><span class="sr-only">minus</span> ${-v}</span>`;
}
// Share of wins (solid) and draws (light) in a record; the rest are defeats
function recordBarHTML(r){
  return segmentedBarHTML([
    { value:r.w, cls:'win', title:plural(r.w, ...RESULT_WORD.w) },
    { value:r.d, cls:'tie', title:r.d + ' Unentschieden' },
    { value:r.l, cls:'loss', title:plural(r.l, ...RESULT_WORD.l) }
  ], `${r.w} Siege, ${r.d} Unentschieden, ${r.l} Niederlagen`);
}
function recordText(r){
  return `${r.w} S · ${r.d} U · ${r.l} N`;
}
function rankingHTML({ ranking, ratings, matchIds }){
  let place = 0;
  return `
    <div class="section-title">Rangliste · Elo</div>
    ${ranking.map(row=>{
      const r = row.record;
      const tags = (row.provisional ? ' <span class="tag">vorläufig</span>' : '') + (row.archived ? ' <span class="tag">archiviert</span>' : '');
      return `
        <button class="rank-row" data-player="${row.id}">
          <span class="rank-no">${row.provisional ? '–' : ++place}</span>
          <span class="rank-main">
            <span class="rank-name">${name(row.id)}${tags}</span>
            ${r ? `
              <span class="rank-sub">${games(r.games)} · ${recordText(r)} · ${formatPercent(winRate(r))} Siege</span>
              ${recordBarHTML(r)}
            ` : `<span class="rank-sub">Kein Spiel in diesem Zeitraum</span>`}
          </span>
          <span class="rank-rating">
            <span class="rating">${round(row.rating.overall)}</span>
            ${period!=='all' && r ? deltaHTML(ratingChange(ratings.players.get(row.id), matchIds)) : ''}
          </span>
        </button>`;
    }).join('')}
    <p class="note">Antippen zeigt die Details. „Vorläufig“ heißt: weniger als ${MIN_GAMES_RATED} gewertete Spiele.</p>`;
}

/* ---------- Rating chart ---------- */
function currentChartSlots(ranking){
  if(chartSlots){
    // Players who were deleted meanwhile drop out
    [...chartSlots.keys()].forEach(id=>{ if(!ranking.some(r=>r.id===id)) chartSlots.delete(id); });
    return chartSlots;
  }
  return new Map(ranking.slice(0, SERIES_SLOTS).map((r, i)=>[r.id, i+1]));
}
// The rating after each match of the period; x = number of matches played in
// the period so far (0 = before the first one)
function ratingSeries(playerRating, matches, slot){
  const index = new Map(matches.map((m, i)=>[m.id, i+1]));
  const entries = playerRating.timeline.filter(e=>index.has(e.matchId));
  const start = entries.length ? entries[0].rating - entries[0].delta : playerRating.overall;
  // A rating only moves in the player's own matches: hold it level up to the
  // match before, so a pause doesn't look like a slow climb or decline.
  const points = [{ x:0, y:start }];
  entries.forEach(e=>{
    const x = index.get(e.matchId), last = points[points.length-1];
    if(x - 1 > last.x) points.push({ x:x-1, y:last.y });
    points.push({ x, y:e.rating });
  });
  return { slot, points };
}
function chartHTML(series, matches, label){
  return lineChartSVG({
    series,
    xMax: matches.length,
    xLabels: [formatDay(matches[0].timestamp), formatDay(matches[matches.length-1].timestamp)],
    label
  });
}
function chartSectionHTML({ ranking, ratings, matches }){
  const slots = currentChartSlots(ranking);
  const series = [...slots].map(([id, slot])=>ratingSeries(ratings.players.get(id), matches, slot));
  return `
    <div class="section-title">Elo-Verlauf · ${periodLabel()}</div>
    <div class="card">
      <div class="legend" role="group" aria-label="Spieler im Diagramm">
        ${ranking.map(r=>{
          const slot = slots.get(r.id);
          return `<button class="legend-chip ${slot?'on':''}" data-chart-player="${r.id}" aria-pressed="${!!slot}">${slot ? `<span class="key s${slot}"></span>` : ''}${name(r.id)}</button>`;
        }).join('')}
      </div>
      ${series.length ? `
        ${chartHTML(series, matches, 'Elo-Verlauf der ausgewählten Spieler')}
        <div class="chart-readout" id="chartReadout"></div>
      ` : `<p class="note">Wählt oben bis zu ${SERIES_SLOTS} Spieler aus.</p>`}
    </div>`;
}
// The readout under a chart: every series' value at the crosshair. Built with
// textContent, names are user input.
function fillReadout(box, x, matches, rows){
  box.textContent = '';
  const head = document.createElement('div');
  head.className = 'readout-head';
  head.textContent = x===0
    ? 'Vor dem ersten Spiel im Zeitraum'
    : `Nach Spiel ${x} von ${matches.length} · ${formatDay(matches[x-1].timestamp)}`;
  box.appendChild(head);
  rows.slice().sort((a,b)=>valueAt(b.points, x) - valueAt(a.points, x)).forEach(row=>{
    const line = document.createElement('div');
    line.className = 'readout-row';
    const key = document.createElement('span');
    key.className = 'key s' + row.slot;
    const value = document.createElement('b');
    value.textContent = round(valueAt(row.points, x));
    const label = document.createElement('span');
    label.textContent = row.name;
    line.append(key, value, label);
    box.appendChild(line);
  });
}
function attachChart(root, readoutId, matches, rows){
  const svg = root.querySelector('svg.chart');
  const box = root.querySelector('#' + readoutId);
  if(!svg || !box) return;
  fillReadout(box, matches.length, matches, rows);
  attachLineChart(svg, x=>fillReadout(box, x, matches, rows));
}

/* ---------- Duos ---------- */
function duosHTML({ ratings, stats, known }){
  const duos = [...ratings.pairs.values()]
    .filter(p=>p.games >= MIN_GAMES_PAIR && p.ids.every(known))
    .sort((a,b)=>b.rating - a.rating);
  if(!duos.length){
    return `
      <div class="section-title">Duos</div>
      <p class="note">Noch kein Duo mit mindestens ${MIN_GAMES_PAIR} gewerteten gemeinsamen Spielen.</p>`;
  }
  const shown = duosExpanded ? duos : duos.slice(0, DUOS_SHORT);
  return `
    <div class="section-title">Duos · Elo als Team</div>
    ${shown.map(p=>{
      const partners = stats.players.get(p.ids[0]);
      const r = partners && partners.partners.get(p.ids[1]);
      return `
        <div class="rank-row static">
          <span class="rank-main">
            <span class="rank-name">${name(p.ids[0])} + ${name(p.ids[1])}</span>
            ${r ? `
              <span class="rank-sub">${games(r.games)} · ${recordText(r)} · ${formatPercent(winRate(r))} Siege</span>
              ${recordBarHTML(r)}
            ` : `<span class="rank-sub">Kein gemeinsames Spiel in diesem Zeitraum</span>`}
          </span>
          <span class="rank-rating"><span class="rating">${round(p.rating)}</span></span>
        </div>`;
    }).join('')}
    ${duos.length > DUOS_SHORT ? `<button class="btn btn-ghost btn-small btn-block" data-duos-toggle>${duosExpanded ? 'Weniger anzeigen' : `Alle ${duos.length} Duos anzeigen`}</button>` : ''}`;
}

/* ---------- Win probability calculator ---------- */
function currentCalcIds(ranking){
  const active = activePlayers().map(p=>p.id);
  if(active.length < 4) return null;
  if(!calcIds || !calcIds.every(id=>active.includes(id))){
    // Start with the four best-rated active players, mixed into two even teams
    const order = [...ranking.filter(r=>!r.archived).map(r=>r.id), ...active].filter((id, i, all)=>all.indexOf(id)===i);
    calcIds = [order[0], order[3], order[1], order[2]];
  }
  return calcIds;
}
function calculatorHTML({ ranking, ratings }){
  const ids = currentCalcIds(ranking);
  if(!ids) return '';
  const options = activePlayers().slice().sort((a,b)=>a.name.localeCompare(b.name, 'de'));
  const picker = (i, label)=>`
    <select class="calc-select" data-calc="${i}" aria-label="${label}">
      ${options.map(p=>`<option value="${p.id}" ${p.id===ids[i]?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
    </select>`;
  const distinct = new Set(ids).size===4;
  const pA = distinct ? winProbability([ids[0], ids[1]], [ids[2], ids[3]], ratings) : null;
  const provisional = ids.some(id=>!ratings.players.has(id) || ratings.players.get(id).games < MIN_GAMES_RATED);
  return `
    <div class="section-title">Siegchance</div>
    <div class="card">
      <div class="calc-teams">
        <div class="calc-team"><div class="calc-label"><span class="key teamA"></span>Team A</div>${picker(0, 'Team A, erster Spieler')}${picker(1, 'Team A, zweiter Spieler')}</div>
        <div class="calc-team"><div class="calc-label"><span class="key teamB"></span>Team B</div>${picker(2, 'Team B, erster Spieler')}${picker(3, 'Team B, zweiter Spieler')}</div>
      </div>
      ${distinct ? `
        ${oddsHTML(pA)}
        ${provisional ? `<p class="note">Mindestens eine Wertung ist noch vorläufig – mit mehr Spielen wird die Schätzung genauer.</p>` : ''}
      ` : `<p class="note">Wählt vier verschiedene Spieler.</p>`}
    </div>`;
}
/* ---------- Table side and records ---------- */
function teamNames(m, teamKey){
  return `${name(m[teamKey].tor)} / ${name(m[teamKey].sturm)}`;
}
function matchLine(m){
  return `<b>${m.score.teamA} : ${m.score.teamB}</b> · ${teamNames(m,'teamA')} gegen ${teamNames(m,'teamB')} · ${formatDay(m.timestamp)}`;
}
function sidesAndRecordsHTML({ stats, known }){
  const s = stats.sides, total = stats.totals.matches, rec = stats.records;
  const share = v=>formatPercent(v / total);
  const streak = rec.longestWinStreak && known(rec.longestWinStreak.id) ? rec.longestWinStreak : null;
  const row = (label, value)=>`<div class="fact"><span class="fact-label">${label}</span><span class="fact-value">${value}</span></div>`;
  return `
    <div class="section-title">Tischseite · ${periodLabel()}</div>
    <div class="card">
      ${segmentedBarHTML([
        { value:s.teamA, cls:'teamA', title:`Seite von Team A: ${s.teamA}` },
        { value:s.draw, cls:'neutral', title:`Unentschieden: ${s.draw}` },
        { value:s.teamB, cls:'teamB', title:`Seite von Team B: ${s.teamB}` }
      ], `Siege nach Tischseite: Team A ${s.teamA}, Unentschieden ${s.draw}, Team B ${s.teamB}`)}
      <div class="seg-legend">
        <span><span class="key teamA"></span>Seite A <b>${s.teamA}</b> (${share(s.teamA)})</span>
        <span><span class="key neutral"></span>Unentschieden <b>${s.draw}</b></span>
        <span><span class="key teamB"></span>Seite B <b>${s.teamB}</b> (${share(s.teamB)})</span>
      </div>
      <p class="note">Team A steht immer auf derselben Seite des Tischs. Liegt eine Seite auf Dauer klar vorn, lohnt ein Blick auf den Tisch.</p>
    </div>
    <div class="section-title">Rekorde · ${periodLabel()}</div>
    <div class="card facts">
      ${rec.biggestWin ? row('Höchster Sieg', matchLine(rec.biggestWin.match)) : ''}
      ${rec.mostGoals ? row('Meiste Tore', matchLine(rec.mostGoals.match)) : ''}
      ${row('Siege zu null', rec.cleanSheets)}
      ${streak ? row('Längste Siegesserie', `${name(streak.id)} · ${plural(streak.length, 'Sieg', 'Siege')} in Folge`) : ''}
    </div>`;
}

/* ---------- Player sheet ---------- */
function relationLine(label, entry){
  if(!entry) return '';
  const r = entry.record;
  return `<div class="fact"><span class="fact-label">${label}</span><span class="fact-value"><b>${name(entry.id)}</b> · ${games(r.games)} · ${recordText(r)}</span></div>`;
}
function openPlayerSheet(id, data){
  const { ratings, stats, matches, known } = data;
  const rating = ratings.players.get(id);
  const r = stats.players.get(id);
  const posRating = (value, n)=>n >= MIN_GAMES_POSITION ? round(value) : '–';
  const posRow = (label, rec, ratingText)=>`
    <tr>
      <th scope="row">${label}</th>
      <td>${ratingText}</td>
      <td>${rec.games}</td>
      <td>${rec.games ? formatPercent(winRate(rec)) : '–'}</td>
      <td>${rec.games ? decimal(rec.goalsFor / rec.games) + ' : ' + decimal(rec.goalsAgainst / rec.games) : '–'}</td>
    </tr>`;
  let body = `<p class="note">Kein gewertetes Spiel in diesem Zeitraum.</p>`;
  if(r){
    const streak = currentStreak(r.results);
    const partners = bestAndWorst(r.partners, known);
    const opponents = bestAndWorst(r.opponents, known);
    const series = ratingSeries(rating, matches, 1);
    body = `
      <div class="section-title">Elo-Verlauf · ${periodLabel()}</div>
      ${chartHTML([series], matches, 'Elo-Verlauf von ' + name(id))}
      <div class="chart-readout" id="sheetReadout"></div>

      <div class="section-title">Bilanz · ${periodLabel()}</div>
      <div class="rank-sub">${games(r.games)} · ${recordText(r)} · ${formatPercent(winRate(r))} Siege</div>
      ${recordBarHTML(r)}
      <div class="form-row">
        <span class="fact-label">Letzte Spiele</span>
        <span class="form">${form(r.results).map(x=>`<span class="form-badge ${x}" title="${RESULT_WORD[x][0]}">${RESULT_LETTER[x]}</span>`).join('')}</span>
        <span class="rank-sub">${streak.length > 1 ? `${streak.length} ${RESULT_WORD[streak.result][1]} in Folge` : ''}</span>
      </div>

      <div class="section-title">Nach Position</div>
      <table class="pos-table">
        <thead><tr><th></th><th scope="col">Elo</th><th scope="col">Spiele</th><th scope="col">Siege</th><th scope="col">Ø Tore</th></tr></thead>
        <tbody>
          ${posRow('Tor', r.byPos.tor, posRating(rating.tor, rating.gamesTor))}
          ${posRow('Sturm', r.byPos.sturm, posRating(rating.sturm, rating.gamesSturm))}
          ${r.byPos.mixed.games ? posRow('Gemischt', r.byPos.mixed, '–') : ''}
        </tbody>
      </table>
      <p class="note">Elo je Position ab ${MIN_GAMES_POSITION} gewerteten Spielen auf der Position, über alle Spiele gerechnet. Ø Tore: eigenes Team : Gegner.</p>

      ${partners.best || opponents.best ? `<div class="section-title">Mit und gegen · ${periodLabel()}</div>` : ''}
      <div class="facts">
        ${relationLine('Bester Partner', partners.best)}
        ${relationLine('Schwierigster Partner', partners.worst)}
        ${relationLine('Lieblingsgegner', opponents.best)}
        ${relationLine('Angstgegner', opponents.worst)}
      </div>`;
  }
  const sheet = showSheet(`
    <h3>${name(id)}</h3>
    <div class="tiles three">
      ${tile(rating.games < MIN_GAMES_RATED ? 'Elo vorläufig' : 'Elo gesamt', round(rating.overall))}
      ${tile('Elo Tor', posRating(rating.tor, rating.gamesTor))}
      ${tile('Elo Sturm', posRating(rating.sturm, rating.gamesSturm))}
    </div>
    ${body}
    <div class="sheet-actions spaced"><button class="btn btn-secondary btn-block" data-sheet="close">Schließen</button></div>
  `);
  sheet.querySelector('[data-sheet="close"]').addEventListener('click', hideSheet);
  if(r) attachChart(sheet, 'sheetReadout', matches, [{ slot:1, name:playerName(id), points:ratingSeries(rating, matches, 1).points }]);
}

/* ---------- Handlers ---------- */
function attachHandlers(el, data){
  el.querySelectorAll('[data-period]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ period = btn.getAttribute('data-period'); renderStats(); });
  });
  el.querySelectorAll('[data-player]').forEach(btn=>{
    btn.addEventListener('click', ()=>openPlayerSheet(btn.getAttribute('data-player'), data));
  });
  el.querySelectorAll('[data-chart-player]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-chart-player');
      const slots = new Map(currentChartSlots(data.ranking));
      if(slots.has(id)) slots.delete(id);
      else if(slots.size >= SERIES_SLOTS){ showToast(`Höchstens ${SERIES_SLOTS} Spieler gleichzeitig`); return; }
      else {
        const used = new Set(slots.values());
        let slot = 1;
        while(used.has(slot)) slot++;
        slots.set(id, slot);
      }
      chartSlots = slots;
      renderStats();
    });
  });
  const duosToggle = el.querySelector('[data-duos-toggle]');
  if(duosToggle) duosToggle.addEventListener('click', ()=>{ duosExpanded = !duosExpanded; renderStats(); });
  el.querySelectorAll('[data-calc]').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      calcIds[Number(sel.getAttribute('data-calc'))] = sel.value;
      renderStats();
    });
  });
  if(data.matches.length){
    const slots = currentChartSlots(data.ranking);
    attachChart(el, 'chartReadout', data.matches, [...slots].map(([id, slot])=>({
      slot, name:playerName(id), points:ratingSeries(data.ratings.players.get(id), data.matches, slot).points
    })));
  }
}
