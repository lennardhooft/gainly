/* Gainly — gewicht en lichaamsmaten. Alles lokaal (localStorage). */
(() => {
  'use strict';

  const STORE_KEY = 'gainly:v1';
  // Eenmalig: gegevens van de oude naam (Vorm) overnemen als die er nog zijn.
  try {
    for (const k of ['v1', 'snapshots', 'theme']) {
      const old = localStorage.getItem('vorm:' + k);
      if (old != null && localStorage.getItem('gainly:' + k) == null) localStorage.setItem('gainly:' + k, old);
    }
  } catch { /* ok */ }

  // dir: -1 = lager is beter, 1 = hoger is beter, 0 = neutraal
  const METRICS = [
    { key: 'weight',    label: 'Weight',         unit: 'kg', dir: -1, group: 'Body' },
    { key: 'neck',      label: 'Neck',           unit: 'cm', dir: 0,  group: 'Circumference' },
    { key: 'shoulders', label: 'Shoulders',      unit: 'cm', dir: 1,  group: 'Circumference' },
    { key: 'chest',     label: 'Chest',          unit: 'cm', dir: 0,  group: 'Circumference' },
    { key: 'waist',     label: 'Waist',          unit: 'cm', dir: -1, group: 'Circumference' },
    { key: 'belly',     label: 'Belly (navel)',  unit: 'cm', dir: -1, group: 'Circumference' },
    { key: 'hips',      label: 'Hips',           unit: 'cm', dir: -1, group: 'Circumference' },
    { key: 'armL',      label: 'Upper arm L',     unit: 'cm', dir: 1,  group: 'Arms & legs' },
    { key: 'armR',      label: 'Upper arm R',     unit: 'cm', dir: 1,  group: 'Arms & legs' },
    { key: 'forearmL',  label: 'Forearm L',       unit: 'cm', dir: 1,  group: 'Arms & legs' },
    { key: 'forearmR',  label: 'Forearm R',       unit: 'cm', dir: 1,  group: 'Arms & legs' },
    { key: 'thighL',    label: 'Thigh L',        unit: 'cm', dir: 0,  group: 'Arms & legs' },
    { key: 'thighR',    label: 'Thigh R',        unit: 'cm', dir: 0,  group: 'Arms & legs' },
    { key: 'calfL',     label: 'Calf L',         unit: 'cm', dir: 0,  group: 'Arms & legs' },
    { key: 'calfR',     label: 'Calf R',         unit: 'cm', dir: 0,  group: 'Arms & legs' },
  ];
  const M = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  const TAPE = METRICS.filter((m) => m.unit === 'cm');

  const RANGES = [
    { key: '1m', label: '1M', days: 31 },
    { key: '3m', label: '3M', days: 92 },
    { key: '6m', label: '6M', days: 183 },
    { key: '1y', label: '1Y', days: 366 },
    { key: 'all', label: 'All', days: Infinity },
  ];

  const TITLES = { overview: 'Overview', log: 'Measurements', compare: 'Compare', photos: 'Photos', food: 'Nutrition', gym: 'Gym', settings: 'Settings' };
  // Categorieën in het menu: Lichaam heeft een tweede balk met zijn vier pagina's.
  const BODY_VIEWS = ['overview', 'compare', 'photos', 'log'];
  const GYM_VIEWS = ['gym', 'gymHistory', 'gymEx'];
  const groupOf = (v) => (BODY_VIEWS.includes(v) ? 'body' : GYM_VIEWS.includes(v) ? 'gym' : '');

  // Uitleg per meetplek (L/R delen dezelfde tekst).
  const TIPS = {
    weight: 'Weigh yourself in the morning after the toilet, before eating and in underwear, always on the same scale on a hard floor. Swings of a kilo a day are normal: watch the trend.',
    neck: 'Just below the Adam’s apple, with the tape sloping slightly down at the front. Look straight ahead, shoulders relaxed.',
    shoulders: 'Around the widest point of your shoulders, over the upper arms. Arms relaxed at your sides. Easiest with someone helping.',
    chest: 'Across the nipples and under the armpits, tape level. Measure after a normal breath out.',
    waist: 'Halfway between your lowest rib and the top of your hip bone, usually the narrowest point. After a normal breath out, don’t suck in.',
    belly: 'Right over your navel, tape level. Stand relaxed, after a normal breath out.',
    hips: 'Around the widest point of your glutes, feet together. Check in the mirror that the tape is level all round.',
    arm: 'At the thickest point of your upper arm, arm relaxed at your side (not flexed). Measure at the same spot every time.',
    forearm: 'At the thickest point just below the elbow, hand open and relaxed.',
    thigh: 'About 15 cm above the kneecap (or just below the glute), weight on both legs. Pick one spot and stick with it.',
    calf: 'At the thickest point of your calf, standing with weight on both legs.',
  };
  const tipFor = (key) => TIPS[key] || TIPS[key.replace(/[LR]$/, '')];

  // Opening a sheet puts focus on its first button (Close/Cancel), which iOS draws as a blue square.
  // Move focus to the dialog itself instead; keyboard users can still tab to the buttons.
  const nativeShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    nativeShowModal.call(this);
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
    const f = document.activeElement;
    if (f && this.contains(f) && f.tagName === 'BUTTON') this.focus({ preventScroll: true });
  };

  /* ---------------- Helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const nfCache = {};
  const nf = (d) => (nfCache[d] ||= new Intl.NumberFormat('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : nf(d).format(n));
  const fmtSigned = (n, d = 1) => {
    const r = Number(n.toFixed(d));
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + fmt(Math.abs(r), d);
  };
  const DF_LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const DF_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const DF_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' });
  const DF_WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
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
  // Onbekende velden (van oudere of nieuwere versies) blijven altijd bewaard.
  function normalize(s) {
    return {
      ...s,
      entries: (s.entries || []).filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map((e) => ({
        id: e.id || uid(), date: e.date, note: e.note || '', values: e.values || {},
      })),
      settings: s.settings || {},
    };
  }
  let state = load();

  // Herstelpunten: max. 1 per dag, de laatste 10 dagen, apart van de gewone opslag.
  const SNAP_KEY = 'gainly:snapshots';
  function snapshots() { try { return JSON.parse(localStorage.getItem(SNAP_KEY)) || []; } catch { return []; } }
  function snapshot(reason = 'auto') {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const workouts = (data.gym && data.gym.workouts && data.gym.workouts.length) || 0;
      if (!(data.entries && data.entries.length) && !workouts) return;
      let list = snapshots().filter((x) => x.day !== todayISO() || reason !== 'auto');
      list.unshift({ day: todayISO(), at: new Date().toISOString(), reason, count: (data.entries || []).length, workouts, data });
      list = list.slice(0, 10);
      // Opslag vol? Oudste herstelpunten laten vallen tot het past.
      while (list.length) {
        try { localStorage.setItem(SNAP_KEY, JSON.stringify(list)); return; } catch { list.pop(); }
      }
      localStorage.removeItem(SNAP_KEY);
    } catch { /* herstelpunt overslaan */ }
  }

  function save({ allowEmpty = false } = {}) {
    try {
      // Nooit een gevulde opslag stilletjes vervangen door een lege.
      if (!allowEmpty && !state.entries.length) {
        const prev = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (prev && prev.entries && prev.entries.length) { state = normalize(prev); toast('Save refused to prevent data loss'); return; }
      }
      if (!snapshots().some((x) => x.day === todayISO())) snapshot('auto');
      const json = JSON.stringify(state);
      try { localStorage.setItem(STORE_KEY, json); }
      catch {
        // Je gegevens gaan voor: herstelpunten opofferen om plaats te maken.
        const list = snapshots();
        while (list.length) {
          list.pop();
          try { localStorage.setItem(SNAP_KEY, JSON.stringify(list)); localStorage.setItem(STORE_KEY, json); return; } catch { /* verder */ }
        }
        localStorage.removeItem(SNAP_KEY);
        localStorage.setItem(STORE_KEY, json);
      }
    } catch { toast('Saving failed: storage full or blocked'); }
  }

  const ui = { view: 'overview', metric: 'weight', range: 'all', cmpA: null, cmpB: null, photoPose: 'front', photoMode: 'slider', photoA: null, photoB: null };
  try { Object.assign(ui, JSON.parse(sessionStorage.getItem('gainly:ui')) || {}); } catch { /* ok */ }
  const saveUi = () => { try { sessionStorage.setItem('gainly:ui', JSON.stringify(ui)); } catch { /* ok */ } };

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
  // Startdatum van je huidige cut of bulk: daar begint 'sinds start', de doelbalk en de mijlpalen.
  const phaseStart = () => state.settings.goalStart || null;
  function phaseSeries(key) {
    const all = series(key);
    const d = phaseStart();
    if (!d) return all;
    const base = valueAt(key, d); // laatste meting op of voor de startdatum
    const after = all.filter((p) => p.date > d);
    return base ? [base, ...after] : after;
  }
  const sinceLabel = () => (phaseStart() ? `Since ${fmtShort(phaseStart())}` : 'Since start');
  const msId = (id) => (phaseStart() ? `${phaseStart()}:${id}` : id);

  function lastValue(key) { const s = series(key); return s.length ? s[s.length - 1] : null; }

  // Doel bepaalt welke richting 'goed' is: cutten = kleiner, bulken = groter (taille liefst stabiel).
  const isBulk = () => state.settings.goalType === 'bulk';
  const BULK_DIR = { weight: 1, neck: 0, shoulders: 1, chest: 1, waist: -1, belly: 0, hips: 0, armL: 1, armR: 1, forearmL: 1, forearmR: 1, thighL: 1, thighR: 1, calfL: 1, calfR: 1 };
  const dirOf = (m) => (m.key && isBulk() ? BULK_DIR[m.key] ?? m.dir : m.dir);

  function trend(m, d) {
    if (d == null || Math.abs(d) < 0.05) return 'flat';
    const dir = dirOf(m);
    if (!dir) return 'neutral';
    return Math.sign(d) === dir ? 'good' : 'bad';
  }
  function deltaHTML(m, d, digits = 1, withUnit = true) {
    if (d == null) return '<span class="delta delta--flat">—</span>';
    const t = trend(m, d);
    const arrow = t === 'flat' ? '' : `<span class="delta__arrow" aria-hidden="true">${d > 0 ? '▲' : '▼'}</span>`;
    const sr = t === 'good' ? ' (good)' : t === 'bad' ? ' (worse)' : '';
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
    if (!pts.length) { el.innerHTML = '<p class="chart__empty">No data in this period yet.</p>'; return; }

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

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}: ${pts.length} measurements, latest ${fmt(vals[pts.length - 1], digits)} ${unit}">`;
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
      svg += `<text class="chart__goal-label" x="${pad.l + 6}" y="${Number(gy) - 6}">Goal ${fmt(goal, digits)}</text>`;
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
      el.innerHTML = emptyState('Start measuring', 'Add your first measurement: weight, and if you like a few circumferences with a tape measure.', 'add-measure', 'Add first measurement');
      return;
    }
    const s = state.settings;
    const w = series('weight');
    let hero = '';
    if (w.length) {
      const pw = phaseSeries('weight');
      const last = w[w.length - 1];
      const first = pw.length ? pw[0] : last;
      const ref30 = valueAt('weight', addDays(last.date, -30));
      const d30 = ref30 && ref30.date !== last.date ? last.value - ref30.value : null;
      const ref7 = valueAt('weight', addDays(last.date, -7));
      const d7 = ref7 && ref7.date !== last.date ? last.value - ref7.value : null;
      let goal = '';
      let reached = false;
      if (s.goalWeight && first.value !== s.goalWeight) {
        const total = first.value - s.goalWeight;
        const done = first.value - last.value;
        const pct = Math.max(0, Math.min(1, done / total));
        const left = last.value - s.goalWeight;
        reached = Math.sign(left) !== Math.sign(total) || Math.abs(left) < 0.05;
        goal = `<div class="progress">
          <div class="progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="Progress to goal weight"><span style="width:${pct * 100}%"></span></div>
          <div class="progress__text"><span>${reached ? 'Goal reached 🎉' : `${fmt(Math.abs(left))} kg to go to ${fmt(s.goalWeight)} kg`}</span><span>${Math.round(pct * 100)}%</span></div>
        </div>`;
      }
      hero = `<div class="card">
        <p class="eyebrow">Weight · ${fmtDate(last.date)}</p>
        <p class="hero__value">${fmt(last.value)}<small>kg</small></p>
        <div class="stats">
          <div class="stat"><span class="stat__label">${sinceLabel()}</span><span class="stat__value">${pw.length > 1 ? deltaHTML(M.weight, last.value - first.value) : '—'}</span></div>
          <div class="stat"><span class="stat__label">7 days</span><span class="stat__value">${d7 != null ? deltaHTML(M.weight, d7) : '—'}</span></div>
          <div class="stat"><span class="stat__label">30 days</span><span class="stat__value">${d30 != null ? deltaHTML(M.weight, d30) : '—'}</span></div>
        </div>
        ${goal}
        ${forecastHTML(last, reached)}
      </div>`;
    }

    const available = metricsWithData();
    if (!available.some((m) => m.key === ui.metric)) ui.metric = available[0].key;
    const m = M[ui.metric];

    const cards = available.map((mm) => {
      const sr = series(mm.key);
      const last = sr[sr.length - 1];
      const ps = phaseSeries(mm.key);
      const d = ps.length > 1 ? last.value - ps[0].value : null;
      return `<button class="metric" data-metric="${mm.key}" aria-pressed="${mm.key === ui.metric}">
        <span class="metric__label">${mm.label}</span>
        <span class="metric__value">${fmt(last.value)}<small>${mm.unit}</small></span>
        ${deltaHTML(mm, d)}
      </button>`;
    }).join('');

    el.innerHTML = `${hero}
      <div class="card">
        <div class="card__head">
          <select class="select" id="metricSelect" aria-label="Choose a measurement">
            ${available.map((mm) => `<option value="${mm.key}" ${mm.key === ui.metric ? 'selected' : ''}>${mm.label}</option>`).join('')}
          </select>
          <div class="segmented" role="group" aria-label="Period">
            ${RANGES.map((r) => `<button type="button" data-range="${r.key}" aria-pressed="${r.key === ui.range}">${r.label}</button>`).join('')}
          </div>
        </div>
        <div class="chart" id="mainChart"></div>
      </div>
      <h2 class="section-title">All measurements · ${sinceLabel().toLowerCase()}</h2>
      <div class="metric-grid">${cards}</div>
      <p class="hint" style="text-align:center">Press and hold + to quickly log just your weight.</p>`;

    const range = RANGES.find((r) => r.key === ui.range) || RANGES[RANGES.length - 1];
    const from = range.days === Infinity ? '0000-00-00' : addDays(todayISO(), -range.days);
    const pts = series(m.key).filter((p) => p.date >= from);
    lineChart($('#mainChart'), pts, {
      unit: m.unit, label: m.label,
      goal: m.key === 'weight' && s.goalWeight ? s.goalWeight : null,
    });
  }

  /* ---------------- Voorspelling ---------------- */
  // Lineaire trend over de laatste 6 weken (min. 3 wegingen over min. 10 dagen).
  function forecast() {
    const w = series('weight');
    if (w.length < 3) return null;
    const last = w[w.length - 1];
    const pts = w.filter((p) => daysBetween(p.date, last.date) <= 42);
    if (pts.length < 3 || daysBetween(pts[0].date, last.date) < 10) return null;
    const xs = pts.map((p) => daysBetween(pts[0].date, p.date));
    const ys = pts.map((p) => p.value);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    const slope = sxy / sxx; // kg per dag
    return { slope, perWeek: slope * 7, weeks: Math.round(daysBetween(pts[0].date, last.date) / 7) };
  }

  const ICON_TREND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>';
  function forecastHTML(last, reached) {
    const f = forecast();
    if (!f) return '';
    const g = state.settings.goalWeight;
    const pw = `${deltaHTML(M.weight, f.perWeek, 2)} per week`;
    let txt;
    if (Math.abs(f.perWeek) < 0.05) txt = `Your weight has been stable for the last ${plural(f.weeks, 'week', 'weeks')}.`;
    else if (g && !reached) {
      const need = g - last.value;
      if (Math.sign(need) === Math.sign(f.slope)) {
        const days = Math.round(need / f.slope);
        txt = days > 3 * 365
          ? `At your pace of ${pw} it will take more than three years to reach ${fmt(g)} kg.`
          : `At your pace of ${pw} you’ll reach ${fmt(g)} kg around <strong>${fmtDate(addDays(last.date, days))}</strong>.`;
      } else txt = `Your pace is ${pw}, away from your goal of ${fmt(g)} kg.`;
    } else if (!g) txt = `Your pace: ${pw}. <button type="button" class="inline-link" data-tab-go="settings">Set a goal weight</button> to see when you’ll reach it.`;
    else txt = `Your pace: ${pw}.`;
    return `<p class="forecast">${ICON_TREND}<span>${txt}</span></p>`;
  }

  /* ---------------- Mijlpalen ---------------- */
  const MS_KG = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50];
  const MS_WAIST = [5, 10, 15, 20, 25];
  const MS_TAPE = [10, 25, 50, 75, 100];
  const MS_COUNT = [5, 10, 25, 50, 100, 200];
  const kgTxt = (k) => fmt(k, k % 1 ? 1 : 0);

  function milestones() {
    const out = [];
    const w = phaseSeries('weight');
    const since = phaseStart() ? `since ${fmtShort(phaseStart())}` : 'than at your first measurement';
    if (w.length > 1) {
      const start = w[0].value;
      const bulk = isBulk();
      const hit = new Set();
      for (const p of w) for (const k of MS_KG) {
        const moved = bulk ? p.value - start : start - p.value;
        if (hit.has(k) || moved < k - 1e-9) continue;
        hit.add(k);
        out.push(bulk
          ? { id: msId('gkg' + k), date: p.date, icon: '💪', title: `+${kgTxt(k)} kg`, text: `You weigh ${kgTxt(k)} kg more ${since}.` }
          : { id: msId('kg' + k), date: p.date, icon: '⚖️', title: `−${kgTxt(k)} kg`, text: `You weigh ${kgTxt(k)} kg less ${since}.` });
      }
      const g = state.settings.goalWeight;
      if (g && (bulk ? g > start : g < start)) {
        const p = w.find((x) => (bulk ? x.value >= g - 0.05 : x.value <= g + 0.05));
        if (p) out.push({ id: msId('goal' + g), date: p.date, icon: '🏆', title: 'Goal reached', text: `You hit your goal weight of ${fmt(g)} kg.` });
      }
    }
    if (isBulk()) {
      // Bulken: groei van armen en borst
      const grow = (key, steps, icon, label) => {
        const sr = phaseSeries(key);
        if (sr.length < 2) return;
        const hit = new Set();
        for (const p of sr) for (const k of steps) {
          if (hit.has(k) || p.value - sr[0].value < k - 1e-9) continue;
          hit.add(k);
          out.push({ id: msId(key + '+' + k), date: p.date, icon, title: `${label} +${k} cm`, text: `Your ${label.toLowerCase()} is ${k} cm bigger than at the start.` });
        }
      };
      grow('armR', [1, 2, 3, 4, 5], '💪', 'Upper arm');
      grow('chest', [3, 5, 10, 15], '🏋️', 'Chest');
      grow('shoulders', [3, 5, 10, 15], '🏋️', 'Shoulders');
    }
    const entries = entriesAsc();
    if (!isBulk()) { // taille- en omtrekmijlpalen alleen bij afvallen
      const wa = phaseSeries('waist');
      if (wa.length > 1) {
        const hit = new Set();
        for (const p of wa) for (const k of MS_WAIST) {
          if (hit.has(k) || wa[0].value - p.value < k - 1e-9) continue;
          hit.add(k);
          out.push({ id: msId('waist' + k), date: p.date, icon: '📏', title: `Waist −${k} cm`, text: `Your waist is ${k} cm smaller than at the start.` });
        }
      }
      const firsts = {}, cur = {}, hit = new Set();
      const d0 = phaseStart();
      if (d0) for (const m of TAPE) { const b = valueAt(m.key, d0); if (b) { firsts[m.key] = b.value; cur[m.key] = b.value; } }
      for (const e of entries) {
        if (d0 && e.date <= d0) continue;
        for (const m of TAPE) {
          const v = e.values[m.key];
          if (v == null) continue;
          if (!(m.key in firsts)) firsts[m.key] = v;
          cur[m.key] = v;
        }
        const keys = Object.keys(firsts);
        if (keys.length < 2) continue;
        const lost = keys.reduce((sum, k) => sum + firsts[k] - cur[k], 0);
        for (const k of MS_TAPE) {
          if (hit.has(k) || lost < k - 1e-9) continue;
          hit.add(k);
          out.push({ id: msId('tape' + k), date: e.date, icon: '🎯', title: `−${k} cm total`, text: `All your circumferences together are ${k} cm smaller than at the start.` });
        }
      }
    }
    for (const n of MS_COUNT) {
      if (entries.length >= n) out.push({ id: 'n' + n, date: entries[n - 1].date, icon: '🗓️', title: `${n} measurements`, text: `You’ve measured ${n} times already. Consistency pays off.` });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Nieuwe mijlpalen als gezien markeren; alleen na een eigen meting volgt een felicitatie.
  function syncMilestones(celebrate) {
    const had = Array.isArray(state.settings.milestones);
    const seen = new Set(had ? state.settings.milestones : []);
    const all = milestones();
    const fresh = all.filter((m) => !seen.has(m.id));
    if (had && !fresh.length) return;
    state.settings = { ...state.settings, milestones: [...seen, ...fresh.map((m) => m.id)] };
    save();
    if (celebrate && had && fresh.length) showCelebration(fresh);
  }

  const celebrateDlg = $('#celebrate');
  function showCelebration(list) {
    const main = list[list.length - 1];
    $('#celebrateIcon').textContent = main.icon;
    $('#celebrateTitle').textContent = main.title;
    $('#celebrateText').textContent = main.text;
    const more = list.slice(0, -1).map((m) => m.title);
    $('#celebrateMore').textContent = more.length ? `And also: ${more.join(', ')}` : '';
    const box = $('#confetti');
    box.innerHTML = '';
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < 70; i++) {
        const c = document.createElement('i');
        c.style.cssText = `--x:${Math.random() * 100}%;--d:${Math.random() * 0.5}s;--t:${1.6 + Math.random() * 1.4}s;--r:${Math.random() * 720 - 360}deg;--dx:${Math.random() * 80 - 40}px;--hh:${Math.round(Math.random() * 300)}`;
        box.append(c);
      }
    }
    celebrateDlg.showModal();
  }

  function renderLog() {
    const el = viewEl('log');
    if (!state.entries.length) {
      el.innerHTML = emptyState('No measurements yet', 'Every measurement you add shows up here. Tap one to edit or delete it.', 'add-measure', 'Add measurement');
      return;
    }
    el.innerHTML = `${logHTML()}<p class="hint" style="text-align:center">Tap a measurement to edit or delete it.</p>`;
  }

  function logHTML() {
    const desc = entriesAsc().reverse();
    const byYear = {};
    for (const e of desc) (byYear[e.date.slice(0, 4)] ||= []).push(e);
    return Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, list]) => `
      <h2 class="section-title" id="${year === desc[0].date.slice(0, 4) ? 'metingen' : ''}">Measurements ${year} · ${list.length}</h2>
      <div class="list">${list.map((e) => {
        const n = Object.keys(e.values).filter((k) => e.values[k] != null).length;
        const wv = e.values.weight;
        const sub = [plural(n, 'value', 'values'), e.note].filter(Boolean).map(esc).join(' · ');
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
      el.innerHTML = emptyState('Nothing to compare yet', 'You need at least two measurements on different dates.', 'add-measure', 'Add measurement');
      return;
    }
    if (!dates.includes(ui.cmpA)) {
      const d0 = phaseStart();
      ui.cmpA = (d0 && [...dates].reverse().find((d) => d <= d0)) || dates[0];
    }
    if (!dates.includes(ui.cmpB)) ui.cmpB = dates[dates.length - 1];
    const A = ui.cmpA, B = ui.cmpB;
    const opts = (sel) => [...dates].reverse().map((d) => `<option value="${d}" ${d === sel ? 'selected' : ''}>${fmtDate(d)}</option>`).join('');

    const rows = [];
    for (const m of METRICS) {
      const a = valueAt(m.key, A), b = valueAt(m.key, B);
      if (!a && !b) continue;
      const d = a && b ? b.value - a.value : null;
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
          <label class="field"><span class="field__label">From</span><select class="select" id="cmpA">${opts(A)}</select></label>
          <span class="compare-pick__arrow" aria-hidden="true">→</span>
          <label class="field"><span class="field__label">To</span><select class="select" id="cmpB">${opts(B)}</select></label>
        </div>
      </div>
      <div class="compare-head">
        <div class="stat"><span class="stat__label">Period</span><span class="stat__value">${plural(Math.abs(days), 'day', 'days')}</span></div>
        <div class="stat"><span class="stat__label">Weight</span><span class="stat__value">${wa && wb ? deltaHTML(M.weight, wb.value - wa.value) : '—'}</span></div>
        <div class="stat"><span class="stat__label">Per week</span><span class="stat__value">${perWeek != null ? deltaHTML(M.weight, perWeek, 2) : '—'}</span></div>
      </div>
      ${bodyHTML(A, B)}
      <div class="card">
        <table class="table">
          <thead><tr><th scope="col">Measurement</th><th scope="col">${fmtShort(A)}</th><th scope="col">${fmtShort(B)}</th><th scope="col">Change</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p class="hint">A small date under a value means that measurement wasn’t taken that day; the most recent earlier one is shown instead.</p>`;
  }

  /* ---------------- Lichaamsschets ---------------- */
  // Per maat: hoogte (y), breedte van de meetband (x1–x2) en de kant van het label. Links = L (zoals in de spiegel).
  const BODY = {
    neck:      { y: 76,  x1: 160, x2: 180, side: 'R' },
    shoulders: { y: 98,  x1: 100, x2: 240, side: 'L' },
    chest:     { y: 140, x1: 122, x2: 218, side: 'R' },
    waist:     { y: 205, x1: 133, x2: 207, side: 'L' },
    belly:     { y: 228, x1: 130, x2: 212, side: 'R' },
    hips:      { y: 252, x1: 120, x2: 220, side: 'L' },
    armL:      { y: 148, x1: 98,  x2: 122, side: 'L' },
    armR:      { y: 148, x1: 218, x2: 242, side: 'R' },
    forearmL:  { y: 228, x1: 90,  x2: 110, side: 'L' },
    forearmR:  { y: 228, x1: 230, x2: 250, side: 'R' },
    thighL:    { y: 300, x1: 121, x2: 165, side: 'L' },
    thighR:    { y: 300, x1: 175, x2: 219, side: 'R' },
    calfL:     { y: 380, x1: 128, x2: 158, side: 'L' },
    calfR:     { y: 380, x1: 182, x2: 212, side: 'R' },
  };
  const FIGURE = `<g class="body__figure">
    <ellipse cx="170" cy="40" rx="22" ry="26"/>
    <rect x="160" y="60" width="20" height="26" rx="6"/>
    <path d="M118 92C140 84 200 84 222 92C232 96 232 110 224 128C222 160 218 180 208 205C214 225 222 245 220 268L120 268C118 245 126 225 132 205C122 180 118 160 116 128C108 110 108 96 118 92Z"/>
    <path class="body__limb" stroke-width="24" d="M224 104L236 190"/><path class="body__limb" stroke-width="19" d="M236 190L244 272"/>
    <path class="body__limb" stroke-width="24" d="M116 104L104 190"/><path class="body__limb" stroke-width="19" d="M104 190L96 272"/>
    <path class="body__limb" stroke-width="44" d="M194 262L198 345"/><path class="body__limb" stroke-width="30" d="M198 345L196 410"/>
    <path class="body__limb" stroke-width="44" d="M146 262L142 345"/><path class="body__limb" stroke-width="30" d="M142 345L144 410"/>
  </g>`;

  function bodyHTML(A, B) {
    const items = [];
    for (const m of TAPE) {
      const a = valueAt(m.key, A), b = valueAt(m.key, B);
      if (!a || !b || !BODY[m.key]) continue;
      items.push({ m, d: b.value - a.value, ...BODY[m.key] });
    }
    if (items.length < 2) return '';
    const W = 340, H = 432, GAP = 31, TOP = 14, BOTTOM = H - 18;
    let svg = '';
    for (const side of ['L', 'R']) {
      const list = items.filter((i) => i.side === side).sort((a, b) => a.y - b.y);
      // Labels uit elkaar duwen, daarna terug omhoog als ze onderaan uit beeld vallen.
      list.forEach((it, i) => { it.ly = Math.max(it.y, TOP, i ? list[i - 1].ly + GAP : TOP); });
      for (let i = list.length - 1; i >= 0; i--) {
        const max = i === list.length - 1 ? BOTTOM : list[i + 1].ly - GAP;
        if (list[i].ly > max) list[i].ly = max;
      }
      for (const it of list) {
        const t = trend(it.m, it.d);
        const left = side === 'L';
        const sx = left ? it.x1 : it.x2;
        const lx = left ? 78 : 262;
        svg += `<g class="delta--${t}">
          <path class="body__leader" d="M${sx} ${it.y}L${left ? sx - 6 : sx + 6} ${it.y}L${lx} ${it.ly}"/>
          <line class="body__band" x1="${it.x1}" x2="${it.x2}" y1="${it.y}" y2="${it.y}"/>
          <text class="body__name" x="${left ? lx - 4 : lx + 4}" y="${it.ly - 3}" text-anchor="${left ? 'end' : 'start'}">${esc(it.m.label)}</text>
          <text class="body__delta" x="${left ? lx - 4 : lx + 4}" y="${it.ly + 12}" text-anchor="${left ? 'end' : 'start'}">${fmtSigned(it.d)} cm</text>
        </g>`;
      }
    }
    return `<div class="card">
      <h2 class="card__title">Per body part</h2>
      <p class="hint" style="margin:4px 0 6px">Green is the right direction, red the other. Left and right as in the mirror.</p>
      <svg class="body" viewBox="0 0 ${W} ${H}" role="img" aria-label="Body outline with the change per body part">${FIGURE}${svg}</svg>
    </div>`;
  }

  /* ---------------- Thema ---------------- */
  // Elk thema is één tint (OKLCH-hue): achtergrond, vlakken, randen, tekst en accent worden er allemaal van afgeleid (styles.css).
  const ACCENTS = [
    { key: 'leisteen', label: 'Slate' },
    { key: 'zand', label: 'Sand' },
  ];
  const MODES = [{ key: 'system', label: 'Automatic' }, { key: 'dark', label: 'Dark' }, { key: 'light', label: 'Light' }];
  const themeOf = () => {
    const t = { mode: 'dark', accent: 'leisteen', ...(state.settings.theme || {}) };
    if (!ACCENTS.some((a) => a.key === t.accent)) t.accent = 'leisteen'; // oude kleurthema's bestaan niet meer
    if (!MODES.some((m) => m.key === t.mode)) t.mode = 'dark';
    return t;
  };
  function applyTheme() {
    const t = themeOf();
    const root = document.documentElement;
    root.dataset.accent = t.accent;
    root.dataset.mode = t.mode;
    try { localStorage.setItem('gainly:theme', JSON.stringify(t)); } catch { /* ok */ }
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', toHex(getComputedStyle(document.body).backgroundColor));
  }
  // oklch() → #hex voor de theme-color van de statusbalk
  function toHex(color) {
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.fillStyle = color; c.fillRect(0, 0, 1, 1);
      const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    } catch { return '#0b0d10'; }
  }
  function themeHTML() {
    const t = themeOf();
    return `<div class="card">
      <h2 class="card__title" style="margin-bottom:14px">Theme</h2>
      <div class="segmented segmented--full" role="group" aria-label="Appearance">
        ${MODES.map((m) => `<button type="button" data-mode="${m.key}" aria-pressed="${m.key === t.mode}">${m.label}</button>`).join('')}
      </div>
      <div class="swatches" role="group" aria-label="Palette">
        ${ACCENTS.map((a) => `<button type="button" class="swatch" data-accent="${a.key}" aria-pressed="${a.key === t.accent}">
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

  function snapshotsHTML() {
    const list = snapshots();
    if (!list.length) return '';
    return `<div class="card">
      <h2 class="card__title" style="margin-bottom:6px">Restore points</h2>
      <p class="prose" style="margin-bottom:10px">The app automatically keeps one copy a day (last 10). Tap to restore.</p>
      <div class="list">${list.map((x, i) => `<button class="list__item" data-restore="${i}">
        <div class="list__main"><div class="list__title">${fmtDate(x.day)}</div><div class="list__sub">${x.reason === 'update' ? 'Before an update' : x.reason === 'restore' ? 'Before a restore' : 'Automatic'}</div></div>
        <div class="list__end">${plural(x.count, 'measurement', 'measurements')}${x.workouts ? ` · ${plural(x.workouts, 'workout', 'workouts')}` : ''}</div>${chev}</button>`).join('')}</div>
    </div>`;
  }

  /* ---------------- Settings ---------------- */
  function renderSettings() {
    const el = viewEl('settings');
    const s = state.settings;
    el.innerHTML = `
      <form class="card" id="settingsForm" novalidate>
        <h2 class="card__title" style="margin-bottom:14px">Profile</h2>
        <span class="field__label" style="display:block;margin-bottom:6px">Goal</span>
        <div class="segmented segmented--full" role="group" aria-label="Goal" style="margin-bottom:14px">
          <button type="button" data-goal-type="cut" aria-pressed="${!isBulk()}">Lose weight (cut)</button>
          <button type="button" data-goal-type="bulk" aria-pressed="${isBulk()}">Gain weight (bulk)</button>
        </div>
        <div class="field-grid">
          <label class="field"><span class="field__label">Height <small>cm</small></span><input name="height" inputmode="decimal" value="${s.height ? fmt(s.height, 0) : ''}" placeholder="180"></label>
          <label class="field"><span class="field__label">Goal weight <small>kg</small></span><input name="goalWeight" inputmode="decimal" value="${s.goalWeight ? fmt(s.goalWeight) : ''}" placeholder="75.0"></label>
        </div>
        <label class="field"><span class="field__label">${isBulk() ? 'Bulk' : 'Cut'} started on</span><input type="date" name="goalStart" value="${s.goalStart || ''}"></label>
        <p class="hint" style="margin-top:-6px">“Since start”, your goal bar and your milestones count from this date. Empty = from your first measurement.</p>
        <button class="button button--primary" type="submit">Save profile</button>
      </form>

      ${themeHTML()}

      <div class="card">
        <h2 class="card__title" style="margin-bottom:6px">Backup</h2>
        <p class="prose" style="margin-bottom:14px">Your data lives only on this device (${plural(state.entries.length, 'measurement', 'measurements')}${state.gym && state.gym.workouts && state.gym.workouts.length ? `, ${plural(state.gym.workouts.length, 'workout', 'workouts')}` : ''}). ${s.lastExport ? `Last backup: ${fmtDate(s.lastExport)}.` : '<strong style="color:var(--bad)">No backup made yet.</strong>'} Save one now and then to Files or iCloud Drive; it’s the only copy outside the app.</p>
        <div class="button-row">
          <button class="button" data-action="export">Export</button>
          <button class="button" data-action="import">Import</button>
          ${photos.length ? `<button class="button button-row__wide" data-action="export-photos">Export with photos (${photos.length})</button>` : ''}
        </div>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
      </div>

      ${snapshotsHTML()}

      <div class="card">
        <h2 class="card__title" style="margin-bottom:10px">Data</h2>
        <div class="button-row">
          <button class="button" data-action="demo">Load demo data</button>
          <button class="button button--danger" data-action="wipe">Erase everything</button>
        </div>
      </div>`;
  }

  /* ---------------- Foto's (IndexedDB, alleen op dit toestel) ---------------- */
  const POSES = [{ key: 'front', label: 'Front' }, { key: 'side', label: 'Side' }, { key: 'back', label: 'Back' }];
  const poseLabel = (k) => POSES.find((p) => p.key === k)?.label || k;

  const PhotoDB = (() => {
    let dbp = null;
    const open = () => (dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open('gainly-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => { dbp = null; rej(r.error); };
    }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction('photos', mode);
        const req = fn(tx.objectStore('photos'));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    };
    return {
      all: () => run('readonly', (s) => s.getAll()),
      put: (p) => run('readwrite', (s) => s.put(p)),
      del: (id) => run('readwrite', (s) => s.delete(id)),
      clear: () => run('readwrite', (s) => s.clear()),
    };
  })();

  let photos = [];
  let photosLoaded = false;
  const photoUrls = new Map();
  const photoUrl = (p) => {
    if (!photoUrls.has(p.id)) photoUrls.set(p.id, URL.createObjectURL(p.blob));
    return photoUrls.get(p.id);
  };
  const dropUrl = (id) => { if (photoUrls.has(id)) { URL.revokeObjectURL(photoUrls.get(id)); photoUrls.delete(id); } };
  const photoDates = (pose) => [...new Set(photos.filter((p) => !pose || p.pose === pose).map((p) => p.date))].sort();
  const photoOf = (date, pose) => photos.find((p) => p.date === date && p.pose === pose);

  async function loadPhotos() {
    try { photos = (await PhotoDB.all()) || []; } catch { photos = []; }
    photosLoaded = true;
    if (ui.view === 'photos' || ui.view === 'settings') render();
  }

  // Verkleinen naar max. 1280 px JPEG: scherp genoeg om te vergelijken, klein genoeg voor honderden foto's.
  async function compressImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
      if (!blob) throw new Error('encode');
      return { blob, w, h };
    } finally { URL.revokeObjectURL(url); }
  }

  function renderPhotos() {
    const el = viewEl('photos');
    if (!photosLoaded) { el.innerHTML = '<p class="hint" style="text-align:center">Loading photos…</p>'; return; }
    if (!photos.length) {
      el.innerHTML = emptyState('Progress photos', 'Take photos from the front, side and back, each time in the same spot with the same light. They stay on this device only.', 'add-photos', 'Add first photos');
      return;
    }
    if (!photoDates(ui.photoPose).length) ui.photoPose = POSES.find((p) => photoDates(p.key).length).key;
    const pose = ui.photoPose;
    const dates = photoDates(pose);
    if (!dates.includes(ui.photoA)) ui.photoA = dates[0];
    if (!dates.includes(ui.photoB)) ui.photoB = dates[dates.length - 1];
    const A = ui.photoA, B = ui.photoB;
    const a = photoOf(A, pose), b = photoOf(B, pose);
    const opts = (sel) => [...dates].reverse().map((d) => `<option value="${d}" ${d === sel ? 'selected' : ''}>${fmtDate(d)}</option>`).join('');
    const alt = (d) => `${poseLabel(pose)} photo from ${fmtDate(d)}`;

    let cmp;
    if (dates.length < 2) {
      cmp = `<figure class="photo-single"><img src="${photoUrl(b)}" alt="${alt(B)}"><figcaption>${fmtDate(B)}</figcaption></figure>
        <p class="hint" style="margin:12px 0 0">Add a ${poseLabel(pose).toLowerCase()} photo on another date to compare.</p>`;
    } else if (ui.photoMode === 'side') {
      cmp = `<div class="photo-pair">
        <figure><img src="${photoUrl(a)}" alt="${alt(A)}"><figcaption>${fmtShort(A)}</figcaption></figure>
        <figure><img src="${photoUrl(b)}" alt="${alt(B)}"><figcaption>${fmtShort(B)}</figcaption></figure>
      </div>`;
    } else {
      cmp = `<div class="photo-slider" role="slider" tabindex="0" aria-label="Slide between ${fmtShort(A)} and ${fmtShort(B)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" style="--pos:50%">
        <img src="${photoUrl(b)}" alt="${alt(B)}" draggable="false">
        <img class="photo-slider__top" src="${photoUrl(a)}" alt="${alt(A)}" draggable="false">
        <span class="photo-slider__handle" aria-hidden="true"></span>
        <span class="photo-slider__tag">${fmtShort(A)}</span><span class="photo-slider__tag photo-slider__tag--b">${fmtShort(B)}</span>
      </div>`;
    }

    const days = photoDates().reverse();
    el.innerHTML = `
      <div class="card">
        <div class="card__head">
          <div class="segmented" role="group" aria-label="Pose">
            ${POSES.map((p) => `<button type="button" data-pose="${p.key}" aria-pressed="${p.key === pose}" ${photoDates(p.key).length ? '' : 'disabled'}>${p.label}</button>`).join('')}
          </div>
          ${dates.length > 1 ? `<div class="segmented" role="group" aria-label="View">
            <button type="button" data-photo-mode="slider" aria-pressed="${ui.photoMode !== 'side'}">Slider</button>
            <button type="button" data-photo-mode="side" aria-pressed="${ui.photoMode === 'side'}">Side by side</button>
          </div>` : ''}
        </div>
        ${dates.length > 1 ? `<div class="compare-pick" style="margin-bottom:14px">
          <label class="field"><span class="field__label">From</span><select class="select" id="photoA">${opts(A)}</select></label>
          <span class="compare-pick__arrow" aria-hidden="true">→</span>
          <label class="field"><span class="field__label">To</span><select class="select" id="photoB">${opts(B)}</select></label>
        </div>` : ''}
        ${cmp}
      </div>
      <h2 class="section-title">All photos · ${photos.length}</h2>
      ${days.map((d) => `<div class="card photo-day">
        <div class="photo-day__head"><span>${fmtDate(d)}</span><button type="button" class="inline-link" data-add-photos="${d}">Edit</button></div>
        <div class="photo-day__grid">${POSES.map((p) => {
          const ph = photoOf(d, p.key);
          return ph
            ? `<button type="button" class="thumb" data-photo="${ph.id}"><img src="${photoUrl(ph)}" alt="${p.label} photo from ${fmtDate(d)}" loading="lazy"><span>${p.label}</span></button>`
            : `<button type="button" class="thumb thumb--empty" data-add-photos="${d}"><span>+ ${p.label}</span></button>`;
        }).join('')}</div>
      </div>`).join('')}
      <p class="hint" style="text-align:center">Photos are stored on this device only. Include them in your backup via Settings.</p>`;
  }

  // Foto's toevoegen
  const photoSheet = $('#photoSheet');
  const photoForm = $('#photoForm');
  let pending = {};
  const pendingUrls = [];
  function renderSlots() {
    const date = photoForm.date.value;
    $('#poseSlots').innerHTML = POSES.map((p) => {
      const file = pending[p.key];
      let src = '';
      if (file) { src = URL.createObjectURL(file); pendingUrls.push(src); }
      else { const ex = photoOf(date, p.key); if (ex) src = photoUrl(ex); }
      return `<label class="pose-slot${src ? ' has-img' : ''}">
        <input class="sr" type="file" accept="image/*" data-slot="${p.key}">
        <span class="pose-slot__img">${src ? `<img src="${src}" alt="">` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'}</span>
        <span class="pose-slot__label">${p.label}${src && !file ? ' · replace' : ''}</span>
      </label>`;
    }).join('');
  }
  function openPhotoSheet(date = todayISO()) {
    pending = {};
    photoForm.date.value = date;
    renderSlots();
    photoSheet.showModal();
  }
  photoSheet.addEventListener('close', () => { pendingUrls.splice(0).forEach((u) => URL.revokeObjectURL(u)); pending = {}; });
  photoForm.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'date') renderSlots();
    else if (t.dataset.slot && t.files[0]) { pending[t.dataset.slot] = t.files[0]; renderSlots(); }
  });
  photoForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const date = photoForm.date.value;
    if (!date) { photoForm.date.focus(); return; }
    const poses = Object.keys(pending);
    if (!poses.length) { toast('Pick at least one photo'); return; }
    const btn = photoForm.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      for (const pose of poses) {
        const { blob, w, h } = await compressImage(pending[pose]);
        const rec = { id: `${date}_${pose}`, date, pose, blob, w, h, t: Date.now() };
        await PhotoDB.put(rec);
        dropUrl(rec.id);
        photos = photos.filter((p) => p.id !== rec.id).concat(rec);
      }
      ui.photoB = date;
      toast(poses.length > 1 ? 'Photos saved' : 'Photo saved');
      photoSheet.close();
      render();
    } catch {
      toast('Saving failed: storage full or photo unreadable');
    } finally { btn.disabled = false; btn.textContent = 'Save'; }
  });

  // Foto bekijken / verwijderen
  const viewer = $('#photoViewer');
  let viewing = null;
  function openViewer(id) {
    viewing = photos.find((p) => p.id === id);
    if (!viewing) return;
    $('#viewerImg').src = photoUrl(viewing);
    $('#viewerImg').alt = `${poseLabel(viewing.pose)} photo from ${fmtDate(viewing.date)}`;
    $('#viewerCap').textContent = `${poseLabel(viewing.pose)} · ${fmtDate(viewing.date)}`;
    viewer.showModal();
  }
  $('#viewerDelete').addEventListener('click', async () => {
    if (!viewing || !await ask(`Delete ${poseLabel(viewing.pose).toLowerCase()} photo from ${fmtDate(viewing.date)}? This can’t be undone.`, 'Delete')) return;
    try {
      await PhotoDB.del(viewing.id);
      photos = photos.filter((p) => p !== viewing);
      dropUrl(viewing.id);
      viewer.close();
      toast('Photo deleted');
      render();
    } catch { toast('Delete failed'); }
  });

  // Schuifbalk: slepen of tikken, en pijltjestoetsen.
  function setSlider(sl, pct) {
    pct = Math.max(0, Math.min(100, pct));
    sl.style.setProperty('--pos', pct + '%');
    sl.setAttribute('aria-valuenow', Math.round(pct));
  }
  document.addEventListener('pointerdown', (ev) => {
    const sl = ev.target.closest('.photo-slider');
    if (!sl) return;
    const set = (e) => { const r = sl.getBoundingClientRect(); setSlider(sl, ((e.clientX - r.left) / r.width) * 100); };
    set(ev);
    sl.setPointerCapture(ev.pointerId);
    const end = () => { sl.removeEventListener('pointermove', set); sl.removeEventListener('pointerup', end); sl.removeEventListener('pointercancel', end); };
    sl.addEventListener('pointermove', set);
    sl.addEventListener('pointerup', end);
    sl.addEventListener('pointercancel', end);
  });
  document.addEventListener('keydown', (ev) => {
    const sl = ev.target.closest?.('.photo-slider');
    if (!sl || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    ev.preventDefault();
    setSlider(sl, Number(sl.getAttribute('aria-valuenow')) + (ev.key === 'ArrowLeft' ? -5 : 5));
  });

  const b64ToBlob = (dataUrl) => {
    const [head, body] = dataUrl.split(',');
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' });
  };
  const blobToB64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  // Nog te bouwen categorieën
  function renderSoon(title, text) {
    return () => {
      viewEl(ui.view).innerHTML = `<div class="card empty"><span class="soon">Coming soon</span><h2>${title}</h2><p>${text}</p></div>`;
    };
  }
  const renderFood = renderSoon('Calorie tracking', 'Your nutrition will live here: what you eat, your calories and protein per day.');

  const RENDER = { overview: renderOverview, log: renderLog, compare: renderCompare, photos: renderPhotos, food: renderFood, settings: renderSettings };

  function render() {
    if (!RENDER[ui.view]) ui.view = 'overview';
    for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== ui.view;
    const group = groupOf(ui.view);
    document.body.dataset.group = group;
    document.body.classList.toggle('has-subnav', !!group);
    for (const t of document.querySelectorAll('.tab, .subtab')) {
      const on = t.dataset.tab ? t.dataset.tab === ui.view : (t.id === 'bodyTab' && group === 'body') || (t.id === 'gymTab' && group === 'gym');
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    }
    $('#viewTitle').textContent = TITLES[ui.view];
    document.title = ui.view === 'overview' ? 'Gainly' : `${TITLES[ui.view]} · Gainly`;
    const fab = $('#fab');
    fab.hidden = !['overview', 'log', 'photos'].includes(ui.view);
    fab.setAttribute('aria-label', ui.view === 'photos' ? 'Add photos' : 'New measurement');
    RENDER[ui.view]();
    gym?.afterRender?.();
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
    $('#measureFields').innerHTML = Object.entries(groups).map(([g, list], gi) => `
      <fieldset class="fieldset"><legend>${g}</legend>
        ${g === 'Circumference' ? '<p class="measure-tip">Always measure at the same moment (e.g. in the morning before breakfast), on bare skin, with the tape snug but not digging in. Tap <b>i</b> for how to measure each one.</p>' : ''}
        <div class="field-grid${gi === 0 ? ' field-grid--one' : ''}">
        ${list.map((m) => `<div class="field">
          <div class="field__row">
            <label class="field__label" for="m_${m.key}">${m.label} <small>${m.unit}</small></label>
            <button type="button" class="info" data-tip="${m.key}" aria-expanded="false" aria-controls="tip_${m.key}" aria-label="How do I measure ${m.label.toLowerCase()}?">i</button>
          </div>
          <input id="m_${m.key}" name="m_${m.key}" inputmode="decimal" autocomplete="off">
          <p class="field__tip" id="tip_${m.key}" hidden>${esc(tipFor(m.key))}</p>
        </div>`).join('')}
      </div></fieldset>`).join('');
  }

  function openMeasure(entry = null, { quick = false } = {}) {
    editingEntry = entry;
    measureForm.reset();
    measureSheet.classList.toggle('is-quick', quick);
    for (const t of measureForm.querySelectorAll('.field__tip')) t.hidden = true;
    for (const b of measureForm.querySelectorAll('.info')) b.setAttribute('aria-expanded', 'false');
    $('#measureTitle').textContent = quick ? 'Quick weigh-in' : entry ? 'Edit measurement' : 'New measurement';
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
    if (quick) measureForm.m_weight.focus();
  }

  measureForm.addEventListener('click', (ev) => {
    const b = ev.target.closest('.info');
    if (!b) return;
    const tip = $('#tip_' + b.dataset.tip);
    tip.hidden = !tip.hidden;
    b.setAttribute('aria-expanded', String(!tip.hidden));
  });

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
    if (bad) { bad.focus(); toast('Check the value outlined in red'); return; }
    if (!Object.keys(values).length) { toast('Enter at least one measurement'); return; }
    const note = measureForm.note.value.trim();

    if (editingEntry) {
      Object.assign(editingEntry, { date, values, note });
      const clash = state.entries.find((e) => e !== editingEntry && e.date === date);
      if (clash) { // samenvoegen met bestaande meting op die datum
        editingEntry.values = { ...clash.values, ...values };
        editingEntry.note = [clash.note, note].filter(Boolean).join(' · ');
        state.entries = state.entries.filter((e) => e !== clash);
      }
      toast('Measurement updated');
    } else {
      const existing = state.entries.find((e) => e.date === date);
      if (existing) {
        existing.values = { ...existing.values, ...values };
        if (note) existing.note = [existing.note, note].filter(Boolean).join(' · ');
        toast('Added to the measurement of ' + fmtShort(date));
      } else {
        state.entries.push({ id: uid(), date, values, note });
        toast('Measurement saved');
      }
    }
    save();
    measureSheet.close();
    render();
    syncMilestones(true);
  });

  $('#measureDelete').addEventListener('click', async () => {
    if (!editingEntry || !await ask(`Delete the measurement from ${fmtDate(editingEntry.date)}?`, 'Delete')) return;
    state.entries = state.entries.filter((e) => e !== editingEntry);
    save({ allowEmpty: true });
    measureSheet.close();
    toast('Measurement deleted');
    render();
  });

  for (const dlg of [measureSheet, photoSheet, viewer, celebrateDlg]) {
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close();
    });
  }

  /* ---------------- Backup ---------------- */
  async function exportData(withPhotos = false) {
    const payload = { app: 'gainly', version: 1, exported: new Date().toISOString(), ...state };
    if (withPhotos) {
      toast('Packing photos…');
      payload.photos = await Promise.all(photos.map(async (p) => ({ id: p.id, date: p.date, pose: p.pose, w: p.w, h: p.h, t: p.t, data: await blobToB64(p.blob) })));
    }
    const json = JSON.stringify(payload, null, withPhotos ? 0 : 2);
    const name = `gainly-backup-${todayISO()}${withPhotos ? '-with-photos' : ''}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Gainly backup' }); markExported(); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    markExported();
  }
  function markExported() { state.settings = { ...state.settings, lastExport: todayISO() }; save(); render(); }

  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.entries)) throw new Error('format');
      // Foto's gaan naar IndexedDB, nooit mee in de gewone opslag.
      const { photos: incoming, ...rest } = data;
      const pics = Array.isArray(incoming) ? incoming.filter((p) => p && p.id && p.date && p.pose && typeof p.data === 'string') : [];
      const next = normalize(rest);
      if (!await ask(`Import backup with ${plural(next.entries.length, 'measurement', 'measurements')}${next.gym && next.gym.workouts ? ` and ${plural(next.gym.workouts.length, 'workout', 'workouts')}` : ''}${pics.length ? ` and ${pics.length} photos` : ''}? This replaces your current data${pics.length ? '; photos are added' : ''}.`, 'Import')) return;
      snapshot('restore');
      state = next;
      applyTheme();
      save();
      syncMilestones(false);
      let failed = 0;
      for (const p of pics) {
        try {
          const rec = { id: p.id, date: p.date, pose: p.pose, w: p.w, h: p.h, t: p.t || Date.now(), blob: b64ToBlob(p.data) };
          await PhotoDB.put(rec);
          dropUrl(rec.id);
          photos = photos.filter((x) => x.id !== rec.id).concat(rec);
        } catch { failed++; }
      }
      toast(failed ? `Imported, but ${failed} photos failed` : 'Backup imported');
      render();
    } catch {
      toast('This isn’t a valid Gainly backup file');
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
    return { ...state, entries, settings: { ...state.settings, goalWeight: 82 } }; // trainingen blijven staan
  }

  /* ---------------- Events ---------------- */
  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button, [data-tab-go]');
    if (!t) return;
    if (t.id === 'bodyTab') return go(BODY_VIEWS.includes(ui.view) ? ui.view : 'overview');
    if (t.id === 'gymTab') return go(GYM_VIEWS.includes(ui.view) ? ui.view : 'gym');
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.tabGo) return go(t.dataset.tabGo);
    if (t.dataset.goalType) {
      if ((state.settings.goalType || 'cut') === t.dataset.goalType) return;
      // Nieuwe fase: start vandaag (aan te passen onder Profiel).
      state.settings = { ...state.settings, goalType: t.dataset.goalType, goalStart: todayISO() };
      save(); syncMilestones(false);
      toast(`${t.dataset.goalType === 'bulk' ? 'Bulk' : 'Cut'} started today. Change the date if that’s not right.`);
      return render();
    }
    if (t.dataset.mode) return setTheme({ mode: t.dataset.mode });
    if (t.dataset.accent) return setTheme({ accent: t.dataset.accent });
    if (t.dataset.range) { ui.range = t.dataset.range; return render(); }
    if (t.dataset.metric) {
      ui.metric = t.dataset.metric;
      render();
      $('#mainChart')?.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (t.dataset.restore) {
      const x = snapshots()[Number(t.dataset.restore)];
      if (!x || !await ask(`Restore data from ${fmtDate(x.day)} (${plural(x.count, 'measurement', 'measurements')})? Your current data becomes a restore point first.`, 'Restore')) return;
      snapshot('restore');
      state = normalize(x.data); save({ allowEmpty: true }); applyTheme(); syncMilestones(false); toast('Restored'); return go('overview');
    }
    if (t.dataset.editEntry) return openMeasure(state.entries.find((e) => e.id === t.dataset.editEntry));
    if (t.dataset.pose) { ui.photoPose = t.dataset.pose; return render(); }
    if (t.dataset.photoMode) { ui.photoMode = t.dataset.photoMode; return render(); }
    if (t.dataset.addPhotos) return openPhotoSheet(t.dataset.addPhotos);
    if (t.dataset.photo) return openViewer(t.dataset.photo);
    switch (t.dataset.action) {
      case 'add-measure': return openMeasure();
      case 'add-photos': return openPhotoSheet();
      case 'export': return exportData();
      case 'export-photos': return exportData(true);
      case 'import': return $('#importFile').click();
      case 'demo':
        if (state.entries.length && !await ask('Demo data replaces your current measurements. Continue?', 'Continue')) return;
        snapshot('restore'); state = demoData(); save(); syncMilestones(false); toast('Demo data loaded'); return go('overview');
      case 'wipe': {
        if (!await ask(`Permanently erase all measurements, workouts${photos.length ? ' and photos' : ''}? Make a backup first if you’re unsure.`, 'Erase')) return;
        snapshot('restore'); state = { entries: [], settings: state.settings }; save({ allowEmpty: true }); // ook trainingen
        PhotoDB.clear().catch(() => {});
        photos.forEach((p) => dropUrl(p.id)); photos = [];
        toast('Everything erased'); return render();
      }
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'metricSelect') { ui.metric = t.value; render(); }
    else if (t.id === 'cmpA') { ui.cmpA = t.value; render(); }
    else if (t.id === 'cmpB') { ui.cmpB = t.value; render(); }
    else if (t.id === 'photoA') { ui.photoA = t.value; render(); }
    else if (t.id === 'photoB') { ui.photoB = t.value; render(); }
    else if (t.id === 'importFile' && t.files[0]) { importData(t.files[0]); t.value = ''; }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'settingsForm') return;
    ev.preventDefault();
    const f = ev.target;
    const height = parseNum(f.height.value);
    const goalWeight = parseNum(f.goalWeight.value);
    const hBad = Number.isNaN(height) || (height != null && (height < 100 || height > 250));
    const gBad = Number.isNaN(goalWeight) || (goalWeight != null && (goalWeight < 30 || goalWeight > 300));
    f.height.setAttribute('aria-invalid', hBad);
    f.goalWeight.setAttribute('aria-invalid', gBad);
    if (hBad || gBad) { toast('Check your height and goal weight'); return; }
    const goalStart = f.goalStart.value || null;
    state.settings = { ...state.settings, height, goalWeight, goalStart };
    save();
    syncMilestones(false);
    toast('Profile saved');
  });

  // + : tikken = volledige meting (of foto's op het fototabblad), ingedrukt houden = snel wegen.
  const fab = $('#fab');
  let pressTimer = null, longFired = false;
  fab.addEventListener('pointerdown', () => {
    longFired = false;
    clearTimeout(pressTimer);
    fab.classList.add('is-pressing');
    pressTimer = setTimeout(() => { longFired = true; navigator.vibrate?.(12); }, 450);
  });
  const endPress = (open) => {
    clearTimeout(pressTimer);
    fab.classList.remove('is-pressing');
    if (open && longFired) openMeasure(null, { quick: true });
  };
  fab.addEventListener('pointerup', () => endPress(true));
  fab.addEventListener('pointercancel', () => { endPress(false); longFired = false; });
  fab.addEventListener('contextmenu', (ev) => ev.preventDefault());
  fab.addEventListener('click', () => {
    if (longFired) { longFired = false; return; }
    if (ui.view === 'photos') openPhotoSheet(); else openMeasure();
  });

  // Own confirm dialog: iOS may silently block the browser's built-in dialogs in home-screen apps.
  const confirmDlg = $('#confirmDlg');
  let confirmResolve = null;
  function ask(msg, ok = 'OK') {
    $('#confirmMsg').textContent = msg;
    $('#confirmOk').textContent = ok;
    if (confirmDlg.open) confirmDlg.close();
    confirmDlg.showModal();
    return new Promise((res) => { confirmResolve = res; });
  }
  confirmDlg.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ans]');
    if (!b && ev.target !== confirmDlg) return;
    const r = confirmResolve; confirmResolve = null;
    confirmDlg.close();
    r?.(!!b && b.dataset.ans === '1');
  });
  confirmDlg.addEventListener('cancel', () => { const r = confirmResolve; confirmResolve = null; r?.(false); });

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

  /* ---------------- Keyboard ---------------- */
  // While typing, hide the bottom bars (iOS sometimes floats fixed bars above the keyboard)
  // and expose the keyboard height as --kb so floating items can sit right above it.
  const isTyping = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'date', 'range', 'button', 'submit'].includes(el.type)));
  const vv = window.visualViewport;
  function syncKeyboard() {
    const typing = isTyping(document.activeElement);
    document.body.classList.toggle('kb-open', typing);
    const kb = vv && typing ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--kb', kb + 'px');
  }
  document.addEventListener('focusin', syncKeyboard);
  document.addEventListener('focusout', () => setTimeout(syncKeyboard, 60));
  vv?.addEventListener('resize', syncKeyboard);
  vv?.addEventListener('scroll', syncKeyboard);
  // Safety net: if a focus event is ever missed, the bars never stay hidden for long.
  setInterval(() => { if (document.body.classList.contains('kb-open') !== isTyping(document.activeElement)) syncKeyboard(); }, 500);

  /* ---------------- Start ---------------- */
  // Opstartscherm weghalen zodra de uitfade-animatie klaar is (CSS verbergt het sowieso).
  const splash = $('#splash');
  splash?.addEventListener('animationend', (ev) => { if (ev.animationName === 'splash-out') splash.remove(); });

  // Gym-module (gym.js) koppelen
  let gym = null;
  if (window.GainlyGym) {
    gym = window.GainlyGym({
      get state() { return state; }, save, toast, render, go, ui, $, esc, fmt, fmtSigned, fmtDate, fmtShort, toDate, toISO,
      todayISO, addDays, daysBetween, parseNum, uid, plural, chev, lineChart, emptyState, viewEl, DF_WEEKDAY, snapshot, ask,
    });
    Object.assign(RENDER, gym.views);
    Object.assign(TITLES, gym.titles);
  }

  buildMeasureFields();
  applyTheme();
  // Eerste keer met mijlpalen: wat al behaald was, stil markeren (geen felicitatie-regen).
  if (!Array.isArray(state.settings.milestones) && state.entries.length) syncMilestones(false);
  render();
  loadPhotos();

  // Vraag iOS de opslag niet automatisch op te ruimen.
  navigator.storage?.persist?.().catch(() => {});

  // Updates: een nieuwe versie wacht tot jij op "Bijwerken" tikt.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const banner = $('#updateBanner');
    const offer = (worker) => {
      banner.hidden = false;
      $('#updateNow').onclick = () => {
        snapshot('update');
        worker.postMessage('activate');
      };
    };
    $('#updateLater').addEventListener('click', () => { banner.hidden = true; });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return; reloading = true; location.reload();
    });
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
          });
        });
        reg.update().catch(() => {});
      } catch { /* geen service worker */ }
    });
  }
})();
