import {
  LADDER, rungById, auditPath, conceptsFor,
} from './ladder.mjs';
import { simulate } from './sims.mjs';
import { EXAMPLE_IN_ORDER, EXAMPLE_SKIP_RUNGS } from './examples.mjs';

const completed = new Set();
let selectedId = null;
let simState = null; // { without: result, with: result, index }

const $ = sel => document.querySelector(sel);
const ladderEl = $('#ladder');
const auditEl = $('#audit');

function renderLadder() {
  const have = conceptsFor([...completed]);
  ladderEl.innerHTML = '';
  for (const r of LADDER) {
    const done = completed.has(r.id);
    // A rung is "locked" when it is not completed and its requires aren't met.
    const isLocked = !done && !(r.requires || []).every(n => have.has(n)) && completed.size > 0;
    const row = document.createElement('div');
    row.className = 'rung'
      + (done ? ' done' : '')
      + (isLocked ? ' locked' : '')
      + (selectedId === r.id ? ' selected' : '');
    row.setAttribute('role', 'listitem');
    row.style.marginLeft = `${(r.rung - 1) * 18}px`;
    row.innerHTML = `
      <span class="num">${r.rung}</span>
      <span class="names"><b>${r.project}</b><span>${r.concept}${isLocked ? ' — locked: needs ' + r.requires.filter(n => !have.has(n)).join(', ') : ''}</span></span>
      <input type="checkbox" ${done ? 'checked' : ''} aria-label="mark ${r.project} completed">
    `;
    row.querySelector('input').addEventListener('click', e => e.stopPropagation());
    row.querySelector('input').addEventListener('change', e => {
      e.target.checked ? completed.add(r.id) : completed.delete(r.id);
      renderAll();
    });
    row.addEventListener('click', () => { selectedId = r.id; simState = null; renderAll(); });
    ladderEl.appendChild(row);
  }
}

function renderAudit() {
  if (completed.size === 0) {
    auditEl.innerHTML = 'Tick rungs you have built — the audit flags prerequisites you skipped.';
    return;
  }
  const audit = auditPath([...completed]);
  const gaps = audit.gaps.filter(g => g.missing.length > 0);
  let html = `<p><b>${audit.completed.length}</b> rung(s) completed. `;
  html += audit.clean
    ? '<span class="ok">No skipped lessons.</span>'
    : `<span class="gap">${gaps.length} rung(s) built on missing concepts:</span>`;
  html += '</p>';
  if (gaps.length) {
    html += '<ul>' + gaps.map(g => {
      const r = rungById(g.rung);
      return `<li class="gap"><b>${r ? r.project : g.rung}</b> assumes <code>${g.missing.join('</code>, <code>')}</code> — go back to: ${g.missingRungs.map(id => rungById(id)?.project || id).join(', ')}</li>`;
    }).join('') + '</ul>';
  }
  if (audit.next) {
    const n = rungById(audit.next);
    html += `<p>Next rung unlocked: <b>${n.rung}. ${n.project}</b> — ${n.concept}.</p>`;
  } else if (audit.complete) {
    html += '<p class="ok">Ladder complete.</p>';
  } else {
    html += '<p>No rung unlocked — finish the prerequisites above first.</p>';
  }
  auditEl.innerHTML = html;
}

function renderDetail() {
  const title = $('#detail-title');
  const body = $('#detail-body');
  const controls = $('#sim-controls');
  const view = $('#sim-view');
  view.innerHTML = '';
  $('#sim-step').disabled = true;
  if (!selectedId) {
    title.textContent = 'Select a rung';
    body.className = 'detail-empty';
    body.textContent = 'Click a rung on the ladder to see the concept it forces and the failure it prevents.';
    controls.classList.add('hidden');
    return;
  }
  const r = rungById(selectedId);
  title.textContent = `Rung ${r.rung} — ${r.project}`;
  body.className = 'detail-card';
  body.innerHTML = `
    <div>Concept it forces: <span class="concept">${r.concept}</span></div>
    <dl>
      <dt>What it teaches</dt><dd>${r.teaches}</dd>
      <dt>What breaks without it</dt><dd>${r.failureWithout}</dd>
      <dt>Prerequisites</dt><dd>${r.requires.length ? r.requires.map(n => '<code>' + n + '</code>').join(' ') : 'none — the first rung'}</dd>
    </dl>`;
  controls.classList.remove('hidden');
}

function renderSim() {
  const view = $('#sim-view');
  if (!simState) { view.innerHTML = ''; return; }
  const cols = [['without', simState.without], ['with', simState.with]];
  view.innerHTML = cols.map(([mode, res]) => {
    const steps = res.steps.slice(0, simState.index)
      .map(s => `<li><b>${s.label}</b><span class="events">${s.events.join('<br>')}</span></li>`).join('');
    const done = simState.index >= res.steps.length;
    const verdict = done ? `<div class="verdict ${res.outcome}">${res.outcome === 'failed' ? 'FAILS' : 'HOLDS'} — ${res.summary}</div>` : '';
    return `<div class="sim-col ${mode}"><h3>${mode === 'without' ? 'Without' : 'With'} ${simState.concept}</h3><ol>${steps}</ol>${verdict}</div>`;
  }).join('');
  $('#sim-step').disabled = simState.index >= Math.max(simState.without.steps.length, simState.with.steps.length);
}

$('#run-sim').addEventListener('click', () => {
  if (!selectedId) return;
  const r = rungById(selectedId);
  simState = {
    concept: r.concept,
    without: simulate(r.sim, 'without'),
    with: simulate(r.sim, 'with'),
    index: 1,
  };
  renderSim();
});
$('#sim-step').addEventListener('click', () => {
  if (!simState) return;
  simState.index += 1;
  renderSim();
});
$('#load-in-order').addEventListener('click', () => {
  completed.clear(); EXAMPLE_IN_ORDER.completed.forEach(id => completed.add(id)); renderAll();
});
$('#load-skip').addEventListener('click', () => {
  completed.clear(); EXAMPLE_SKIP_RUNGS.completed.forEach(id => completed.add(id)); renderAll();
});
$('#clear-path').addEventListener('click', () => { completed.clear(); renderAll(); });

function renderAll() { renderLadder(); renderAudit(); renderDetail(); renderSim(); }
renderAll();
