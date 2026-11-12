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
    { key: 'weight',    label: 'Gewicht',        unit: 'kg', dir: -1, group: 'Lichaam' },
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

  const TITLES = { overview: 'Overzicht', log: 'Metingen', compare: 'Vergelijk', photos: "Foto's", food: 'Voeding', gym: 'Gym', settings: 'Instellingen' };
  // Categorieën in het menu: Lichaam heeft een tweede balk met zijn vier pagina's.
  const BODY_VIEWS = ['overview', 'compare', 'photos', 'log'];

  // Uitleg per meetplek (L/R delen dezelfde tekst).
  const TIPS = {
    weight: "Weeg je 's ochtends na het toilet, nuchter en in ondergoed, altijd op dezelfde weegschaal op een harde vloer. Schommelingen van een kilo per dag zijn normaal: kijk naar de trend.",
    neck: 'Net onder de adamsappel, het lint aan de voorkant iets schuin naar beneden. Recht vooruit kijken, schouders ontspannen.',
    shoulders: 'Rond het breedste punt van je schouders, over de bovenarmen. Armen ontspannen langs je lichaam. Lukt het best met iemand die helpt.',
    chest: 'Over de tepels en onder de oksels door, lint horizontaal. Meet na een normale uitademing.',
    waist: 'Halverwege je onderste rib en de bovenkant van je heupbeen, meestal het smalste punt. Na een normale uitademing, buik niet intrekken.',
    belly: 'Precies over je navel, lint horizontaal. Ontspannen staan, na een normale uitademing.',
    hips: 'Rond het breedste punt van je billen, voeten tegen elkaar. Kijk in de spiegel of het lint overal horizontaal zit.',
    arm: 'Op het dikste punt van je bovenarm, arm ontspannen naast je lichaam (niet aanspannen). Meet elke keer op dezelfde plek.',
    forearm: 'Op het dikste punt net onder de elleboog, hand open en ontspannen.',
    thigh: 'Ongeveer 15 cm boven de knieschijf (of net onder de bil), gewicht op beide benen. Kies één plek en blijf die gebruiken.',
    calf: 'Op het dikste punt van je kuit, staand met je gewicht op beide benen.',
  };
  const tipFor = (key) => TIPS[key] || TIPS[key.replace(/[LR]$/, '')];

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
      if (!data.entries || !data.entries.length) return;
      const list = snapshots().filter((x) => x.day !== todayISO() || reason !== 'auto');
      list.unshift({ day: todayISO(), at: new Date().toISOString(), reason, count: data.entries.length, data });
      localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, 10)));
    } catch { /* opslag vol: herstelpunt overslaan */ }
  }

  function save({ allowEmpty = false } = {}) {
    try {
      // Nooit een gevulde opslag stilletjes vervangen door een lege.
      if (!allowEmpty && !state.entries.length) {
        const prev = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (prev && prev.entries && prev.entries.length) { state = normalize(prev); toast('Opslaan geweigerd om gegevensverlies te voorkomen'); return; }
      }
      if (!snapshots().some((x) => x.day === todayISO())) snapshot('auto');
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch { toast('Opslaan mislukt: opslag vol of geblokkeerd'); }
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
  const sinceLabel = () => (phaseStart() ? `Sinds ${fmtShort(phaseStart())}` : 'Sinds start');
  const msId = (id) => (phaseStart() ? `${phaseStart()}:${id}` : id);

  function lastValue(key) { const s = series(key); return s.length ? s[s.length - 1] : null; }

  // Doel bepaalt welke richting 'goed' is: cutten = kleiner, bulken = groter (taille liefst stabiel).
  const isBulk = () => state.settings.goalType === 'bulk';
  const BULK_DIR = { weight: 1, neck: 0, shoulders: 1, chest: 1, waist: -1, belly: 0, hips: 0, armL: 1, armR: 1, forearmL: 1, forearmR: 1, thighL: 1, thighR: 1, calfL: 1, calfR: 1 };
  const dirOf = (m) => (m.key && isBulk() ? BULK_DIR[m.key] ?? m.dir : m.dir);
  const TAPE_TOTAL = () => ({ dir: isBulk() ? 0 : -1, unit: 'cm' });

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
          <div class="progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="Voortgang naar streefgewicht"><span style="width:${pct * 100}%"></span></div>
          <div class="progress__text"><span>${reached ? 'Doel bereikt 🎉' : `Nog ${fmt(Math.abs(left))} kg tot ${fmt(s.goalWeight)} kg`}</span><span>${Math.round(pct * 100)}%</span></div>
        </div>`;
      }
      hero = `<div class="card">
        <p class="eyebrow">Gewicht · ${fmtDate(last.date)}</p>
        <p class="hero__value">${fmt(last.value)}<small>kg</small></p>
        <div class="stats">
          <div class="stat"><span class="stat__label">${sinceLabel()}</span><span class="stat__value">${pw.length > 1 ? deltaHTML(M.weight, last.value - first.value) : '—'}</span></div>
          <div class="stat"><span class="stat__label">7 dagen</span><span class="stat__value">${d7 != null ? deltaHTML(M.weight, d7) : '—'}</span></div>
          <div class="stat"><span class="stat__label">30 dagen</span><span class="stat__value">${d30 != null ? deltaHTML(M.weight, d30) : '—'}</span></div>
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
          <select class="select" id="metricSelect" aria-label="Kies een maat">
            ${available.map((mm) => `<option value="${mm.key}" ${mm.key === ui.metric ? 'selected' : ''}>${mm.label}</option>`).join('')}
          </select>
          <div class="segmented" role="group" aria-label="Periode">
            ${RANGES.map((r) => `<button type="button" data-range="${r.key}" aria-pressed="${r.key === ui.range}">${r.label}</button>`).join('')}
          </div>
        </div>
        <div class="chart" id="mainChart"></div>
      </div>
      <h2 class="section-title">Alle maten · ${sinceLabel().toLowerCase()}</h2>
      <div class="metric-grid">${cards}</div>
      <p class="hint" style="text-align:center">Houd + ingedrukt om snel alleen je gewicht in te geven.</p>`;

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
    if (Math.abs(f.perWeek) < 0.05) txt = `Je gewicht is stabiel de laatste ${plural(f.weeks, 'week', 'weken')}.`;
    else if (g && !reached) {
      const need = g - last.value;
      if (Math.sign(need) === Math.sign(f.slope)) {
        const days = Math.round(need / f.slope);
        txt = days > 3 * 365
          ? `Aan je tempo van ${pw} duurt het nog meer dan drie jaar tot ${fmt(g)} kg.`
          : `Aan je tempo van ${pw} bereik je ${fmt(g)} kg rond <strong>${fmtDate(addDays(last.date, days))}</strong>.`;
      } else txt = `Je tempo is ${pw}, weg van je doel van ${fmt(g)} kg.`;
    } else if (!g) txt = `Je tempo: ${pw}. <button type="button" class="inline-link" data-tab-go="settings">Stel een streefgewicht in</button> om te zien wanneer je het haalt.`;
    else txt = `Je tempo: ${pw}.`;
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
    const since = phaseStart() ? `sinds ${fmtShort(phaseStart())}` : 'dan bij je eerste meting';
    if (w.length > 1) {
      const start = w[0].value;
      const bulk = isBulk();
      const hit = new Set();
      for (const p of w) for (const k of MS_KG) {
        const moved = bulk ? p.value - start : start - p.value;
        if (hit.has(k) || moved < k - 1e-9) continue;
        hit.add(k);
        out.push(bulk
          ? { id: msId('gkg' + k), date: p.date, icon: '💪', title: `+${kgTxt(k)} kg`, text: `Je weegt ${kgTxt(k)} kg meer ${since}.` }
          : { id: msId('kg' + k), date: p.date, icon: '⚖️', title: `−${kgTxt(k)} kg`, text: `Je weegt ${kgTxt(k)} kg minder ${since}.` });
      }
      const g = state.settings.goalWeight;
      if (g && (bulk ? g > start : g < start)) {
        const p = w.find((x) => (bulk ? x.value >= g - 0.05 : x.value <= g + 0.05));
        if (p) out.push({ id: msId('goal' + g), date: p.date, icon: '🏆', title: 'Doel bereikt', text: `Je hebt je streefgewicht van ${fmt(g)} kg gehaald.` });
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
          out.push({ id: msId(key + '+' + k), date: p.date, icon, title: `${label} +${k} cm`, text: `Je ${label.toLowerCase()} is ${k} cm groter dan bij de start.` });
        }
      };
      grow('armR', [1, 2, 3, 4, 5], '💪', 'Bovenarm');
      grow('chest', [3, 5, 10, 15], '🏋️', 'Borst');
      grow('shoulders', [3, 5, 10, 15], '🏋️', 'Schouders');
    }
    const entries = entriesAsc();
    if (!isBulk()) { // taille- en omtrekmijlpalen alleen bij afvallen
      const wa = phaseSeries('waist');
      if (wa.length > 1) {
        const hit = new Set();
        for (const p of wa) for (const k of MS_WAIST) {
          if (hit.has(k) || wa[0].value - p.value < k - 1e-9) continue;
          hit.add(k);
          out.push({ id: msId('waist' + k), date: p.date, icon: '📏', title: `Taille −${k} cm`, text: `Je taille is ${k} cm smaller dan bij de start.` });
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
          out.push({ id: msId('tape' + k), date: e.date, icon: '🎯', title: `−${k} cm omtrek`, text: `Al je omtrekken samen zijn ${k} cm kleiner dan bij de start.` });
        }
      }
    }
    for (const n of MS_COUNT) {
      if (entries.length >= n) out.push({ id: 'n' + n, date: entries[n - 1].date, icon: '🗓️', title: `${n} metingen`, text: `Je hebt al ${n} keer gemeten. Volhouden loont.` });
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
    $('#celebrateMore').textContent = more.length ? `En ook: ${more.join(', ')}` : '';
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
      el.innerHTML = emptyState('Nog geen metingen', 'Elke meting die je toevoegt, verschijnt hier. Tik erop om ze aan te passen of te verwijderen.', 'add-measure', 'Meting toevoegen');
      return;
    }
    el.innerHTML = `${logHTML()}<p class="hint" style="text-align:center">Tik op een meting om ze aan te passen of te verwijderen.</p>`;
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
    if (!dates.includes(ui.cmpA)) {
      const d0 = phaseStart();
      ui.cmpA = (d0 && [...dates].reverse().find((d) => d <= d0)) || dates[0];
    }
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
        <div class="stat"><span class="stat__label">${perWeek != null ? 'Per week' : 'Omtrek'}</span><span class="stat__value">${perWeek != null ? deltaHTML(M.weight, perWeek, 2) : tapeCount ? deltaHTML(TAPE_TOTAL(), tapeDelta) : '—'}</span></div>
      </div>
      ${perWeek != null && tapeCount ? `<div class="stat"><span class="stat__label">Totale omtrek (${plural(tapeCount, 'maat', 'maten')})</span><span class="stat__value">${deltaHTML(TAPE_TOTAL(), tapeDelta)}</span></div>` : ''}
      ${bodyHTML(A, B)}
      <div class="card">
        <table class="table">
          <thead><tr><th scope="col">Maat</th><th scope="col">${fmtShort(A)}</th><th scope="col">${fmtShort(B)}</th><th scope="col">Verschil</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p class="hint">Een kleine datum onder een waarde betekent dat die maat op die dag niet gemeten is; dan staat de meest recente meting ervoor.</p>`;
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
      <h2 class="card__title">Per meetplek</h2>
      <p class="hint" style="margin:4px 0 6px">Groen is de goede richting, rood de andere. Links en rechts zoals in de spiegel.</p>
      <svg class="body" viewBox="0 0 ${W} ${H}" role="img" aria-label="Lichaamsschets met het verschil per meetplek">${FIGURE}${svg}</svg>
    </div>`;
  }

  /* ---------------- Thema ---------------- */
  // Elk thema is één tint (OKLCH-hue): achtergrond, vlakken, randen, tekst en accent worden er allemaal van afgeleid (styles.css).
  const ACCENTS = [
    { key: 'leisteen', label: 'Leisteen' },
    { key: 'zand', label: 'Zand' },
  ];
  const MODES = [{ key: 'system', label: 'Automatisch' }, { key: 'dark', label: 'Donker' }, { key: 'light', label: 'Licht' }];
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
      <h2 class="card__title" style="margin-bottom:14px">Thema</h2>
      <div class="segmented segmented--full" role="group" aria-label="Weergave">
        ${MODES.map((m) => `<button type="button" data-mode="${m.key}" aria-pressed="${m.key === t.mode}">${m.label}</button>`).join('')}
      </div>
      <div class="swatches" role="group" aria-label="Accentkleur">
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
      <h2 class="card__title" style="margin-bottom:6px">Herstelpunten</h2>
      <p class="prose" style="margin-bottom:10px">De app bewaart automatisch een kopie per dag (laatste 10). Tik om terug te zetten.</p>
      <div class="list">${list.map((x, i) => `<button class="list__item" data-restore="${i}">
        <div class="list__main"><div class="list__title">${fmtDate(x.day)}</div><div class="list__sub">${x.reason === 'update' ? 'Voor een update' : x.reason === 'restore' ? 'Voor het terugzetten' : 'Automatisch'}</div></div>
        <div class="list__end">${plural(x.count, 'meting', 'metingen')}</div>${chev}</button>`).join('')}</div>
    </div>`;
  }

  /* ---------------- Settings ---------------- */
  function renderSettings() {
    const el = viewEl('settings');
    const s = state.settings;
    el.innerHTML = `
      <form class="card" id="settingsForm" novalidate>
        <h2 class="card__title" style="margin-bottom:14px">Profiel</h2>
        <span class="field__label" style="display:block;margin-bottom:6px">Doel</span>
        <div class="segmented segmented--full" role="group" aria-label="Doel" style="margin-bottom:14px">
          <button type="button" data-goal-type="cut" aria-pressed="${!isBulk()}">Afvallen (cutten)</button>
          <button type="button" data-goal-type="bulk" aria-pressed="${isBulk()}">Bijkomen (bulken)</button>
        </div>
        <div class="field-grid">
          <label class="field"><span class="field__label">Lengte <small>cm</small></span><input name="height" inputmode="decimal" value="${s.height ? fmt(s.height, 0) : ''}" placeholder="180"></label>
          <label class="field"><span class="field__label">Streefgewicht <small>kg</small></span><input name="goalWeight" inputmode="decimal" value="${s.goalWeight ? fmt(s.goalWeight) : ''}" placeholder="75,0"></label>
        </div>
        <label class="field"><span class="field__label">${isBulk() ? 'Bulk' : 'Cut'} gestart op</span><input type="date" name="goalStart" value="${s.goalStart || ''}"></label>
        <p class="hint" style="margin-top:-6px">Vanaf deze datum rekenen "sinds start", je doelbalk en je mijlpalen. Leeg = vanaf je eerste meting.</p>
        <button class="button button--primary" type="submit">Bewaar profiel</button>
      </form>

      ${themeHTML()}

      <div class="card">
        <h2 class="card__title" style="margin-bottom:6px">Back-up</h2>
        <p class="prose" style="margin-bottom:14px">Je gegevens staan alleen op dit toestel (${plural(state.entries.length, 'meting', 'metingen')}). ${s.lastExport ? `Laatste back-up: ${fmtDate(s.lastExport)}.` : '<strong style="color:var(--bad)">Nog geen back-up gemaakt.</strong>'} Bewaar er af en toe een in Bestanden of iCloud Drive; dat is de enige kopie buiten de app.</p>
        <div class="button-row">
          <button class="button" data-action="export">Exporteer</button>
          <button class="button" data-action="import">Importeer</button>
          ${photos.length ? `<button class="button button-row__wide" data-action="export-photos">Exporteer met foto's (${photos.length})</button>` : ''}
        </div>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
      </div>

      ${snapshotsHTML()}

      <div class="card">
        <h2 class="card__title" style="margin-bottom:10px">Gegevens</h2>
        <div class="button-row">
          <button class="button" data-action="demo">Demodata laden</button>
          <button class="button button--danger" data-action="wipe">Alles wissen</button>
        </div>
      </div>`;
  }

  /* ---------------- Foto's (IndexedDB, alleen op dit toestel) ---------------- */
  const POSES = [{ key: 'front', label: 'Voor' }, { key: 'side', label: 'Zij' }, { key: 'back', label: 'Achter' }];
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
    if (!photosLoaded) { el.innerHTML = '<p class="hint" style="text-align:center">Foto\'s laden…</p>'; return; }
    if (!photos.length) {
      el.innerHTML = emptyState('Progressiefoto\'s', 'Neem foto\'s van voren, opzij en van achteren, telkens op dezelfde plek en met hetzelfde licht. Ze blijven alleen op dit toestel.', 'add-photos', 'Eerste foto\'s toevoegen');
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
    const alt = (d) => `${poseLabel(pose)}foto van ${fmtDate(d)}`;

    let cmp;
    if (dates.length < 2) {
      cmp = `<figure class="photo-single"><img src="${photoUrl(b)}" alt="${alt(B)}"><figcaption>${fmtDate(B)}</figcaption></figure>
        <p class="hint" style="margin:12px 0 0">Voeg op een andere datum ook een ${poseLabel(pose).toLowerCase()}foto toe om te vergelijken.</p>`;
    } else if (ui.photoMode === 'side') {
      cmp = `<div class="photo-pair">
        <figure><img src="${photoUrl(a)}" alt="${alt(A)}"><figcaption>${fmtShort(A)}</figcaption></figure>
        <figure><img src="${photoUrl(b)}" alt="${alt(B)}"><figcaption>${fmtShort(B)}</figcaption></figure>
      </div>`;
    } else {
      cmp = `<div class="photo-slider" role="slider" tabindex="0" aria-label="Schuif tussen ${fmtShort(A)} en ${fmtShort(B)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" style="--pos:50%">
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
          <div class="segmented" role="group" aria-label="Houding">
            ${POSES.map((p) => `<button type="button" data-pose="${p.key}" aria-pressed="${p.key === pose}" ${photoDates(p.key).length ? '' : 'disabled'}>${p.label}</button>`).join('')}
          </div>
          ${dates.length > 1 ? `<div class="segmented" role="group" aria-label="Weergave">
            <button type="button" data-photo-mode="slider" aria-pressed="${ui.photoMode !== 'side'}">Schuif</button>
            <button type="button" data-photo-mode="side" aria-pressed="${ui.photoMode === 'side'}">Naast elkaar</button>
          </div>` : ''}
        </div>
        ${dates.length > 1 ? `<div class="compare-pick" style="margin-bottom:14px">
          <label class="field"><span class="field__label">Van</span><select class="select" id="photoA">${opts(A)}</select></label>
          <span class="compare-pick__arrow" aria-hidden="true">→</span>
          <label class="field"><span class="field__label">Tot</span><select class="select" id="photoB">${opts(B)}</select></label>
        </div>` : ''}
        ${cmp}
      </div>
      <h2 class="section-title">Alle foto's · ${photos.length}</h2>
      ${days.map((d) => `<div class="card photo-day">
        <div class="photo-day__head"><span>${fmtDate(d)}</span><button type="button" class="inline-link" data-add-photos="${d}">Aanpassen</button></div>
        <div class="photo-day__grid">${POSES.map((p) => {
          const ph = photoOf(d, p.key);
          return ph
            ? `<button type="button" class="thumb" data-photo="${ph.id}"><img src="${photoUrl(ph)}" alt="${p.label}foto van ${fmtDate(d)}" loading="lazy"><span>${p.label}</span></button>`
            : `<button type="button" class="thumb thumb--empty" data-add-photos="${d}"><span>+ ${p.label}</span></button>`;
        }).join('')}</div>
      </div>`).join('')}
      <p class="hint" style="text-align:center">Foto's staan alleen op dit toestel. Neem ze mee in je back-up via Instellingen.</p>`;
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
        <span class="pose-slot__label">${p.label}${src && !file ? ' · vervang' : ''}</span>
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
    if (!poses.length) { toast('Kies minstens één foto'); return; }
    const btn = photoForm.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Bezig…';
    try {
      for (const pose of poses) {
        const { blob, w, h } = await compressImage(pending[pose]);
        const rec = { id: `${date}_${pose}`, date, pose, blob, w, h, t: Date.now() };
        await PhotoDB.put(rec);
        dropUrl(rec.id);
        photos = photos.filter((p) => p.id !== rec.id).concat(rec);
      }
      ui.photoB = date;
      toast(poses.length > 1 ? "Foto's bewaard" : 'Foto bewaard');
      photoSheet.close();
      render();
    } catch {
      toast('Bewaren mislukt: opslag vol of foto onleesbaar');
    } finally { btn.disabled = false; btn.textContent = 'Bewaar'; }
  });

  // Foto bekijken / verwijderen
  const viewer = $('#photoViewer');
  let viewing = null;
  function openViewer(id) {
    viewing = photos.find((p) => p.id === id);
    if (!viewing) return;
    $('#viewerImg').src = photoUrl(viewing);
    $('#viewerImg').alt = `${poseLabel(viewing.pose)}foto van ${fmtDate(viewing.date)}`;
    $('#viewerCap').textContent = `${poseLabel(viewing.pose)} · ${fmtDate(viewing.date)}`;
    viewer.showModal();
  }
  $('#viewerDelete').addEventListener('click', async () => {
    if (!viewing || !confirm(`${poseLabel(viewing.pose)}foto van ${fmtDate(viewing.date)} verwijderen? Dit kan niet ongedaan worden.`)) return;
    try {
      await PhotoDB.del(viewing.id);
      photos = photos.filter((p) => p !== viewing);
      dropUrl(viewing.id);
      viewer.close();
      toast('Foto verwijderd');
      render();
    } catch { toast('Verwijderen mislukt'); }
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
      viewEl(ui.view).innerHTML = `<div class="card empty"><span class="soon">Binnenkort</span><h2>${title}</h2><p>${text}</p></div>`;
    };
  }
  const renderFood = renderSoon('Calorieën bijhouden', 'Hier komt je voeding: wat je eet, je calorieën en eiwitten per dag.');
  const renderGym = renderSoon('Trainingen', 'Hier komen je trainingen: oefeningen, sets, gewichten en je records.');

  const RENDER = { overview: renderOverview, log: renderLog, compare: renderCompare, photos: renderPhotos, food: renderFood, gym: renderGym, settings: renderSettings };

  function render() {
    if (!RENDER[ui.view]) ui.view = 'overview';
    for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== ui.view;
    document.body.classList.toggle('has-subnav', BODY_VIEWS.includes(ui.view));
    for (const t of document.querySelectorAll('.tab, .subtab')) {
      const on = t.dataset.tab ? t.dataset.tab === ui.view : t.id === 'bodyTab' && BODY_VIEWS.includes(ui.view);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    }
    $('#viewTitle').textContent = TITLES[ui.view];
    document.title = ui.view === 'overview' ? 'Gainly' : `${TITLES[ui.view]} · Gainly`;
    const fab = $('#fab');
    fab.hidden = !['overview', 'log', 'photos'].includes(ui.view);
    fab.setAttribute('aria-label', ui.view === 'photos' ? "Foto's toevoegen" : 'Nieuwe meting');
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
    $('#measureFields').innerHTML = Object.entries(groups).map(([g, list], gi) => `
      <fieldset class="fieldset"><legend>${g}</legend>
        ${g === 'Omtrek' ? '<p class="measure-tip">Meet altijd op hetzelfde moment (bv. \'s ochtends voor het ontbijt), op de blote huid, met het lint strak maar zonder in te snijden. Tik op <b>i</b> voor uitleg per maat.</p>' : ''}
        <div class="field-grid${gi === 0 ? ' field-grid--one' : ''}">
        ${list.map((m) => `<div class="field">
          <div class="field__row">
            <label class="field__label" for="m_${m.key}">${m.label} <small>${m.unit}</small></label>
            <button type="button" class="info" data-tip="${m.key}" aria-expanded="false" aria-controls="tip_${m.key}" aria-label="Hoe meet ik ${m.label.toLowerCase()}?">i</button>
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
    $('#measureTitle').textContent = quick ? 'Snel wegen' : entry ? 'Meting bewerken' : 'Nieuwe meting';
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
    syncMilestones(true);
  });

  $('#measureDelete').addEventListener('click', () => {
    if (!editingEntry || !confirm(`Meting van ${fmtDate(editingEntry.date)} verwijderen?`)) return;
    state.entries = state.entries.filter((e) => e !== editingEntry);
    save({ allowEmpty: true });
    measureSheet.close();
    toast('Meting verwijderd');
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
      toast("Foto's inpakken…");
      payload.photos = await Promise.all(photos.map(async (p) => ({ id: p.id, date: p.date, pose: p.pose, w: p.w, h: p.h, t: p.t, data: await blobToB64(p.blob) })));
    }
    const json = JSON.stringify(payload, null, withPhotos ? 0 : 2);
    const name = `gainly-backup-${todayISO()}${withPhotos ? '-met-fotos' : ''}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Gainly back-up' }); markExported(); return; }
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
      if (!confirm(`Back-up met ${plural(next.entries.length, 'meting', 'metingen')}${pics.length ? ` en ${pics.length} foto's` : ''} importeren? Dit vervangt je huidige metingen${pics.length ? "; foto's worden toegevoegd" : ''}.`)) return;
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
      toast(failed ? `Geïmporteerd, maar ${failed} foto's mislukt` : 'Back-up geïmporteerd');
      render();
    } catch {
      toast('Dit is geen geldig Gainly-back-upbestand');
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
    if (t.id === 'bodyTab') return go(BODY_VIEWS.includes(ui.view) ? ui.view : 'overview');
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.tabGo) return go(t.dataset.tabGo);
    if (t.dataset.goalType) {
      if ((state.settings.goalType || 'cut') === t.dataset.goalType) return;
      // Nieuwe fase: start vandaag (aan te passen onder Profiel).
      state.settings = { ...state.settings, goalType: t.dataset.goalType, goalStart: todayISO() };
      save(); syncMilestones(false);
      toast(`${t.dataset.goalType === 'bulk' ? 'Bulk' : 'Cut'} gestart vandaag. Pas de datum aan als dat niet klopt.`);
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
      if (!x || !confirm(`Gegevens van ${fmtDate(x.day)} terugzetten (${plural(x.count, 'meting', 'metingen')})? Je huidige stand wordt eerst zelf een herstelpunt.`)) return;
      snapshot('restore');
      state = normalize(x.data); save({ allowEmpty: true }); applyTheme(); syncMilestones(false); toast('Teruggezet'); return go('overview');
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
        if (state.entries.length && !confirm('Demodata vervangt je huidige metingen. Doorgaan?')) return;
        snapshot('restore'); state = demoData(); save(); syncMilestones(false); toast('Demodata geladen'); return go('overview');
      case 'wipe': {
        if (!confirm(`Alle metingen${photos.length ? " en foto's" : ''} definitief wissen? Maak eerst een back-up als je twijfelt.`)) return;
        snapshot('restore'); state = { entries: [], settings: state.settings }; save({ allowEmpty: true });
        PhotoDB.clear().catch(() => {});
        photos.forEach((p) => dropUrl(p.id)); photos = [];
        toast('Alles gewist'); return render();
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
    if (hBad || gBad) { toast('Controleer je lengte en streefgewicht'); return; }
    const goalStart = f.goalStart.value || null;
    state.settings = { ...state.settings, height, goalWeight, goalStart };
    save();
    syncMilestones(false);
    toast('Profiel bewaard');
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
