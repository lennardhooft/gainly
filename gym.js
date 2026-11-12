/* Gainly — Gym: trainingen loggen, schema's, historiek, oefeningen en records.
   Alles zit in state.gym (dus ook in back-ups en herstelpunten):
   { workouts: [...], routines: [...], custom: [...], active: {...} }
   Een set: { w: kg, r: herhalingen, s: seconden, t: 'w'|'d'|'f' (opwarm/drop/falen), d: afgevinkt (alleen tijdens de training) } */
window.GainlyGym = function (core) {
  'use strict';
  const { $, esc, fmt, fmtDate, fmtShort, toISO, todayISO, addDays, parseNum, uid, plural, chev, lineChart, emptyState, viewEl, toast, ui, DF_WEEKDAY } = core;

  const G = () => {
    const s = core.state;
    if (!s.gym || typeof s.gym !== 'object') s.gym = {};
    const g = s.gym;
    if (!Array.isArray(g.workouts)) g.workouts = [];
    if (!Array.isArray(g.routines)) g.routines = [];
    if (!Array.isArray(g.custom)) g.custom = [];
    return g;
  };

  /* ---------------- Oefeningen ---------------- */
  const GROUPS = ['Borst', 'Rug', 'Schouders', 'Armen', 'Benen', 'Buik', 'Cardio', 'Overig'];
  const TYPES = { kg: 'Gewicht × herhalingen', bw: 'Lichaamsgewicht (+ extra kg)', time: 'Tijd' };
  const L = (id, name, en, group, type = 'kg') => ({ id, name, en, group, type });
  const LIB = [
    L('bench-bb', 'Bankdrukken (stang)', 'Bench Press (Barbell)', 'Borst'),
    L('bench-db', 'Bankdrukken (dumbbell)', 'Bench Press (Dumbbell)', 'Borst'),
    L('incline-bb', 'Schuin bankdrukken (stang)', 'Incline Bench Press (Barbell)', 'Borst'),
    L('incline-db', 'Schuin bankdrukken (dumbbell)', 'Incline Bench Press (Dumbbell)', 'Borst'),
    L('decline-bb', 'Negatief bankdrukken (stang)', 'Decline Bench Press (Barbell)', 'Borst'),
    L('chest-press', 'Chest press (machine)', 'Chest Press (Machine)', 'Borst'),
    L('fly-db', 'Flyes (dumbbell)', 'Chest Fly (Dumbbell)', 'Borst'),
    L('pec-deck', 'Pec deck (machine)', 'Butterfly (Pec Deck)', 'Borst'),
    L('cable-fly', 'Cable fly', 'Cable Fly Crossovers', 'Borst'),
    L('pushup', 'Push-up', 'Push Up', 'Borst', 'bw'),
    L('dips', 'Dips', 'Chest Dip', 'Borst', 'bw'),
    L('deadlift', 'Deadlift (stang)', 'Deadlift (Barbell)', 'Rug'),
    L('pullup', 'Pull-up', 'Pull Up', 'Rug', 'bw'),
    L('chinup', 'Chin-up', 'Chin Up', 'Rug', 'bw'),
    L('latpull', 'Lat pulldown (kabel)', 'Lat Pulldown (Cable)', 'Rug'),
    L('row-bb', 'Roeien (stang)', 'Bent Over Row (Barbell)', 'Rug'),
    L('row-db', 'Roeien (dumbbell)', 'Dumbbell Row', 'Rug'),
    L('cable-row', 'Seated row (kabel)', 'Seated Cable Row - V Grip (Cable)', 'Rug'),
    L('row-m', 'Roeien (machine)', 'Seated Row (Machine)', 'Rug'),
    L('tbar', 'T-bar row', 'T Bar Row', 'Rug'),
    L('pullover', 'Pullover (dumbbell)', 'Pullover (Dumbbell)', 'Rug'),
    L('backext', 'Rugstrekken', 'Back Extension (Hyperextension)', 'Rug', 'bw'),
    L('shrug', 'Shrugs (dumbbell)', 'Shrug (Dumbbell)', 'Rug'),
    L('facepull', 'Face pull', 'Face Pull', 'Schouders'),
    L('ohp-bb', 'Overhead press (stang)', 'Overhead Press (Barbell)', 'Schouders'),
    L('ohp-db', 'Shoulder press (dumbbell)', 'Shoulder Press (Dumbbell)', 'Schouders'),
    L('ohp-m', 'Shoulder press (machine)', 'Seated Shoulder Press (Machine)', 'Schouders'),
    L('arnold', 'Arnold press', 'Arnold Press (Dumbbell)', 'Schouders'),
    L('lateral-db', 'Lateral raise (dumbbell)', 'Lateral Raise (Dumbbell)', 'Schouders'),
    L('lateral-c', 'Lateral raise (kabel)', 'Lateral Raise (Cable)', 'Schouders'),
    L('front-db', 'Front raise (dumbbell)', 'Front Raise (Dumbbell)', 'Schouders'),
    L('reardelt-db', 'Rear delt fly (dumbbell)', 'Rear Delt Reverse Fly (Dumbbell)', 'Schouders'),
    L('reardelt-m', 'Rear delt fly (machine)', 'Rear Delt Reverse Fly (Machine)', 'Schouders'),
    L('uprow', 'Upright row', 'Upright Row (Barbell)', 'Schouders'),
    L('curl-bb', 'Biceps curl (stang)', 'Bicep Curl (Barbell)', 'Armen'),
    L('curl-db', 'Biceps curl (dumbbell)', 'Bicep Curl (Dumbbell)', 'Armen'),
    L('curl-c', 'Biceps curl (kabel)', 'Bicep Curl (Cable)', 'Armen'),
    L('ezcurl', 'EZ-bar curl', 'EZ Bar Biceps Curl', 'Armen'),
    L('hammer', 'Hammer curl', 'Hammer Curl (Dumbbell)', 'Armen'),
    L('preacher', 'Preacher curl', 'Preacher Curl (Barbell)', 'Armen'),
    L('pushdown', 'Triceps pushdown', 'Triceps Pushdown', 'Armen'),
    L('rope-pushdown', 'Triceps pushdown (touw)', 'Triceps Rope Pushdown', 'Armen'),
    L('skull', 'Skullcrusher', 'Skullcrusher (Barbell)', 'Armen'),
    L('oh-ext', 'Triceps extension boven het hoofd', 'Overhead Triceps Extension (Cable)', 'Armen'),
    L('cgbench', 'Close-grip bankdrukken', 'Bench Press - Close Grip (Barbell)', 'Armen'),
    L('tri-dips', 'Triceps dips', 'Triceps Dip', 'Armen', 'bw'),
    L('wristcurl', 'Wrist curl', 'Wrist Curl (Barbell)', 'Armen'),
    L('squat-bb', 'Squat (stang)', 'Squat (Barbell)', 'Benen'),
    L('front-squat', 'Front squat', 'Front Squat', 'Benen'),
    L('goblet', 'Goblet squat', 'Goblet Squat', 'Benen'),
    L('hack', 'Hack squat', 'Hack Squat (Machine)', 'Benen'),
    L('legpress', 'Leg press', 'Leg Press (Machine)', 'Benen'),
    L('lunge', 'Lunges (dumbbell)', 'Lunge (Dumbbell)', 'Benen'),
    L('bulgarian', 'Bulgarian split squat', 'Bulgarian Split Squat', 'Benen'),
    L('legext', 'Leg extension', 'Leg Extension (Machine)', 'Benen'),
    L('legcurl-l', 'Leg curl (liggend)', 'Lying Leg Curl (Machine)', 'Benen'),
    L('legcurl-s', 'Leg curl (zittend)', 'Seated Leg Curl (Machine)', 'Benen'),
    L('rdl-bb', 'Roemeense deadlift (stang)', 'Romanian Deadlift (Barbell)', 'Benen'),
    L('rdl-db', 'Roemeense deadlift (dumbbell)', 'Romanian Deadlift (Dumbbell)', 'Benen'),
    L('hipthrust', 'Hip thrust (stang)', 'Hip Thrust (Barbell)', 'Benen'),
    L('kickback', 'Glute kickback (kabel)', 'Glute Kickback (Cable)', 'Benen'),
    L('abductor', 'Abductor (machine)', 'Hip Abduction (Machine)', 'Benen'),
    L('adductor', 'Adductor (machine)', 'Hip Adduction (Machine)', 'Benen'),
    L('calf-stand', 'Calf raise (staand)', 'Standing Calf Raise (Machine)', 'Benen'),
    L('calf-seat', 'Calf raise (zittend)', 'Seated Calf Raise', 'Benen'),
    L('stepup', 'Step-up', 'Step Up', 'Benen'),
    L('crunch', 'Crunch', 'Crunch', 'Buik', 'bw'),
    L('cablecrunch', 'Cable crunch', 'Cable Crunch', 'Buik'),
    L('legraise', 'Leg raise (hangend)', 'Hanging Leg Raise', 'Buik', 'bw'),
    L('russian', 'Russian twist', 'Russian Twist', 'Buik', 'bw'),
    L('abwheel', 'Ab wheel', 'Ab Wheel', 'Buik', 'bw'),
    L('plank', 'Plank', 'Plank', 'Buik', 'time'),
    L('treadmill', 'Loopband', 'Treadmill', 'Cardio', 'time'),
    L('bike', 'Fiets', 'Cycling', 'Cardio', 'time'),
    L('rower', 'Roeitoestel', 'Rowing Machine', 'Cardio', 'time'),
    L('stair', 'Trappenmachine', 'Stair Machine', 'Cardio', 'time'),
    L('elliptical', 'Crosstrainer', 'Elliptical Trainer', 'Cardio', 'time'),
  ];
  const exAll = () => [...LIB, ...G().custom];
  const exById = (id) => exAll().find((e) => e.id === id) || { id, name: 'Onbekende oefening', group: 'Overig', type: 'kg' };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

  /* ---------------- Rekenwerk ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };
  const fmtDur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} u ${pad(m % 60)}` : `${m} min`; };
  const fmtKg = (w) => (w == null ? '' : fmt(w, Math.round(w * 100) % 10 ? 2 : Math.round(w * 10) % 10 ? 1 : 0));
  const fmtVol = (v) => fmt(Math.round(v), 0);
  const isWork = (st) => st.t !== 'w';
  const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 15) / 30) : 0); // Epley
  const setVol = (st) => (isWork(st) && st.w > 0 && st.r > 0 ? st.w * st.r : 0);
  const itemsVol = (items, onlyDone) => items.reduce((a, it) => a + it.sets.reduce((b, st) => b + (!onlyDone || st.d ? setVol(st) : 0), 0), 0);
  const itemsSets = (items, onlyDone) => items.reduce((a, it) => a + it.sets.filter((st) => isWork(st) && (!onlyDone || st.d)).length, 0);
  const history = () => [...G().workouts].sort((a, b) => b.start - a.start);
  const dayOf = (ms) => toISO(new Date(ms));

  function setText(ex, st, short = false) {
    if (!st) return '—';
    if (ex.type === 'time') return st.s ? clock(st.s) : '—';
    if (ex.type === 'bw') return st.r ? (st.w ? `+${fmtKg(st.w)}${short ? '' : ' kg'} × ${st.r}` : `${st.r} herh.`) : '—';
    return st.r != null && st.w != null ? `${fmtKg(st.w)}${short ? '' : ' kg'} × ${st.r}` : '—';
  }
  // Sets van de vorige keer dat je deze oefening deed
  function prevSets(exId, before = Infinity) {
    for (const w of history()) {
      if (w.start >= before) continue;
      const it = w.items.find((x) => x.exId === exId);
      if (it) return it.sets;
    }
    return [];
  }
  function bestOf(sets) {
    let kg = 0, e = 0;
    for (const st of sets) if (isWork(st) && st.w > 0 && st.r > 0) { kg = Math.max(kg, st.w); e = Math.max(e, e1rm(st.w, st.r)); }
    return { kg, e };
  }
  function computePRs(wk) {
    const prs = [];
    for (const it of wk.items) {
      if (exById(it.exId).type !== 'kg') continue;
      const now = bestOf(it.sets);
      if (!now.kg) continue;
      let pk = 0, pe = 0, had = false;
      for (const w of G().workouts) {
        if (w.id === wk.id || w.start >= wk.start) continue;
        for (const x of w.items) if (x.exId === it.exId) { had = true; const b = bestOf(x.sets); pk = Math.max(pk, b.kg); pe = Math.max(pe, b.e); }
      }
      if (!had) continue;
      if (now.kg > pk + 1e-9) prs.push({ exId: it.exId, kind: 'kg', value: now.kg });
      else if (now.e > pe + 1e-9) prs.push({ exId: it.exId, kind: 'e1rm', value: Math.round(now.e * 10) / 10 });
    }
    return prs;
  }
  const prLabel = (p) => (p.kind === 'kg' ? `Zwaarste gewicht: ${fmtKg(p.value)} kg` : `Beste geschatte 1RM: ${fmtKg(p.value)} kg`);

  /* ---------------- Opslaan ---------------- */
  let saveTimer;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => core.save(), 400); };
  const saveNow = () => { clearTimeout(saveTimer); core.save(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G().active) saveNow(); });
  window.addEventListener('pagehide', () => { if (G().active) saveNow(); });

  /* ---------------- Training starten / afronden ---------------- */
  const blankSets = (n, types) => (types ? types.map((t) => (t ? { t } : {})) : Array.from({ length: Math.max(1, n || 3) }, () => ({})));

  function startWorkout({ name = 'Training', items = [], routineId = null } = {}) {
    const g = G();
    if (g.active && !confirm('Er loopt al een training. Die stoppen (niet bewaren) en een nieuwe starten?')) return;
    g.active = {
      id: uid(), name, start: Date.now(), routineId, note: '',
      items: items.map((it) => ({ exId: it.exId, rest: it.rest ?? 90, sets: blankSets(it.n, it.types) })),
    };
    saveNow();
    ensureAudio();
    core.go('gym');
  }

  function finishWorkout() {
    const g = G();
    const a = g.active;
    if (!a) return;
    const done = itemsSets(a.items, true) + a.items.reduce((n, it) => n + it.sets.filter((st) => st.d && !isWork(st)).length, 0);
    if (!done) {
      if (confirm('Je hebt nog geen sets afgevinkt. Deze training verwijderen?')) { g.active = null; saveNow(); core.render(); }
      return;
    }
    const open = a.items.reduce((n, it) => n + it.sets.filter((st) => !st.d).length, 0);
    if (open && !confirm(`${plural(open, 'set is', 'sets zijn')} niet afgevinkt en ${open === 1 ? 'wordt' : 'worden'} niet bewaard. Training afronden?`)) return;
    const wk = {
      id: a.id, name: (a.name || 'Training').trim() || 'Training', start: a.start, end: Date.now(), routineId: a.routineId || null, note: a.note || '',
      items: a.items.map((it) => ({ exId: it.exId, sets: it.sets.filter((st) => st.d).map(({ d, ...st }) => st) })).filter((it) => it.sets.length),
    };
    wk.prs = computePRs(wk);
    g.workouts.push(wk);
    g.active = null;
    saveNow();
    core.render();
    openWorkout(wk.id, true);
  }

  /* ---------------- Rusttimer ---------------- */
  let audio = null;
  function ensureAudio() {
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { /* geen geluid */ }
  }
  function beep() {
    if (!audio) return;
    try {
      [0, 0.22, 0.44].forEach((t, i) => {
        const o = audio.createOscillator(), gn = audio.createGain();
        o.frequency.value = i === 2 ? 1175 : 880;
        gn.gain.setValueAtTime(0.0001, audio.currentTime + t);
        gn.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + t + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.18);
        o.connect(gn).connect(audio.destination);
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.2);
      });
    } catch { /* ok */ }
  }
  function startRest(sec) {
    const a = G().active;
    if (!a || !sec) return;
    a.restEnd = Date.now() + sec * 1000;
    a.restTotal = sec;
    saveSoon();
    tick();
  }
  function stopRest() { const a = G().active; if (a) { a.restEnd = null; saveSoon(); } tick(); }

  /* ---------------- Klok (duur, rusttimer, "training bezig") ---------------- */
  const restBar = $('#restBar');
  const pill = $('#workoutPill');
  function tick() {
    const a = G().active;
    pill.hidden = !a || ui.view === 'gym';
    if (a) pill.querySelector('span').textContent = clock((Date.now() - a.start) / 1000);
    const c = $('#wkClock');
    if (c && a) c.textContent = clock((Date.now() - a.start) / 1000);
    if (a && a.restEnd) {
      const left = (a.restEnd - Date.now()) / 1000;
      if (left <= 0) {
        a.restEnd = null; saveSoon();
        restBar.hidden = true;
        beep(); navigator.vibrate?.([200, 100, 200]);
        toast('Rust voorbij: volgende set!');
      } else {
        restBar.hidden = false;
        restBar.querySelector('.rest__time').textContent = clock(left);
        restBar.style.setProperty('--p', String(1 - left / (a.restTotal || 90)));
      }
    } else restBar.hidden = true;
    document.body.classList.toggle('has-rest', !restBar.hidden);
  }
  setInterval(tick, 250);

  /* ---------------- Weergave: Training ---------------- */
  const TYPE_LABEL = { w: 'W', d: 'D', f: 'F' };
  const REST_OPTS = [0, 30, 60, 90, 120, 150, 180, 240, 300];
  const restText = (s) => (!s ? 'Uit' : s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`);
  const openMenus = new Set();

  function sourceFor(it, j, prev) { return prev[j] || (j > 0 ? it.sets[j - 1] : null); }
  const minutes = (s) => (s == null ? '' : fmt(s / 60, s % 60 ? 1 : 0));

  function exCardHTML(it, i) {
    const ex = exById(it.exId);
    const prev = prevSets(it.exId);
    let n = 0;
    const head = ex.type === 'time'
      ? '<span>Set</span><span>Vorige</span><span class="set-head--wide">Minuten</span><span></span>'
      : `<span>Set</span><span>Vorige</span><span>${ex.type === 'bw' ? '+kg' : 'kg'}</span><span>Herh.</span><span></span>`;
    const rows = it.sets.map((st, j) => {
      const label = TYPE_LABEL[st.t] || String(++n);
      const p = prev[j];
      const src = sourceFor(it, j, prev);
      const inputs = ex.type === 'time'
        ? `<input class="set-in set-in--wide" data-gin="s" inputmode="decimal" enterkeyhint="done" placeholder="${src && src.s ? minutes(src.s) : 'min'}" value="${minutes(st.s)}" aria-label="Minuten, set ${j + 1}">`
        : `<input class="set-in" data-gin="w" inputmode="decimal" enterkeyhint="next" placeholder="${src && src.w != null ? fmtKg(src.w) : ex.type === 'bw' ? '0' : 'kg'}" value="${fmtKg(st.w)}" aria-label="Kilo, set ${j + 1}">
           <input class="set-in" data-gin="r" inputmode="numeric" enterkeyhint="done" placeholder="${src && src.r != null ? src.r : 'herh'}" value="${st.r ?? ''}" aria-label="Herhalingen, set ${j + 1}">`;
      return `<div class="set-row${st.d ? ' is-done' : ''}${ex.type === 'time' ? ' set-row--time' : ''}" data-i="${i}" data-j="${j}">
        <label class="set-type set-type--${st.t || 'n'}"><span>${label}</span>
          <select data-gin="t" aria-label="Soort set ${j + 1}">
            <option value="" ${!st.t ? 'selected' : ''}>Gewone set</option>
            <option value="w" ${st.t === 'w' ? 'selected' : ''}>Opwarmset (W)</option>
            <option value="d" ${st.t === 'd' ? 'selected' : ''}>Dropset (D)</option>
            <option value="f" ${st.t === 'f' ? 'selected' : ''}>Tot falen (F)</option>
            <option value="x">Set verwijderen</option>
          </select></label>
        <button type="button" class="set-prev" data-g="use-prev" ${p ? '' : 'disabled'} aria-label="Vorige keer: ${esc(setText(ex, p))}">${esc(setText(ex, p, true))}</button>
        ${inputs}
        <button type="button" class="set-check" data-g="done" aria-pressed="${!!st.d}" aria-label="Set ${j + 1} klaar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>
      </div>`;
    }).join('');
    const menu = openMenus.has(i) ? `<div class="ex-menu">
        <label class="ex-menu__rest">Rusttimer <select data-gin="rest">${REST_OPTS.map((s) => `<option value="${s}" ${s === (it.rest ?? 90) ? 'selected' : ''}>${restText(s)}</option>`).join('')}</select></label>
        <div class="ex-menu__row">
          <button type="button" class="button" data-g="ex-up" ${i ? '' : 'disabled'}>↑ Hoger</button>
          <button type="button" class="button" data-g="ex-down">↓ Lager</button>
          <button type="button" class="button button--danger" data-g="ex-del">Verwijder</button>
        </div>
      </div>` : '';
    return `<div class="card ex-card" data-i="${i}">
      <div class="ex-card__head">
        <button type="button" class="ex-card__name" data-g="ex-info" data-ex="${esc(ex.id)}">${esc(ex.name)}</button>
        <span class="ex-card__rest">${it.rest ? `⏱ ${restText(it.rest)}` : ''}</span>
        <button type="button" class="ex-card__more" data-g="ex-menu" aria-expanded="${openMenus.has(i)}" aria-label="Opties voor ${esc(ex.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>
      </div>
      ${menu}
      <div class="set-row set-row--head${ex.type === 'time' ? ' set-row--time' : ''}" aria-hidden="true">${head}</div>
      ${rows}
      <button type="button" class="ex-card__add" data-g="add-set">+ Set toevoegen</button>
    </div>`;
  }

  function renderActive(el) {
    const a = G().active;
    el.innerHTML = `
      <div class="card wk-head">
        <input class="wk-title" data-gin="name" value="${esc(a.name)}" aria-label="Naam van de training" autocomplete="off">
        <div class="wk-stats">
          <div><span>Duur</span><strong id="wkClock">${clock((Date.now() - a.start) / 1000)}</strong></div>
          <div><span>Volume</span><strong id="wkVol">${fmtVol(itemsVol(a.items, true))} kg</strong></div>
          <div><span>Sets</span><strong id="wkSets">${itemsSets(a.items, true)}</strong></div>
        </div>
      </div>
      ${a.items.map(exCardHTML).join('')}
      ${a.items.length ? '' : '<p class="hint" style="text-align:center;margin:8px 0">Voeg je eerste oefening toe.</p>'}
      <button type="button" class="button button--primary" data-g="add-ex">+ Oefening toevoegen</button>
      <label class="field" style="margin:4px 0 0"><span class="field__label">Notitie</span><textarea data-gin="note" rows="2" placeholder="Hoe ging het?">${esc(a.note)}</textarea></label>
      <div class="button-row">
        <button type="button" class="button button--danger" data-g="cancel">Annuleer</button>
        <button type="button" class="button" data-g="finish">Afronden</button>
      </div>`;
  }
  function updateHead() {
    const a = G().active;
    if (!a) return;
    const v = $('#wkVol'), s = $('#wkSets');
    if (v) v.textContent = `${fmtVol(itemsVol(a.items, true))} kg`;
    if (s) s.textContent = itemsSets(a.items, true);
  }

  function lastDone(routineId) { return history().find((w) => w.routineId === routineId); }
  function weekStart(iso) { const d = new Date(iso + 'T12:00:00'); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toISO(d); }

  function renderStart(el) {
    const g = G();
    const h = history();
    const wk0 = weekStart(todayISO());
    const thisWeek = h.filter((w) => dayOf(w.start) >= wk0).length;
    const last = h[0];
    el.innerHTML = `
      <div class="card">
        <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
          <div class="stat"><span class="stat__label">Deze week</span><span class="stat__value">${plural(thisWeek, 'training', 'trainingen')}</span></div>
          <div class="stat"><span class="stat__label">Laatste</span><span class="stat__value">${last ? fmtShort(dayOf(last.start)) : '—'}</span></div>
        </div>
        <button type="button" class="button button--primary" data-g="start-empty">Lege training starten</button>
      </div>
      <div class="section-row"><h2 class="section-title">Schema's · ${g.routines.length}</h2><button type="button" class="inline-link" data-g="new-routine">+ Nieuw schema</button></div>
      ${g.routines.length ? g.routines.map((r) => {
        const ld = lastDone(r.id);
        const names = r.items.map((it) => exById(it.exId).name);
        return `<div class="card routine">
          <div class="routine__main">
            <h3 class="routine__name">${esc(r.name)}</h3>
            <p class="routine__sub">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</p>
            <p class="routine__meta">${plural(r.items.length, 'oefening', 'oefeningen')}${ld ? ` · laatst ${fmtShort(dayOf(ld.start))}` : ''}</p>
          </div>
          <div class="routine__actions">
            <button type="button" class="button button--primary" data-g="start-routine" data-id="${r.id}">Start</button>
            <button type="button" class="inline-link" data-g="edit-routine" data-id="${r.id}">Bewerk</button>
          </div>
        </div>`;
      }).join('') : '<div class="card"><p class="prose">Maak een schema voor je vaste trainingen, bijvoorbeeld Push, Pull en Legs. Dan start je ze met één tik, met je vorige gewichten erbij.</p></div>'}
      <div class="card">
        <h2 class="card__title" style="margin-bottom:6px">Kom je van Hevy?</h2>
        <p class="prose" style="margin-bottom:12px">Exporteer je trainingen in Hevy als CSV-bestand (bij de instellingen, onder exporteren) en importeer dat hier. Dubbele trainingen worden overgeslagen.</p>
        <button type="button" class="button" data-g="hevy">Importeer Hevy-CSV</button>
        <input type="file" id="hevyFile" accept=".csv,text/csv" hidden>
      </div>`;
  }

  function renderGym() {
    const el = viewEl('gym');
    if (G().active) renderActive(el); else renderStart(el);
  }

  /* ---------------- Weergave: Historiek ---------------- */
  function renderHistory() {
    const el = viewEl('gymHistory');
    const h = history();
    if (!h.length) {
      el.innerHTML = `<div class="card empty"><h2>Nog geen trainingen</h2><p>Afgeronde trainingen verschijnen hier, met je volume en records.</p><button class="button button--primary" data-tab-go="gym">Training starten</button></div>`;
      return;
    }
    const today = todayISO();
    const wk0 = weekStart(today);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(wk0, -7 * (7 - i)));
    const counts = weeks.map((w, i) => h.filter((x) => { const d = dayOf(x.start); return d >= w && (i === 7 || d < weeks[i + 1]); }).length);
    const max = Math.max(1, ...counts);
    const month = today.slice(0, 7);
    const byMonth = {};
    for (const w of h) (byMonth[dayOf(w.start).slice(0, 7)] ||= []).push(w);
    const MF = new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric' });
    el.innerHTML = `
      <div class="card">
        <div class="stats">
          <div class="stat"><span class="stat__label">Deze week</span><span class="stat__value">${counts[7]}</span></div>
          <div class="stat"><span class="stat__label">Deze maand</span><span class="stat__value">${(byMonth[month] || []).length}</span></div>
          <div class="stat"><span class="stat__label">Totaal</span><span class="stat__value">${h.length}</span></div>
        </div>
        <div class="weekbars" role="img" aria-label="Trainingen per week, laatste 8 weken: ${counts.join(', ')}">
          ${counts.map((c, i) => `<div class="weekbars__col"><span class="weekbars__n">${c || ''}</span><span class="weekbars__bar${i === 7 ? ' is-now' : ''}" style="height:${Math.max(3, (c / max) * 64)}px"></span><span class="weekbars__lbl">${i === 7 ? 'nu' : fmtShort(weeks[i]).replace('.', '')}</span></div>`).join('')}
        </div>
      </div>
      ${Object.entries(byMonth).map(([m, list]) => `
        <h2 class="section-title">${MF.format(new Date(m + '-15T12:00:00'))} · ${list.length}</h2>
        <div class="list">${list.map((w) => `<button class="list__item" data-g="open-workout" data-id="${w.id}">
          <div class="list__main"><div class="list__title">${esc(w.name)}${w.prs && w.prs.length ? ` <span class="pr-chip">🏆 ${w.prs.length}</span>` : ''}</div>
            <div class="list__sub">${esc(DF_WEEKDAY.format(new Date(w.start)))} · ${w.end ? fmtDur(w.end - w.start) : ''} · ${fmtVol(itemsVol(w.items))} kg</div></div>
          <div class="list__end">${itemsSets(w.items)}<small>sets</small></div>${chev}
        </button>`).join('')}</div>`).join('')}`;
  }

  /* ---------------- Weergave: Oefeningen ---------------- */
  const exUi = { q: '', group: '' };
  function exStats(exId) {
    const sessions = [];
    for (const w of [...G().workouts].sort((a, b) => a.start - b.start)) {
      const it = w.items.find((x) => x.exId === exId);
      if (it) sessions.push({ w, sets: it.sets });
    }
    return sessions;
  }
  function filteredExercises(q, group) {
    const nq = norm(q);
    return exAll().filter((e) => (!group || e.group === group) && (!nq || norm(e.name).includes(nq) || norm(e.en).includes(nq)))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }
  function chipsHTML(sel, attr) {
    const groups = GROUPS.filter((g) => g !== 'Overig' || G().custom.some((c) => c.group === 'Overig'));
    return `<div class="chips-scroll" role="group" aria-label="Spiergroep">
      <button type="button" class="chip" data-g="${attr}" data-group="" aria-pressed="${!sel}">Alle</button>
      ${groups.map((g) => `<button type="button" class="chip" data-g="${attr}" data-group="${g}" aria-pressed="${sel === g}">${g}</button>`).join('')}
    </div>`;
  }
  function exListItems() {
    const list = filteredExercises(exUi.q, exUi.group);
    if (!list.length) return '<p class="hint" style="text-align:center;padding:20px 0">Niets gevonden.</p>';
    return `<div class="list">${list.map((e) => {
      const ses = exStats(e.id);
      const last = ses[ses.length - 1];
      const best = last ? [...last.sets].filter(isWork).sort((a, b) => e1rm(b.w, b.r) - e1rm(a.w, a.r) || (b.r || 0) - (a.r || 0) || (b.s || 0) - (a.s || 0))[0] : null;
      return `<button class="list__item" data-g="ex-info" data-ex="${esc(e.id)}">
        <div class="list__main"><div class="list__title">${esc(e.name)}</div><div class="list__sub">${e.group}${last ? ` · ${plural(ses.length, 'keer', 'keer')}` : ''}</div></div>
        <div class="list__end">${best ? esc(setText(e, best)) : ''}<small>${last ? fmtShort(dayOf(last.w.start)) : ''}</small></div>${chev}
      </button>`;
    }).join('')}</div>`;
  }
  function renderExercises() {
    const el = viewEl('gymEx');
    el.innerHTML = `
      <input class="search" type="search" data-gin="ex-q" placeholder="Zoek een oefening" value="${esc(exUi.q)}" aria-label="Zoek een oefening">
      ${chipsHTML(exUi.group, 'ex-group')}
      <div id="exList">${exListItems()}</div>
      <button type="button" class="button" data-g="new-custom">+ Eigen oefening maken</button>`;
  }

  /* ---------------- Dialoog: oefening (statistiek) ---------------- */
  const exSheet = $('#exSheet');
  let exChart = 'e1rm';
  let exOpen = null;
  function openExercise(exId) {
    exOpen = exId;
    renderExerciseSheet();
    if (!exSheet.open) exSheet.showModal();
    drawExChart();
  }
  function renderExerciseSheet() {
    const ex = exById(exOpen);
    const ses = exStats(exOpen);
    $('#exSheetTitle').textContent = ex.name;
    let stats = '';
    if (ses.length && ex.type === 'kg') {
      const all = ses.flatMap((s) => s.sets);
      const b = bestOf(all);
      const bestSetVol = Math.max(0, ...all.map(setVol));
      stats = `<div class="stats" style="margin-bottom:14px">
        <div class="stat"><span class="stat__label">Zwaarste</span><span class="stat__value">${fmtKg(b.kg)} kg</span></div>
        <div class="stat"><span class="stat__label">Geschat 1RM</span><span class="stat__value">${fmtKg(Math.round(b.e * 10) / 10)} kg</span></div>
        <div class="stat"><span class="stat__label">Beste set</span><span class="stat__value">${fmtVol(bestSetVol)} kg</span></div>
      </div>`;
    } else if (ses.length) {
      stats = `<div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
        <div class="stat"><span class="stat__label">Aantal keer</span><span class="stat__value">${ses.length}</span></div>
        <div class="stat"><span class="stat__label">Beste</span><span class="stat__value">${ex.type === 'time' ? clock(Math.max(...ses.flatMap((s) => s.sets.map((st) => st.s || 0)))) : `${Math.max(...ses.flatMap((s) => s.sets.map((st) => st.r || 0)))} herh.`}</span></div>
      </div>`;
    }
    const custom = G().custom.some((c) => c.id === ex.id);
    $('#exSheetBody').innerHTML = `
      <p class="eyebrow" style="margin-bottom:12px">${ex.group} · ${TYPES[ex.type] || ''}</p>
      ${ses.length ? `${stats}
        ${ex.type === 'kg' ? `<div class="segmented segmented--full" role="group" aria-label="Grafiek" style="margin-bottom:10px">
          <button type="button" data-g="ex-chart" data-k="e1rm" aria-pressed="${exChart === 'e1rm'}">Geschat 1RM</button>
          <button type="button" data-g="ex-chart" data-k="kg" aria-pressed="${exChart === 'kg'}">Zwaarste</button>
          <button type="button" data-g="ex-chart" data-k="vol" aria-pressed="${exChart === 'vol'}">Volume</button>
        </div><div class="chart" id="exChart"></div>` : ''}
        <h3 class="section-title" style="margin:16px 0 8px">Geschiedenis</h3>
        ${[...ses].reverse().slice(0, 15).map((s) => `<div class="ex-hist">
          <div class="ex-hist__head"><span>${esc(DF_WEEKDAY.format(new Date(s.w.start)))}</span><span>${esc(s.w.name)}</span></div>
          ${s.sets.map((st, k) => `<div class="ex-hist__set"><span class="ex-hist__n">${TYPE_LABEL[st.t] || k + 1}</span>${esc(setText(ex, st))}${ex.type === 'kg' && isWork(st) && st.r ? `<span class="ex-hist__e">1RM ≈ ${fmtKg(Math.round(e1rm(st.w, st.r)))}</span>` : ''}</div>`).join('')}
        </div>`).join('')}`
        : '<p class="prose">Je hebt deze oefening nog niet gedaan. Zodra je ze in een training afvinkt, zie je hier je records en een grafiek.</p>'}
      ${custom ? `<button type="button" class="button button--danger" data-g="del-custom" style="margin-top:16px">Eigen oefening verwijderen</button>` : ''}`;
  }
  function drawExChart() {
    const el = $('#exChart');
    if (!el) return;
    const label = { e1rm: 'Geschat 1RM', kg: 'Zwaarste gewicht', vol: 'Volume' }[exChart];
    const pts = exStats(exOpen).map((s) => {
      const b = bestOf(s.sets);
      const v = exChart === 'e1rm' ? Math.round(b.e * 10) / 10 : exChart === 'kg' ? b.kg : s.sets.reduce((a, st) => a + setVol(st), 0);
      return { date: dayOf(s.w.start), value: v };
    }).filter((p) => p.value > 0);
    lineChart(el, pts, { unit: 'kg', label, digits: exChart === 'vol' ? 0 : 1, height: 190 });
  }

  /* ---------------- Dialoog: oefening kiezen ---------------- */
  const picker = $('#exPicker');
  const pk = { q: '', group: '', sel: [], onDone: null, form: false };
  function openPicker(onDone) {
    Object.assign(pk, { q: '', group: '', sel: [], onDone, form: false });
    renderPicker();
    picker.showModal();
  }
  function recentIds() {
    const out = [];
    for (const w of history().slice(0, 8)) for (const it of w.items) if (!out.includes(it.exId)) out.push(it.exId);
    return out.slice(0, 8);
  }
  function pickRow(e) {
    const on = pk.sel.includes(e.id);
    return `<button type="button" class="pick${on ? ' is-on' : ''}" data-g="pick" data-ex="${esc(e.id)}" aria-pressed="${on}">
      <span class="pick__main"><span class="pick__name">${esc(e.name)}</span><span class="pick__sub">${e.group}</span></span>
      <span class="pick__n" aria-hidden="true">${on ? pk.sel.indexOf(e.id) + 1 : ''}</span></button>`;
  }
  function renderPickerList() {
    const list = filteredExercises(pk.q, pk.group);
    const recent = !pk.q && !pk.group ? recentIds().map(exById) : [];
    $('#pickList').innerHTML = (recent.length ? `<h3 class="section-title" style="margin:6px 0 8px">Recent</h3><div class="pick-list">${recent.map(pickRow).join('')}</div><h3 class="section-title" style="margin:16px 0 8px">Alle oefeningen</h3>` : '')
      + (list.length ? `<div class="pick-list">${list.map(pickRow).join('')}</div>` : '<p class="hint" style="text-align:center;padding:20px 0">Niets gevonden. Maak hieronder een eigen oefening.</p>');
    $('#pickDone').textContent = pk.sel.length ? `Voeg toe (${pk.sel.length})` : 'Voeg toe';
  }
  function renderPicker() {
    $('#pickBody').innerHTML = pk.form ? customFormHTML() : `
      <input class="search" type="search" data-gin="pick-q" placeholder="Zoek een oefening" value="${esc(pk.q)}" aria-label="Zoek een oefening">
      ${chipsHTML(pk.group, 'pick-group')}
      <div id="pickList"></div>
      <button type="button" class="button" data-g="new-custom" style="margin-top:14px">+ Eigen oefening maken</button>`;
    if (!pk.form) renderPickerList();
    $('#pickDone').hidden = pk.form;
  }
  function customFormHTML() {
    return `<form id="customForm" novalidate>
      <label class="field"><span class="field__label">Naam</span><input name="name" required autocomplete="off" placeholder="Bijv. Incline curl (dumbbell)" value="${esc(pk.q)}"></label>
      <label class="field"><span class="field__label">Spiergroep</span><select class="select" name="group" style="width:100%">${GROUPS.map((g) => `<option ${g === (pk.group || 'Overig') ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="field"><span class="field__label">Soort</span><select class="select" name="type" style="width:100%">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <div class="button-row"><button type="button" class="button" data-g="custom-cancel">Terug</button><button type="submit" class="button button--primary">Maak oefening</button></div>
    </form>`;
  }

  /* ---------------- Dialoog: schema bewerken ---------------- */
  const routineSheet = $('#routineSheet');
  let draft = null;
  function openRoutine(id) {
    const r = id ? G().routines.find((x) => x.id === id) : null;
    draft = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', items: [], isNew: true };
    $('#routineTitle').textContent = r ? 'Schema bewerken' : 'Nieuw schema';
    renderRoutine();
    routineSheet.showModal();
  }
  function renderRoutine() {
    $('#routineBody').innerHTML = `
      <label class="field"><span class="field__label">Naam</span><input data-gin="r-name" value="${esc(draft.name)}" placeholder="Bijv. Push" autocomplete="off"></label>
      ${draft.items.length ? `<div class="list" style="margin-bottom:12px">${draft.items.map((it, i) => {
        const ex = exById(it.exId);
        return `<div class="r-item" data-i="${i}">
          <div class="r-item__main"><div class="list__title">${esc(ex.name)}</div><div class="list__sub">${ex.group} · rust ${restText(it.rest ?? 90)}</div></div>
          <div class="stepper" aria-label="Aantal sets">
            <button type="button" data-g="r-minus" aria-label="Minder sets">−</button><span>${it.n} sets</span><button type="button" data-g="r-plus" aria-label="Meer sets">+</button>
          </div>
          <div class="r-item__tools">
            <button type="button" data-g="r-up" aria-label="Hoger" ${i ? '' : 'disabled'}>↑</button>
            <button type="button" data-g="r-down" aria-label="Lager" ${i < draft.items.length - 1 ? '' : 'disabled'}>↓</button>
            <button type="button" data-g="r-del" aria-label="Verwijder ${esc(ex.name)}">×</button>
          </div>
        </div>`;
      }).join('')}</div>` : '<p class="hint">Nog geen oefeningen in dit schema.</p>'}
      <button type="button" class="button" data-g="r-add">+ Oefening toevoegen</button>
      ${draft.isNew ? '' : '<button type="button" class="button button--danger" data-g="r-delete" style="margin-top:12px">Schema verwijderen</button>'}`;
  }
  function saveRoutine() {
    const name = (draft.name || '').trim();
    if (!name) { toast('Geef je schema een naam'); routineSheet.querySelector('[data-gin="r-name"]')?.focus(); return; }
    if (!draft.items.length) { toast('Voeg minstens één oefening toe'); return; }
    const { isNew, ...r } = { ...draft, name };
    const g = G();
    const i = g.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) g.routines[i] = r; else g.routines.push(r);
    saveNow();
    routineSheet.close();
    toast(isNew ? 'Schema gemaakt' : 'Schema bewaard');
    core.render();
  }

  /* ---------------- Dialoog: training bekijken ---------------- */
  const workoutSheet = $('#workoutSheet');
  let wkOpen = null;
  function openWorkout(id, summary = false) {
    const w = G().workouts.find((x) => x.id === id);
    if (!w) return;
    wkOpen = id;
    $('#workoutTitle').textContent = summary ? 'Training voltooid' : w.name;
    const prs = w.prs || [];
    $('#workoutBody').innerHTML = `
      ${summary ? `<div class="wk-done"><div class="wk-done__icon" aria-hidden="true">💪</div><h2>${esc(w.name)}</h2><p>Goed gedaan! Je training is bewaard.</p></div>` : ''}
      <p class="eyebrow" style="margin-bottom:10px">${esc(DF_WEEKDAY.format(new Date(w.start)))} · ${new Date(w.start).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</p>
      <div class="stats" style="margin-bottom:14px">
        <div class="stat"><span class="stat__label">Duur</span><span class="stat__value">${w.end ? fmtDur(w.end - w.start) : '—'}</span></div>
        <div class="stat"><span class="stat__label">Volume</span><span class="stat__value">${fmtVol(itemsVol(w.items))} kg</span></div>
        <div class="stat"><span class="stat__label">Sets</span><span class="stat__value">${itemsSets(w.items)}</span></div>
      </div>
      ${prs.length ? `<div class="pr-box"><strong>🏆 ${plural(prs.length, 'nieuw record', 'nieuwe records')}</strong>${prs.map((p) => `<span>${esc(exById(p.exId).name)}: ${prLabel(p)}</span>`).join('')}</div>` : ''}
      ${w.items.map((it) => {
        const ex = exById(it.exId);
        const pr = prs.find((p) => p.exId === it.exId);
        let n = 0;
        return `<div class="ex-hist"><div class="ex-hist__head"><button type="button" class="inline-link" data-g="ex-info" data-ex="${esc(ex.id)}">${esc(ex.name)}</button>${pr ? '<span>🏆</span>' : ''}</div>
          ${it.sets.map((st) => `<div class="ex-hist__set"><span class="ex-hist__n">${TYPE_LABEL[st.t] || ++n}</span>${esc(setText(ex, st))}</div>`).join('')}</div>`;
      }).join('')}
      ${w.note ? `<p class="prose" style="margin-top:12px">“${esc(w.note)}”</p>` : ''}
      <div class="button-row" style="margin-top:16px">
        <button type="button" class="button" data-g="redo">Opnieuw doen</button>
        <button type="button" class="button" data-g="to-routine">Bewaar als schema</button>
      </div>
      <button type="button" class="button button--danger" data-g="del-workout" style="margin-top:10px">Training verwijderen</button>`;
    if (!workoutSheet.open) workoutSheet.showModal();
  }

  /* ---------------- Hevy-import ---------------- */
  function parseCSV(text) {
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); f = '';
        if (row.length > 1 || row[0]) rows.push(row);
        row = [];
      } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  const MON = { jan: 0, feb: 1, mar: 2, mrt: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11 };
  function parseHevyDate(s) {
    const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if (m && MON[m[2].toLowerCase()] != null) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1], +m[4], +m[5]).getTime();
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  function guessGroup(title) {
    const t = ' ' + title.toLowerCase() + ' ';
    const rules = [
      ['Buik', /crunch|plank| ab |abs|sit up|twist/],
      ['Cardio', /\bwalk|\brun(ning)?\b|treadmill|bike|cycl|elliptical|stair|cardio/],
      ['Benen', /calf|leg|squat|lunge|hip|glute|thrust|step up|romanian|straight leg|adduct|abduct/],
      ['Armen', /curl|tricep|bicep|skull|wrist|forearm|jm press|kickback|pushdown|hammer/],
      ['Schouders', /shoulder|lateral|front raise|delt|reverse fly|overhead press|arnold|face pull|upright/],
      ['Rug', /row|pull|lat |deadlift|shrug|back|kelso/],
      ['Borst', /bench|chest|fly|pec|push up|dip|crossover/],
    ];
    return (rules.find(([, re]) => re.test(t)) || ['Overig'])[0];
  }
  async function importHevy(file) {
    try {
      const rows = parseCSV(await file.text());
      const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
      const col = (n) => head.indexOf(n);
      const C = { title: col('title'), start: col('start_time'), end: col('end_time'), desc: col('description'), ex: col('exercise_title'), type: col('set_type'), kg: col('weight_kg'), lbs: col('weight_lbs'), reps: col('reps'), dur: col('duration_seconds'), note: col('exercise_notes') };
      if (C.title < 0 || C.start < 0 || C.ex < 0) throw new Error('format');
      const g = G();
      const byName = new Map();
      for (const e of exAll()) { byName.set(norm(e.en), e.id); byName.set(norm(e.name), e.id); }
      const created = [];
      const map = new Map();
      for (const r of rows) {
        const start = parseHevyDate(r[C.start]);
        if (start == null || !r[C.ex]) continue;
        const key = r[C.title] + '|' + start;
        let wk = map.get(key);
        if (!wk) {
          const end = C.end >= 0 ? parseHevyDate(r[C.end]) : null;
          wk = { id: 'hevy-' + start, name: r[C.title] || 'Training', start, end: end && end > start ? end : null, routineId: null, note: C.desc >= 0 ? r[C.desc] || '' : '', items: [], prs: [], src: 'hevy' };
          map.set(key, wk);
        }
        const title = r[C.ex].trim();
        let exId = byName.get(norm(title));
        if (!exId) {
          const c = { id: 'c-' + uid(), name: title, en: title, group: guessGroup(title), type: 'kg' };
          g.custom.push(c); created.push(c);
          exId = c.id; byName.set(norm(title), exId);
        }
        let it = wk.items[wk.items.length - 1];
        if (!it || it.exId !== exId) { it = { exId, sets: [] }; wk.items.push(it); }
        const num = (i) => { if (i < 0) return null; const n = parseFloat(String(r[i]).replace(',', '.')); return Number.isFinite(n) ? n : null; };
        let w = num(C.kg);
        if (w == null && num(C.lbs) != null) w = Math.round(num(C.lbs) * 0.45359237 * 10) / 10;
        const st = {};
        if (w != null) st.w = w;
        if (num(C.reps) != null) st.r = Math.round(num(C.reps));
        if (num(C.dur)) st.s = Math.round(num(C.dur));
        const tp = (C.type >= 0 ? r[C.type] : '').toLowerCase();
        if (tp.startsWith('warm')) st.t = 'w'; else if (tp.startsWith('drop')) st.t = 'd'; else if (tp.startsWith('fail')) st.t = 'f';
        it.sets.push(st);
      }
      // Soort van nieuwe oefeningen afleiden uit de sets
      for (const c of created) {
        const sets = [...map.values()].flatMap((w) => w.items.filter((i) => i.exId === c.id).flatMap((i) => i.sets));
        if (!sets.some((s) => s.w) && sets.some((s) => s.s)) c.type = 'time';
        else if (!sets.some((s) => s.w)) c.type = 'bw';
      }
      const fresh = [...map.values()].filter((w) => !g.workouts.some((x) => Math.abs(x.start - w.start) < 60000));
      if (!fresh.length) { g.custom = g.custom.filter((c) => !created.includes(c)); toast(map.size ? 'Al deze trainingen staan er al in' : 'Geen trainingen gevonden in dit bestand'); return; }
      if (!confirm(`${plural(fresh.length, 'training', 'trainingen')} uit Hevy importeren${created.length ? ` (${plural(created.length, 'nieuwe oefening', 'nieuwe oefeningen')})` : ''}?`)) { g.custom = g.custom.filter((c) => !created.includes(c)); return; }
      core.snapshot('restore');
      g.workouts.push(...fresh.sort((a, b) => a.start - b.start));
      // Records achteraf berekenen, in volgorde
      for (const w of [...g.workouts].sort((a, b) => a.start - b.start)) if (w.src === 'hevy' && fresh.includes(w)) w.prs = computePRs(w);
      saveNow();
      toast(`${plural(fresh.length, 'training', 'trainingen')} geïmporteerd`);
      core.go('gymHistory');
    } catch {
      toast('Dit lijkt geen Hevy-export (CSV) te zijn');
    }
  }

  /* ---------------- Events ---------------- */
  const act = () => G().active;
  const rowOf = (el) => { const r = el.closest('.set-row'); return r ? { i: +r.dataset.i, j: +r.dataset.j } : null; };
  const cardOf = (el) => +el.closest('.ex-card')?.dataset.i;

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-g]');
    if (!b) return;
    const g = G();
    const a = act();
    switch (b.dataset.g) {
      case 'start-empty': return startWorkout();
      case 'start-routine': {
        const r = g.routines.find((x) => x.id === b.dataset.id);
        if (r) startWorkout({ name: r.name, routineId: r.id, items: r.items });
        return;
      }
      case 'new-routine': return openRoutine(null);
      case 'edit-routine': return openRoutine(b.dataset.id);
      case 'hevy': return $('#hevyFile').click();
      case 'add-ex':
        return openPicker((ids) => {
          for (const id of ids) a.items.push({ exId: id, rest: 90, sets: blankSets(prevSets(id).length || 3) });
          saveNow(); core.render();
          requestAnimationFrame(() => document.querySelectorAll('.ex-card')[a.items.length - ids.length]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        });
      case 'done': {
        const p = rowOf(b); if (!p || !a) return;
        ensureAudio();
        const it = a.items[p.i], st = it.sets[p.j], ex = exById(it.exId);
        if (st.d) { st.d = false; saveSoon(); core.render(); return; }
        const src = sourceFor(it, p.j, prevSets(it.exId)) || {};
        if (ex.type === 'time') { if (st.s == null) st.s = src.s ?? null; }
        else {
          if (st.r == null) st.r = src.r ?? null;
          if (st.w == null) st.w = src.w ?? (ex.type === 'bw' ? null : null);
        }
        const ok = ex.type === 'time' ? st.s > 0 : ex.type === 'bw' ? st.r > 0 : st.r > 0 && st.w != null;
        if (!ok) { toast(ex.type === 'time' ? 'Vul de tijd in' : ex.type === 'bw' ? 'Vul je herhalingen in' : 'Vul gewicht en herhalingen in'); b.closest('.set-row').querySelector('input')?.focus(); return; }
        st.d = true;
        if (isWork(st) || st.t === 'w') startRest(it.rest ?? 90);
        saveSoon(); core.render();
        return;
      }
      case 'use-prev': {
        const p = rowOf(b); if (!p || !a) return;
        const it = a.items[p.i], src = prevSets(it.exId)[p.j];
        if (!src) return;
        Object.assign(it.sets[p.j], { w: src.w ?? null, r: src.r ?? null, s: src.s ?? null });
        saveSoon(); core.render();
        return;
      }
      case 'add-set': {
        const i = cardOf(b); const it = a.items[i];
        it.sets.push({});
        saveSoon(); core.render();
        return;
      }
      case 'ex-menu': { const i = cardOf(b); if (openMenus.has(i)) openMenus.delete(i); else openMenus.add(i); core.render(); return; }
      case 'ex-up': case 'ex-down': {
        const i = cardOf(b), j = b.dataset.g === 'ex-up' ? i - 1 : i + 1;
        if (j < 0 || j >= a.items.length) return;
        [a.items[i], a.items[j]] = [a.items[j], a.items[i]];
        openMenus.clear(); saveSoon(); core.render();
        return;
      }
      case 'ex-del': {
        const i = cardOf(b);
        if (!confirm(`${exById(a.items[i].exId).name} uit deze training halen?`)) return;
        a.items.splice(i, 1); openMenus.clear(); saveNow(); core.render();
        return;
      }
      case 'ex-info': return openExercise(b.dataset.ex);
      case 'finish': return finishWorkout();
      case 'cancel':
        if (!confirm('Training annuleren? Wat je ingevuld hebt, wordt niet bewaard.')) return;
        g.active = null; openMenus.clear(); saveNow(); core.render(); return;
      case 'rest-minus': if (a && a.restEnd) { a.restEnd -= 15000; a.restTotal = Math.max(15, (a.restTotal || 90) - 15); saveSoon(); tick(); } return;
      case 'rest-plus': if (a && a.restEnd) { a.restEnd += 15000; a.restTotal = (a.restTotal || 90) + 15; saveSoon(); tick(); } return;
      case 'rest-skip': return stopRest();
      case 'open-workout': return openWorkout(b.dataset.id);
      case 'redo': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        workoutSheet.close();
        return startWorkout({ name: w.name, routineId: w.routineId, items: w.items.map((it) => ({ exId: it.exId, types: it.sets.map((s) => s.t) })) });
      }
      case 'to-routine': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        g.routines.push({ id: uid(), name: w.name, items: w.items.map((it) => ({ exId: it.exId, n: it.sets.length, rest: 90 })) });
        saveNow(); workoutSheet.close(); toast(`Schema "${w.name}" gemaakt`); core.go('gym');
        return;
      }
      case 'del-workout': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        if (!confirm(`Training "${w.name}" van ${fmtDate(dayOf(w.start))} verwijderen?`)) return;
        g.workouts = g.workouts.filter((x) => x !== w);
        saveNow(); workoutSheet.close(); toast('Training verwijderd'); core.render();
        return;
      }
      case 'ex-chart': exChart = b.dataset.k; renderExerciseSheet(); drawExChart(); return;
      case 'del-custom': {
        const used = g.workouts.some((w) => w.items.some((it) => it.exId === exOpen)) || g.routines.some((r) => r.items.some((it) => it.exId === exOpen)) || a?.items.some((it) => it.exId === exOpen);
        if (used) { toast('Deze oefening zit nog in trainingen of schema\'s'); return; }
        if (!confirm('Eigen oefening verwijderen?')) return;
        g.custom = g.custom.filter((c) => c.id !== exOpen);
        saveNow(); exSheet.close(); core.render();
        return;
      }
      case 'ex-group': exUi.group = b.dataset.group; return renderExercises();
      case 'pick-group': pk.group = b.dataset.group; return renderPicker();
      case 'pick': {
        const id = b.dataset.ex;
        pk.sel = pk.sel.includes(id) ? pk.sel.filter((x) => x !== id) : [...pk.sel, id];
        return renderPickerList();
      }
      case 'pick-done': {
        if (!pk.sel.length) { toast('Kies minstens één oefening'); return; }
        const ids = pk.sel, cb = pk.onDone;
        picker.close();
        cb?.(ids);
        return;
      }
      case 'new-custom':
        if (!picker.open) { Object.assign(pk, { q: exUi.q, group: exUi.group, sel: [], onDone: null }); picker.showModal(); }
        pk.form = true; renderPicker(); $('#customForm input')?.focus();
        return;
      case 'custom-cancel': if (!pk.onDone) { picker.close(); return; } pk.form = false; return renderPicker();
      case 'r-add':
        return openPicker((ids) => { for (const id of ids) draft.items.push({ exId: id, n: Math.max(1, prevSets(id).filter(isWork).length) || 3, rest: 90 }); renderRoutine(); });
      case 'r-minus': case 'r-plus': {
        const it = draft.items[+b.closest('.r-item').dataset.i];
        it.n = Math.max(1, Math.min(20, it.n + (b.dataset.g === 'r-plus' ? 1 : -1)));
        return renderRoutine();
      }
      case 'r-up': case 'r-down': {
        const i = +b.closest('.r-item').dataset.i, j = b.dataset.g === 'r-up' ? i - 1 : i + 1;
        [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]];
        return renderRoutine();
      }
      case 'r-del': draft.items.splice(+b.closest('.r-item').dataset.i, 1); return renderRoutine();
      case 'r-save': return saveRoutine();
      case 'r-delete':
        if (!confirm(`Schema "${draft.name}" verwijderen? Je afgeronde trainingen blijven bewaard.`)) return;
        g.routines = g.routines.filter((r) => r.id !== draft.id);
        saveNow(); routineSheet.close(); toast('Schema verwijderd'); core.render();
        return;
    }
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    const k = t.dataset?.gin;
    if (!k) return;
    const a = act();
    if (k === 'w' || k === 'r' || k === 's') {
      const p = rowOf(t); if (!p || !a) return;
      const st = a.items[p.i].sets[p.j];
      const n = parseNum(t.value);
      if (Number.isNaN(n)) return;
      if (k === 's') st.s = n == null ? null : Math.round(n * 60);
      else if (k === 'r') st.r = n == null ? null : Math.round(n);
      else st.w = n;
      if (st.d) updateHead();
      saveSoon();
    } else if (k === 'name' && a) { a.name = t.value; saveSoon(); }
    else if (k === 'note' && a) { a.note = t.value; saveSoon(); }
    else if (k === 'ex-q') { exUi.q = t.value; $('#exList').innerHTML = exListItems(); }
    else if (k === 'pick-q') { pk.q = t.value; renderPickerList(); }
    else if (k === 'r-name') draft.name = t.value;
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    const a = act();
    if (t.id === 'hevyFile' && t.files[0]) { importHevy(t.files[0]); t.value = ''; return; }
    if (t.dataset?.gin === 't' && a) {
      const p = rowOf(t); if (!p) return;
      const it = a.items[p.i];
      if (t.value === 'x') { if (it.sets.length === 1) { toast('Een oefening heeft minstens één set'); core.render(); return; } it.sets.splice(p.j, 1); }
      else it.sets[p.j].t = t.value || undefined;
      saveSoon(); core.render();
    } else if (t.dataset?.gin === 'rest' && a) {
      a.items[cardOf(t)].rest = Number(t.value);
      saveSoon(); core.render();
    }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'customForm') return;
    ev.preventDefault();
    const f = ev.target;
    const name = f.name.value.trim();
    if (!name) { f.name.focus(); return; }
    if (exAll().some((e) => norm(e.name) === norm(name))) { toast('Die oefening bestaat al'); return; }
    const c = { id: 'c-' + uid(), name, en: name, group: f.group.value, type: f.type.value };
    G().custom.push(c);
    saveNow();
    toast('Oefening gemaakt');
    if (pk.onDone) { pk.form = false; pk.sel = [...pk.sel, c.id]; pk.q = ''; renderPicker(); }
    else { picker.close(); core.render(); }
  });

  // Sluiten via de achtergrond of [data-close]
  for (const dlg of [picker, routineSheet, workoutSheet, exSheet]) {
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close();
    });
  }
  // Pickerknop staat in de kop
  $('#pickDone').dataset.g = 'pick-done';
  $('#routineSave').dataset.g = 'r-save';
  workoutSheet.addEventListener('close', () => { if (ui.view === 'gymHistory' || ui.view === 'gym') core.render(); });

  tick();

  return {
    views: { gym: renderGym, gymHistory: renderHistory, gymEx: renderExercises },
    titles: { gym: 'Training', gymHistory: 'Historiek', gymEx: 'Oefeningen' },
    afterRender() { tick(); },
    importHevy,
  };
};
