/* Vorm — gewicht en lichaamsmaten. Alles lokaal (localStorage). */
(() => {
  'use strict';

  const STORE_KEY = 'vorm:v1';

  // dir: -1 = lager is beter, 1 = hoger is beter, 0 = neutraal
  const METRICS = [
    { key: 'weight',    label: 'Gewicht',        unit: 'kg', dir: -1, group: 'Lichaam' },
    { key: 'muscle',    label: 'Spiermassa',     unit: 'kg', dir: 1,  group: 'Lichaam' },
    { key: 'neck',      label: 'Nek',            unit: 'cm', dir: 0,  group: 'Omtrek' },
    { key: 'shoulders', label: 'Schouders',      unit: 'cm', dir: 1,  group: 'Omtrek' },
    { key: 'chest',     label: 'Borst',          unit: 'cm', dir: 0,  group: 'Omtrek' },
    { key: 'waist',     label: 'Taille',         unit: 'cm', dir: -1, group: 'Omtrek' },
    { key: 'belly',     label: 'Buik (navel)',   unit: 'cm', dir: -1, group: 'Omtrek' },
    { key: 'hips',      label: 'Heupen',         unit: 'cm', dir: -1, group: 'Omtrek' },
    { key: 'armL',      label: 'Bovenarm L',     unit: 'cm', dir: 1,  group: 'Armen & benen' },
    { key: 'armR',      label: 'Bovenarm R',     unit: 'cm', dir: 1,  group: 'Armen & benen' },
    { key: 'forearmL',  label: 'Onderarm L',     unit: 'cm', dir: 1,  group: 'Armen & benen' },
    { key: 'forearmR',  label: 'Onderarm R',     unit: 'cm', dir: 1,  group: 'Armen & benen' },
    { key: 'thighL',    label: 'Dij L',          unit: 'cm', dir: 0,  group: 'Armen & benen' },
    { key: 'thighR',    label: 'Dij R',          unit: 'cm', dir: 0,  group: 'Armen & benen' },
    { key: 'calfL',     label: 'Kuit L',         unit: 'cm', dir: 0,  group: 'Armen & benen' },
    { key: 'calfR',     label: 'Kuit R',         unit: 'cm', dir: 0,  group: 'Armen & benen' },
  ];
  const M = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  const TAPE = METRICS.filter((m) => m.unit === 'cm');

  const RANGES = [
    { key: '1m', label: '1M', days: 31 },
    { key: '3m', label: '3M', days: 92 },
    { key: '6m', label: '6M', days: 183 },
    { key: '1y', label: '1J', days: 366 },
    { key: 'all', label: 'Alles', days: Infinity },
  ];

  const TITLES = { overview: 'Overzicht', compare: 'Vergelijk', settings: 'Instellingen' };

  /* ---------------- Helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const nfCache = {};
  const nf = (d) => (nfCache[d] ||= new Intl.NumberFormat('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : nf(d).format(n));
  const fmtSigned = (n, d = 1) => {
    const r = Number(n.toFixed(d));
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + fmt(Math.abs(r), d);
  };
  const DF_LONG = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  const DF_SHORT = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' });
  const DF_MONTH = new Intl.DateTimeFormat('nl-BE', { month: 'short', year: '2-digit' });
  const DF_WEEKDAY = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
  const toDate = (iso) => new Date(iso + 'T12:00:00');
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  const fmtDate = (iso) => DF_LONG.format(toDate(iso));
  const fmtShort = (iso) => DF_SHORT.format(toDate(iso));
  const parseNum = (s) => {
    if (s == null) return null;
    const t = String(s).trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const chev = '<svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="m1 1 6 6-6 6"/></svg>';

  /* ---------------- State ---------------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.entries)) return normalize(s);
    } catch { /* leeg of corrupt */ }
    return { entries: [], settings: {} };
  }
  function normalize(s) {
    return {
      entries: (s.entries || []).filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map((e) => ({
        id: e.id || uid(), date: e.date, note: e.note || '', values: e.values || {},
      })),
      settings: s.settings || {},
    };
  }
  let state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch { toast('Opslaan mislukt: opslag vol of geblokkeerd'); }
  }

  const ui = { view: 'overview', metric: 'weight', range: 'all', cmpA: null, cmpB: null };
  try { Object.assign(ui, JSON.parse(sessionStorage.getItem('vorm:ui')) || {}); } catch { /* ok */ }
  const saveUi = () => { try { sessionStorage.setItem('vorm:ui', JSON.stringify(ui)); } catch { /* ok */ } };

  const entriesAsc = () => [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
  const series = (key) => entriesAsc().filter((e) => e.values[key] != null).map((e) => ({ date: e.date, value: e.values[key] }));
  const metricsWithData = () => METRICS.filter((m) => state.entries.some((e) => e.values[m.key] != null));
  function valueAt(key, date) {
    let r = null;
    for (const e of entriesAsc()) {
      if (e.date > date) break;
      if (e.values[key] != null) r = { value: e.values[key], date: e.date };
    }
    return r;
  }
  function lastValue(key) { const s = series(key); return s.length ? s[s.length - 1] : null; }

  function trend(m, d) {
    if (d == null || Math.abs(d) < 0.05) return 'flat';
    if (!m.dir) return 'neutral';
    return Math.sign(d) === m.dir ? 'good' : 'bad';
  }
  function deltaHTML(m, d, digits = 1, withUnit = true) {
    if (d == null) return '<span class="delta delta--flat">—</span>';
    const t = trend(m, d);
    const arrow = t === 'flat' ? '' : `<span class="delta__arrow" aria-hidden="true">${d > 0 ? '▲' : '▼'}</span>`;
    const sr = t === 'good' ? ' (goed)' : t === 'bad' ? ' (slechter)' : '';
    return `<span class="delta delta--${t}">${arrow}${fmtSigned(d, digits)}${withUnit ? ' ' + m.unit : ''}<span class="sr">${sr}</span></span>`;
  }

  /* ---------------- Chart ---------------- */
  function niceTicks(min, max, count = 4) {
    if (min === max) { min -= 1; max += 1; }
    const raw = (max - min) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
    return { lo, hi, ticks, step };
  }

  function lineChart(el, pts, opt = {}) {
    const { unit = '', digits = 1, goal = null, height = 210, label = '' } = opt;
    el.innerHTML = '';
    if (!pts.length) { el.innerHTML = '<p class="chart__empty">Nog geen gegevens in deze periode.</p>'; return; }

    const W = Math.max(260, Math.round(el.clientWidth || 320));
    const H = height;
    const pad = { t: 22, r: 14, b: 26, l: 40 };
    const ts = pts.map((p) => toDate(p.date).getTime());
    let x0 = ts[0], x1 = ts[ts.length - 1];
    if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
    const vals = pts.map((p) => p.value);
    if (goal != null) vals.push(goal);
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const pv = (vmax - vmin) * 0.12 || Math.max(0.5, Math.abs(vmax) * 0.02);
    const { lo, hi, ticks, step } = niceTicks(vmin - pv, vmax + pv, 4);
    const tickDigits = Math.max(0, Math.min(2, -Math.floor(Math.log10(step))));
    const X = (t) => pad.l + ((t - x0) / (x1 - x0)) * (W - pad.l - pad.r);
    const Y = (v) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);

    const spanDays = (x1 - x0) / 864e5;
    const xFmt = (t) => (spanDays > 200 ? DF_MONTH : DF_SHORT).format(new Date(t));

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}: ${pts.length} metingen, laatste ${fmt(vals[pts.length - 1], digits)} ${unit}">`;
    for (const t of ticks) {
      const y = Y(t).toFixed(1);
      svg += `<line class="chart__grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>`;
      svg += `<text class="chart__axis" x="${pad.l - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${fmt(t, tickDigits)}</text>`;
    }
    svg += `<text class="chart__axis" x="${pad.l}" y="${H - 6}" text-anchor="start">${xFmt(x0)}</text>`;
    svg += `<text class="chart__axis" x="${W - pad.r}" y="${H - 6}" text-anchor="end">${xFmt(x1)}</text>`;

    if (goal != null) {
      const gy = Y(goal).toFixed(1);
      svg += `<line class="chart__goal" x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}"/>`;
      svg += `<text class="chart__goal-label" x="${pad.l + 6}" y="${Number(gy) - 6}">Doel ${fmt(goal, digits)}</text>`;
    }

    const coords = pts.map((p, i) => [X(ts[i]), Y(p.value)]);
    const d = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    if (coords.length > 1) {
      const area = `${d}L${coords[coords.length - 1][0].toFixed(1)} ${H - pad.b}L${coords[0][0].toFixed(1)} ${H - pad.b}Z`;
      svg += `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
      svg += `<path d="${area}" fill="url(#${gid})"/>`;
      svg += `<path class="chart__line" d="${d}"/>`;
    }
    const [lx, ly] = coords[coords.length - 1];
    svg += `<circle class="chart__dot" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5"/>`;
    svg += `<text class="chart__last" x="${Math.min(lx, W - pad.r).toFixed(1)}" y="${(ly - 11).toFixed(1)}" text-anchor="${lx > W - 60 ? 'end' : 'middle'}">${fmt(pts[pts.length - 1].value, digits)}</text>`;
    svg += `<g class="chart__hover" visibility="hidden"><line class="chart__cross" y1="${pad.t}" y2="${H - pad.b}"/><circle class="chart__dot" r="5"/></g>`;
    svg += `<rect x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>`;
    svg += '</svg>';
    el.innerHTML = svg + '<div class="chart__tip"></div>';

    const svgEl = el.firstElementChild;
    const hover = svgEl.querySelector('.chart__hover');
    const cross = hover.firstElementChild;
    const dot = hover.lastElementChild;
    const tip = el.lastElementChild;

    const show = (ev) => {
      const rect = svgEl.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      let best = 0;
      for (let i = 1; i < coords.length; i++) if (Math.abs(coords[i][0] - px) < Math.abs(coords[best][0] - px)) best = i;
      const [cx, cy] = coords[best];
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
      hover.setAttribute('visibility', 'visible');
      tip.innerHTML = `<strong>${fmt(pts[best].value, digits)} ${esc(unit)}</strong>${fmtDate(pts[best].date)}`;
      const scale = rect.width / W;
      const tw = tip.offsetWidth;
      const left = Math.max(0, Math.min(rect.width - tw, cx * scale - tw / 2));
      tip.style.left = left + 'px';
      tip.style.top = Math.max(-8, cy * scale - tip.offsetHeight - 14) + 'px';
      tip.classList.add('is-on');
    };
    const hide = () => { hover.setAttribute('visibility', 'hidden'); tip.classList.remove('is-on'); };
    svgEl.addEventListener('pointermove', show);
    svgEl.addEventListener('pointerdown', show);
    svgEl.addEventListener('pointerleave', hide);
    svgEl.addEventListener('pointercancel', hide);
  }

  /* ---------------- Views ---------------- */
  const viewEl = (name) => $(`.view[data-view="${name}"]`);

  function emptyState(title, text, action, label) {
    return `<div class="card empty"><h2>${title}</h2><p>${text}</p>${action ? `<button class="button button--primary" data-action="${action}">${label}</button>` : ''}</div>`;
  }

  function renderOverview() {
    const el = viewEl('overview');
    if (!state.entries.length) {
      el.innerHTML = emptyState('Begin met meten', 'Voeg je eerste meting toe: gewicht, en als je wil een paar omtrekken met een meetlint.', 'add-measure', 'Eerste meting toevoegen');
      return;
    }
    const s = state.settings;
    const w = series('weight');
    let hero = '';
    if (w.length) {
      const first = w[0], last = w[w.length - 1];
      const ref30 = valueAt('weight', addDays(last.date, -30));
      const d30 = ref30 && ref30.date !== last.date ? last.value - ref30.value : null;
      const ref7 = valueAt('weight', addDays(last.date, -7));
      const d7 = ref7 && ref7.date !== last.date ? last.value - ref7.value : null;
      let goal = '';
      if (s.goalWeight && first.value !== s.goalWeight) {
        const total = first.value - s.goalWeight;
        const done = first.value - last.value;
        const pct = Math.max(0, Math.min(1, done / total));
        const left = last.value - s.goalWeight;
        const reached = Math.sign(left) !== Math.sign(total) || Math.abs(left) < 0.05;
        goal = `<div class="progress">
          <div class="progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="Voortgang naar streefgewicht"><span style="width:${pct * 100}%"></span></div>
          <div class="progress__text"><span>${reached ? 'Doel bereikt 🎉' : `Nog ${fmt(Math.abs(left))} kg tot ${fmt(s.goalWeight)} kg`}</span><span>${Math.round(pct * 100)}%</span></div>
        </div>`;
      }
      hero = `<div class="card">
        <p class="eyebrow">Gewicht · ${fmtDate(last.date)}</p>
        <p class="hero__value">${fmt(last.value)}<small>kg</small></p>
        <div class="stats">
          <div class="stat"><span class="stat__label">Sinds start</span><span class="stat__value">${w.length > 1 ? deltaHTML(M.weight, last.value - first.value) : '—'}</span></div>
          <div class="stat"><span class="stat__label">7 dagen</span><span class="stat__value">${d7 != null ? deltaHTML(M.weight, d7) : '—'}</span></div>
          <div class="stat"><span class="stat__label">30 dagen</span><span class="stat__value">${d30 != null ? deltaHTML(M.weight, d30) : '—'}</span></div>
        </div>
        ${goal}
      </div>`;
    }

    const available = metricsWithData();
    if (!available.some((m) => m.key === ui.metric)) ui.metric = available[0].key;
    const m = M[ui.metric];

    const tape = tapeTotal();
    const cards = available.map((mm) => {
      const sr = series(mm.key);
      const last = sr[sr.length - 1];
      const d = sr.length > 1 ? last.value - sr[0].value : null;
      return `<button class="metric" data-metric="${mm.key}" aria-pressed="${mm.key === ui.metric}">
        <span class="metric__label">${mm.label}</span>
        <span class="metric__value">${fmt(last.value)}<small>${mm.unit}</small></span>
        ${deltaHTML(mm, d)}
      </button>`;
    }).join('');

    el.innerHTML = `${hero}
      <div class="card">
        <div class="card__head">
          <select class="select" id="metricSelect" aria-label="Kies een maat">
            ${available.map((mm) => `<option value="${mm.key}" ${mm.key === ui.metric ? 'selected' : ''}>${mm.label}</option>`).join('')}
          </select>
          <div class="segmented" role="group" aria-label="Periode">
            ${RANGES.map((r) => `<button type="button" data-range="${r.key}" aria-pressed="${r.key === ui.range}">${r.label}</button>`).join('')}
          </div>
        </div>
        <div class="chart" id="mainChart"></div>
      </div>
      ${tape ? `<div class="card"><p class="eyebrow">Totale omtrek (${plural(tape.count, 'maat', 'maten')}, eerste → laatste meting)</p>
        <p class="hero__value" style="font-size:40px;margin:6px 0 0">${deltaHTML({ dir: -1, unit: 'cm' }, tape.delta)}</p></div>` : ''}
      <h2 class="section-title">Alle maten · sinds start</h2>
      <div class="metric-grid">${cards}</div>
      ${logHTML()}
      <p class="hint" style="text-align:center">Tik op een meting om ze aan te passen of te verwijderen.</p>`;

    const range = RANGES.find((r) => r.key === ui.range) || RANGES[RANGES.length - 1];
    const from = range.days === Infinity ? '0000-00-00' : addDays(todayISO(), -range.days);
    const pts = series(m.key).filter((p) => p.date >= from);
    lineChart($('#mainChart'), pts, {
      unit: m.unit, label: m.label,
      goal: m.key === 'weight' && s.goalWeight ? s.goalWeight : null,
    });
  }

  // Som van omtrekken die zowel in de eerste als laatste meting met die maat voorkomen.
  function tapeTotal() {
    const entries = entriesAsc();
    if (entries.length < 2) return null;
    let delta = 0, count = 0;
    for (const m of TAPE) {
      const s = series(m.key);
      if (s.length < 2) continue;
      delta += s[s.length - 1].value - s[0].value;
      count++;
    }
    return count >= 2 ? { delta, count } : null;
  }

  function logHTML() {
    const desc = entriesAsc().reverse();
    const byYear = {};
    for (const e of desc) (byYear[e.date.slice(0, 4)] ||= []).push(e);
    return Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, list]) => `
      <h2 class="section-title" id="${year === desc[0].date.slice(0, 4) ? 'metingen' : ''}">Metingen ${year} · ${list.length}</h2>
      <div class="list">${list.map((e) => {
        const n = Object.keys(e.values).filter((k) => e.values[k] != null).length;
        const wv = e.values.weight;
        const sub = [plural(n, 'waarde', 'waarden'), e.note].filter(Boolean).map(esc).join(' · ');
        return `<button class="list__item" data-edit-entry="${e.id}">
          <div class="list__main"><div class="list__title">${esc(DF_WEEKDAY.format(toDate(e.date)))}</div><div class="list__sub">${sub}</div></div>
          <div class="list__end">${wv != null ? fmt(wv) + ' kg' : ''}</div>${chev}
        </button>`;
      }).join('')}</div>`).join('');
  }

  function renderCompare() {
    const el = viewEl('compare');
    const dates = entriesAsc().map((e) => e.date);
    if (dates.length < 2) {
      el.innerHTML = emptyState('Nog niets te vergelijken', 'Je hebt minstens twee metingen op verschillende datums nodig.', 'add-measure', 'Meting toevoegen');
      return;
    }
    if (!dates.includes(ui.cmpA)) ui.cmpA = dates[0];
    if (!dates.includes(ui.cmpB)) ui.cmpB = dates[dates.length - 1];
    const A = ui.cmpA, B = ui.cmpB;
    const opts = (sel) => [...dates].reverse().map((d) => `<option value="${d}" ${d === sel ? 'selected' : ''}>${fmtDate(d)}</option>`).join('');

    const rows = [];
    let tapeDelta = 0, tapeCount = 0;
    for (const m of METRICS) {
      const a = valueAt(m.key, A), b = valueAt(m.key, B);
      if (!a && !b) continue;
      const d = a && b ? b.value - a.value : null;
      if (d != null && m.unit === 'cm') { tapeDelta += d; tapeCount++; }
      const cell = (v, at) => v ? `${fmt(v.value)}${v.date !== at ? `<span class="stale">${fmtShort(v.date)}</span>` : ''}` : '—';
      rows.push(`<tr><th scope="row">${m.label} <span class="unit">${m.unit}</span></th><td>${cell(a, A)}</td><td>${cell(b, B)}</td><td>${deltaHTML(m, d, 1, false)}</td></tr>`);
    }
    const wa = valueAt('weight', A), wb = valueAt('weight', B);
    const days = daysBetween(A, B);
    const weeks = Math.abs(days) / 7;
    const perWeek = wa && wb && weeks >= 1 ? (wb.value - wa.value) / weeks : null;

    el.innerHTML = `
      <div class="card">
        <div class="compare-pick">
          <label class="field"><span class="field__label">Van</span><select class="select" id="cmpA">${opts(A)}</select></label>
          <span class="compare-pick__arrow" aria-hidden="true">→</span>
          <label class="field"><span class="field__label">Tot</span><select class="select" id="cmpB">${opts(B)}</select></label>
        </div>
      </div>
      <div class="compare-head">
        <div class="stat"><span class="stat__label">Periode</span><span class="stat__value">${plural(Math.abs(days), 'dag', 'dagen')}</span></div>
        <div class="stat"><span class="stat__label">Gewicht</span><span class="stat__value">${wa && wb ? deltaHTML(M.weight, wb.value - wa.value) : '—'}</span></div>
        <div class="stat"><span class="stat__label">${perWeek != null ? 'Per week' : 'Omtrek'}</span><span class="stat__value">${perWeek != null ? deltaHTML(M.weight, perWeek, 2) : tapeCount ? deltaHTML({ dir: -1, unit: 'cm' }, tapeDelta) : '—'}</span></div>
      </div>
      ${perWeek != null && tapeCount ? `<div class="stat"><span class="stat__label">Totale omtrek (${plural(tapeCount, 'maat', 'maten')})</span><span class="stat__value">${deltaHTML({ dir: -1, unit: 'cm' }, tapeDelta)}</span></div>` : ''}
      <div class="card">
        <table class="table">
          <thead><tr><th scope="col">Maat</th><th scope="col">${fmtShort(A)}</th><th scope="col">${fmtShort(B)}</th><th scope="col">Verschil</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p class="hint">Een kleine datum onder een waarde betekent dat die maat op die dag niet gemeten is; dan staat de meest recente meting ervoor.</p>`;
  }

  /* ---------------- Thema ---------------- */
  const ACCENTS = [
    { key: 'blauw', label: 'Blauw', dark: '#8ab4ff', light: '#2f6fe4' },
    { key: 'mint', label: 'Mint', dark: '#5eead4', light: '#0f766e' },
    { key: 'lime', label: 'Lime', dark: '#c6f36b', light: '#4d7c0f' },
    { key: 'oranje', label: 'Oranje', dark: '#fdba74', light: '#c2410c' },
    { key: 'roze', label: 'Roze', dark: '#f9a8d4', light: '#be185d' },
    { key: 'paars', label: 'Paars', dark: '#c4b5fd', light: '#6d28d9' },
  ];
  const MODES = [{ key: 'system', label: 'Automatisch' }, { key: 'dark', label: 'Donker' }, { key: 'light', label: 'Licht' }];
  const themeOf = () => ({ mode: 'system', accent: 'blauw', ...(state.settings.theme || {}) });
  function applyTheme() {
    const t = themeOf();
    const root = document.documentElement;
    root.dataset.accent = t.accent;
    if (t.mode === 'system') delete root.dataset.mode; else root.dataset.mode = t.mode;
    try { localStorage.setItem('vorm:theme', JSON.stringify(t)); } catch { /* ok */ }
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', bg);
  }
  function themeHTML() {
    const t = themeOf();
    return `<div class="card">
      <h2 class="card__title" style="margin-bottom:14px">Thema</h2>
      <div class="segmented segmented--full" role="group" aria-label="Weergave">
        ${MODES.map((m) => `<button type="button" data-mode="${m.key}" aria-pressed="${m.key === t.mode}">${m.label}</button>`).join('')}
      </div>
      <div class="swatches" role="group" aria-label="Accentkleur">
        ${ACCENTS.map((a) => `<button type="button" class="swatch" data-accent="${a.key}" aria-pressed="${a.key === t.accent}" style="--sw-dark:${a.dark};--sw-light:${a.light}">
          <span class="swatch__dot" aria-hidden="true"></span><span class="swatch__label">${a.label}</span></button>`).join('')}
      </div>
    </div>`;
  }
  function setTheme(patch) {
    state.settings = { ...state.settings, theme: { ...themeOf(), ...patch } };
    save();
    applyTheme();
    render();
  }
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);

  /* ---------------- Settings ---------------- */
  function renderSettings() {
    const el = viewEl('settings');
    const s = state.settings;
    el.innerHTML = `
      <form class="card" id="settingsForm" novalidate>
        <h2 class="card__title" style="margin-bottom:14px">Profiel</h2>
        <label class="field"><span class="field__label">Streefgewicht <small>kg</small></span><input name="goalWeight" inputmode="decimal" value="${s.goalWeight ? fmt(s.goalWeight) : ''}" placeholder="75,0"></label>
        <button class="button button--primary" type="submit">Bewaar profiel</button>
      </form>

      ${themeHTML()}

      <div class="card">
        <h2 class="card__title" style="margin-bottom:6px">Back-up</h2>
        <p class="prose" style="margin-bottom:14px">Je gegevens staan alleen op dit toestel (${plural(state.entries.length, 'meting', 'metingen')}). Maak af en toe een back-up naar Bestanden of iCloud Drive.</p>
        <div class="button-row">
          <button class="button" data-action="export">Exporteer</button>
          <button class="button" data-action="import">Importeer</button>
        </div>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
      </div>

      <div class="card">
        <h2 class="card__title" style="margin-bottom:10px">Op je iPhone zetten</h2>
        <ol class="steps">
          <li>Open deze pagina in <strong>Safari</strong>.</li>
          <li>Tik op <strong>Deel</strong> (vierkant met pijl).</li>
          <li>Kies <strong>Zet op beginscherm</strong> en tik op <strong>Voeg toe</strong>.</li>
        </ol>
        <p class="hint" style="margin:12px 0 0">Daarna opent Vorm schermvullend, zonder Safari-balken, en werkt het ook offline.</p>
      </div>

      <div class="card">
        <h2 class="card__title" style="margin-bottom:10px">Gegevens</h2>
        <div class="button-row">
          <button class="button" data-action="demo">Demodata laden</button>
          <button class="button button--danger" data-action="wipe">Alles wissen</button>
        </div>
      </div>`;
  }

  const RENDER = { overview: renderOverview, compare: renderCompare, settings: renderSettings };

  function render() {
    if (!RENDER[ui.view]) ui.view = 'overview';
    for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== ui.view;
    for (const t of document.querySelectorAll('.tab')) {
      if (t.dataset.tab === ui.view) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    }
    $('#viewTitle').textContent = TITLES[ui.view];
    document.title = ui.view === 'overview' ? 'Vorm' : `${TITLES[ui.view]} · Vorm`;
    const fab = $('#fab');
    fab.hidden = ui.view === 'settings' || ui.view === 'compare';
    RENDER[ui.view]();
    saveUi();
  }

  function go(view) {
    if (!RENDER[view]) return;
    const same = ui.view === view;
    ui.view = view;
    render();
    if (!same) window.scrollTo(0, 0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- Measure sheet ---------------- */
  const measureSheet = $('#measureSheet');
  const measureForm = $('#measureForm');
  let editingEntry = null;

  function buildMeasureFields() {
    const groups = {};
    for (const m of METRICS) (groups[m.group] ||= []).push(m);
    $('#measureFields').innerHTML = Object.entries(groups).map(([g, list]) => `
      <fieldset class="fieldset"><legend>${g}</legend><div class="field-grid">
        ${list.map((m) => `<label class="field"><span class="field__label">${m.label} <small>${m.unit}</small></span>
          <input name="m_${m.key}" inputmode="decimal" autocomplete="off"></label>`).join('')}
      </div></fieldset>`).join('');
  }

  function openMeasure(entry = null) {
    editingEntry = entry;
    measureForm.reset();
    $('#measureTitle').textContent = entry ? 'Meting bewerken' : 'Nieuwe meting';
    $('#measureDelete').hidden = !entry;
    measureForm.date.value = entry ? entry.date : todayISO();
    measureForm.note.value = entry ? entry.note || '' : '';
    for (const m of METRICS) {
      const input = measureForm[`m_${m.key}`];
      input.removeAttribute('aria-invalid');
      const v = entry ? entry.values[m.key] : null;
      input.value = v != null ? fmt(v) : '';
      const prev = lastValue(m.key);
      input.placeholder = prev ? fmt(prev.value) : '';
    }
    measureSheet.showModal();
  }

  measureForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const date = measureForm.date.value;
    if (!date) { measureForm.date.focus(); return; }
    const values = {};
    let bad = null;
    for (const m of METRICS) {
      const input = measureForm[`m_${m.key}`];
      const n = parseNum(input.value);
      const invalid = Number.isNaN(n) || (n != null && (n <= 0 || n > 500));
      input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      if (invalid && !bad) bad = input;
      if (n != null && !invalid) values[m.key] = Math.round(n * 10) / 10;
    }
    if (bad) { bad.focus(); toast('Controleer de rood omrande waarde'); return; }
    if (!Object.keys(values).length) { toast('Vul minstens één maat in'); return; }
    const note = measureForm.note.value.trim();

    if (editingEntry) {
      Object.assign(editingEntry, { date, values, note });
      const clash = state.entries.find((e) => e !== editingEntry && e.date === date);
      if (clash) { // samenvoegen met bestaande meting op die datum
        editingEntry.values = { ...clash.values, ...values };
        editingEntry.note = [clash.note, note].filter(Boolean).join(' · ');
        state.entries = state.entries.filter((e) => e !== clash);
      }
      toast('Meting bijgewerkt');
    } else {
      const existing = state.entries.find((e) => e.date === date);
      if (existing) {
        existing.values = { ...existing.values, ...values };
        if (note) existing.note = [existing.note, note].filter(Boolean).join(' · ');
        toast('Toegevoegd aan meting van ' + fmtShort(date));
      } else {
        state.entries.push({ id: uid(), date, values, note });
        toast('Meting bewaard');
      }
    }
    save();
    measureSheet.close();
    render();
  });

  $('#measureDelete').addEventListener('click', () => {
    if (!editingEntry || !confirm(`Meting van ${fmtDate(editingEntry.date)} verwijderen?`)) return;
    state.entries = state.entries.filter((e) => e !== editingEntry);
    save();
    measureSheet.close();
    toast('Meting verwijderd');
    render();
  });

  for (const dlg of [measureSheet]) {
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close();
    });
  }

  /* ---------------- Backup ---------------- */
  async function exportData() {
    const json = JSON.stringify({ app: 'vorm', version: 1, exported: new Date().toISOString(), ...state }, null, 2);
    const name = `vorm-backup-${todayISO()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Vorm back-up' }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.entries)) throw new Error('format');
      const next = normalize(data);
      if (!confirm(`Back-up met ${plural(next.entries.length, 'meting', 'metingen')} importeren? Dit vervangt je huidige gegevens.`)) return;
      state = next;
      applyTheme();
      save();
      toast('Back-up geïmporteerd');
      render();
    } catch {
      toast('Dit is geen geldig Vorm-back-upbestand');
    }
  }

  function demoData() {
    const entries = [];
    const start = addDays(todayISO(), -7 * 16);
    const base = { weight: 94.8, neck: 41, shoulders: 120, chest: 108, waist: 102, belly: 106, hips: 108, armL: 36, armR: 36.5, forearmL: 30, forearmR: 30.5, thighL: 63, thighR: 63.5, calfL: 40, calfR: 40 };
    const rate = { weight: -0.55, neck: -0.08, shoulders: 0.05, chest: -0.25, waist: -0.55, belly: -0.6, hips: -0.35, armL: 0.04, armR: 0.04, forearmL: 0, forearmR: 0, thighL: -0.2, thighR: -0.2, calfL: -0.05, calfR: -0.05 };
    for (let w = 0; w <= 16; w++) {
      const date = addDays(start, w * 7);
      const values = {};
      const tape = w % 2 === 0;
      for (const k of Object.keys(base)) {
        if (k !== 'weight' && !tape) continue;
        const noise = (Math.sin(w * 12.9 + k.length) * 0.5) * (k === 'weight' ? 0.6 : 0.3);
        values[k] = Math.round((base[k] + rate[k] * w + noise) * 10) / 10;
      }
      entries.push({ id: uid(), date, values, note: '' });
    }
    return { entries, settings: { ...state.settings, goalWeight: 82 } };
  }

  /* ---------------- Events ---------------- */
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, [data-tab-go]');
    if (!t) return;
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.tabGo) return go(t.dataset.tabGo);
    if (t.dataset.mode) return setTheme({ mode: t.dataset.mode });
    if (t.dataset.accent) return setTheme({ accent: t.dataset.accent });
    if (t.dataset.range) { ui.range = t.dataset.range; return render(); }
    if (t.dataset.metric) {
      ui.metric = t.dataset.metric;
      render();
      $('#mainChart')?.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (t.dataset.editEntry) return openMeasure(state.entries.find((e) => e.id === t.dataset.editEntry));
    switch (t.dataset.action) {
      case 'add-measure': return openMeasure();
      case 'export': return exportData();
      case 'import': return $('#importFile').click();
      case 'demo':
        if (state.entries.length && !confirm('Demodata vervangt je huidige gegevens. Doorgaan?')) return;
        state = demoData(); save(); toast('Demodata geladen'); return go('overview');
      case 'wipe':
        if (!confirm('Alle metingen definitief wissen? Maak eerst een back-up als je twijfelt.')) return;
        state = { entries: [], settings: state.settings }; save(); toast('Alles gewist'); return render();
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'metricSelect') { ui.metric = t.value; render(); }
    else if (t.id === 'cmpA') { ui.cmpA = t.value; render(); }
    else if (t.id === 'cmpB') { ui.cmpB = t.value; render(); }
    else if (t.id === 'importFile' && t.files[0]) { importData(t.files[0]); t.value = ''; }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'settingsForm') return;
    ev.preventDefault();
    const f = ev.target;
    const goalWeight = parseNum(f.goalWeight.value);
    const gBad = Number.isNaN(goalWeight) || (goalWeight != null && (goalWeight < 30 || goalWeight > 300));
    f.goalWeight.setAttribute('aria-invalid', gBad);
    if (gBad) { toast('Controleer je streefgewicht'); return; }
    state.settings = { ...state.settings, goalWeight };
    save();
    toast('Profiel bewaard');
  });

  $('#fab').addEventListener('click', () => openMeasure());

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
  }

  let lastW = window.innerWidth, resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      if (ui.view === 'overview') RENDER[ui.view]();
    }, 150);
  });

  // Andere tab/venster wijzigde de data
  window.addEventListener('storage', (ev) => { if (ev.key === STORE_KEY) { state = load(); render(); } });

  /* ---------------- Start ---------------- */
  buildMeasureFields();
  applyTheme();
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
