/* Gainly — Gym: log workouts, routines, history, exercises and personal records.
   Everything lives in state.gym (so it is part of backups and restore points):
   { workouts: [...], routines: [...], custom: [...], active: {...} }
   A set: { w: kg, r: reps, s: seconds, t: 'w'|'d'|'f' (warm-up/drop/failure), d: ticked (only during the workout) }
   Exercise images and instructions: free-exercise-db (public domain, Unlicense), loaded from exercises.json. */
window.GainlyGym = function (core) {
  'use strict';
  const { $, esc, fmt, fmtDate, fmtShort, toISO, todayISO, addDays, parseNum, uid, plural, chev, lineChart, viewEl, toast, ui, DF_WEEKDAY } = core;

  // Older versions stored muscle groups in Dutch
  const OLD_GROUPS = { Borst: 'Chest', Rug: 'Back', Schouders: 'Shoulders', Armen: 'Arms', Benen: 'Legs', Buik: 'Core', Overig: 'Other' };
  const G = () => {
    const s = core.state;
    if (!s.gym || typeof s.gym !== 'object') s.gym = {};
    const g = s.gym;
    if (!Array.isArray(g.workouts)) g.workouts = [];
    if (!Array.isArray(g.routines)) g.routines = [];
    if (!Array.isArray(g.custom)) g.custom = [];
    for (const c of g.custom) if (OLD_GROUPS[c.group]) c.group = OLD_GROUPS[c.group];
    return g;
  };

  /* ---------------- Exercise library ---------------- */
  const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Stretching', 'Other'];
  const TYPES = { kg: 'Weight × reps', bw: 'Bodyweight (+ extra kg)', time: 'Time' };
  const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';
  // id, name (matches Hevy's names so imports link up), group, type, image from the database (only when it shows the same movement)
  const L = (id, name, group, img = null, type = 'kg') => ({ id, name, group, type, img });
  const LIB = [
    L('bench-bb', 'Bench Press (Barbell)', 'Chest', 'Barbell_Bench_Press_-_Medium_Grip'),
    L('bench-db', 'Bench Press (Dumbbell)', 'Chest', 'Dumbbell_Bench_Press'),
    L('bench-smith', 'Bench Press (Smith Machine)', 'Chest', 'Smith_Machine_Bench_Press'),
    L('incline-bb', 'Incline Bench Press (Barbell)', 'Chest', 'Barbell_Incline_Bench_Press_-_Medium_Grip'),
    L('incline-db', 'Incline Bench Press (Dumbbell)', 'Chest', 'Incline_Dumbbell_Press'),
    L('incline-smith', 'Incline Bench Press (Smith Machine)', 'Chest', 'Smith_Machine_Incline_Bench_Press'),
    L('decline-bb', 'Decline Bench Press (Barbell)', 'Chest', 'Decline_Barbell_Bench_Press'),
    L('chest-press', 'Chest Press (Machine)', 'Chest', 'Leverage_Chest_Press'),
    L('iso-chest', 'Iso-Lateral Chest Press (Machine)', 'Chest', 'Leverage_Chest_Press'),
    L('fly-db', 'Chest Fly (Dumbbell)', 'Chest', 'Dumbbell_Flyes'),
    L('fly-m', 'Chest Fly (Machine)', 'Chest', 'Butterfly'),
    L('pec-deck', 'Butterfly (Pec Deck)', 'Chest', 'Butterfly'),
    L('cable-fly', 'Cable Fly Crossovers', 'Chest', 'Cable_Crossover'),
    L('seated-cable-fly', 'Seated Chest Flys (Cable)', 'Chest'),
    L('pushup', 'Push Up', 'Chest', 'Pushups', 'bw'),
    L('pushup-w', 'Push Up (Weighted)', 'Chest', 'Pushups'),
    L('diamond-pushup', 'Diamond Push Up', 'Chest', 'Push-Ups_-_Close_Triceps_Position', 'bw'),
    L('dips', 'Chest Dip', 'Chest', 'Dips_-_Chest_Version', 'bw'),
    L('deadlift', 'Deadlift (Barbell)', 'Back', 'Barbell_Deadlift'),
    L('deadlift-smith', 'Deadlift (Smith Machine)', 'Back'),
    L('pullup', 'Pull Up', 'Back', 'Pullups', 'bw'),
    L('pullup-assist', 'Pull Up (Assisted)', 'Back', 'Band_Assisted_Pull-Up'),
    L('pullup-band', 'Pull Up (Band)', 'Back', 'Band_Assisted_Pull-Up'),
    L('chinup', 'Chin Up', 'Back', 'Chin-Up', 'bw'),
    L('latpull', 'Lat Pulldown (Cable)', 'Back', 'Wide-Grip_Lat_Pulldown'),
    L('latpull-m', 'Lat Pulldown (Machine)', 'Back', 'Wide-Grip_Lat_Pulldown'),
    L('latpull-close', 'Lat Pulldown - Close Grip (Cable)', 'Back', 'Close-Grip_Front_Lat_Pulldown'),
    L('latpull-single', 'Single Arm Lat Pulldown', 'Back', 'One_Arm_Lat_Pulldown'),
    L('straight-pulldown', 'Straight Arm Lat Pulldown (Cable)', 'Back', 'Straight-Arm_Pulldown'),
    L('rope-pulldown', 'Rope Straight Arm Pulldown', 'Back', 'Rope_Straight-Arm_Pulldown'),
    L('row-bb', 'Bent Over Row (Barbell)', 'Back', 'Bent_Over_Barbell_Row'),
    L('row-db', 'Dumbbell Row', 'Back', 'One-Arm_Dumbbell_Row'),
    L('cable-row', 'Seated Cable Row - V Grip (Cable)', 'Back', 'Seated_Cable_Rows'),
    L('cable-row-single', 'Single Arm Cable Row', 'Back', 'Seated_One-arm_Cable_Pulley_Rows'),
    L('row-m', 'Seated Row (Machine)', 'Back', 'Leverage_Iso_Row'),
    L('iso-row', 'Iso-Lateral Row (Machine)', 'Back', 'Leverage_Iso_Row'),
    L('tbar', 'T Bar Row', 'Back', 'T-Bar_Row_with_Handle'),
    L('pullover', 'Pullover (Dumbbell)', 'Back', 'Bent-Arm_Dumbbell_Pullover'),
    L('pullover-m', 'Pullover (Machine)', 'Back'),
    L('backext', 'Back Extension (Hyperextension)', 'Back', 'Hyperextensions_Back_Extensions', 'bw'),
    L('backext-w', 'Back Extension (Weighted Hyperextension)', 'Back', 'Hyperextensions_Back_Extensions'),
    L('shrug', 'Shrug (Dumbbell)', 'Back', 'Dumbbell_Shrug'),
    L('shrug-bb', 'Shrug (Barbell)', 'Back', 'Barbell_Shrug'),
    L('shrug-c', 'Shrug (Cable)', 'Back', 'Cable_Shrugs'),
    L('shrug-m', 'Shrug (Machine)', 'Back'),
    L('kelso', 'Kelso Shrugs (Row Machine)', 'Back'),
    L('facepull', 'Face Pull', 'Shoulders', 'Face_Pull'),
    L('ohp-bb', 'Overhead Press (Barbell)', 'Shoulders', 'Standing_Military_Press'),
    L('ohp-smith', 'Overhead Press (Smith Machine)', 'Shoulders', 'Smith_Machine_Overhead_Shoulder_Press'),
    L('ohp-db', 'Shoulder Press (Dumbbell)', 'Shoulders', 'Dumbbell_Shoulder_Press'),
    L('ohp-db-seated', 'Seated Overhead Press (Dumbbell)', 'Shoulders', 'Seated_Dumbbell_Press'),
    L('ohp-m', 'Seated Shoulder Press (Machine)', 'Shoulders', 'Machine_Shoulder_Military_Press'),
    L('arnold', 'Arnold Press (Dumbbell)', 'Shoulders', 'Arnold_Dumbbell_Press'),
    L('lateral-db', 'Lateral Raise (Dumbbell)', 'Shoulders', 'Side_Lateral_Raise'),
    L('lateral-c', 'Lateral Raise (Cable)', 'Shoulders', 'Cable_Seated_Lateral_Raise'),
    L('lateral-c-single', 'Single Arm Lateral Raise (Cable)', 'Shoulders'),
    L('front-db', 'Front Raise (Dumbbell)', 'Shoulders', 'Front_Dumbbell_Raise'),
    L('front-c', 'Front Raise (Cable)', 'Shoulders', 'Front_Cable_Raise'),
    L('reardelt-db', 'Rear Delt Reverse Fly (Dumbbell)', 'Shoulders', 'Seated_Bent-Over_Rear_Delt_Raise'),
    L('reardelt-m', 'Rear Delt Reverse Fly (Machine)', 'Shoulders', 'Reverse_Machine_Flyes'),
    L('reardelt-c', 'Reverse Fly Single Arm (Cable)', 'Shoulders', 'Cable_Rear_Delt_Fly'),
    L('uprow', 'Upright Row (Barbell)', 'Shoulders', 'Upright_Barbell_Row'),
    L('curl-bb', 'Bicep Curl (Barbell)', 'Arms', 'Barbell_Curl'),
    L('curl-db', 'Bicep Curl (Dumbbell)', 'Arms', 'Dumbbell_Bicep_Curl'),
    L('curl-c', 'Bicep Curl (Cable)', 'Arms', 'Standing_Biceps_Cable_Curl'),
    L('curl-c-single', 'Single Arm Curl (Cable)', 'Arms', 'Standing_One-Arm_Cable_Curl'),
    L('curl-overhead-c', 'Overhead Curl (Cable)', 'Arms', 'Overhead_Cable_Curl'),
    L('curl-behind-c', 'Behind the Back Curl (Cable)', 'Arms'),
    L('ezcurl', 'EZ Bar Biceps Curl', 'Arms', 'EZ-Bar_Curl'),
    L('incline-curl', 'Seated Incline Curl (Dumbbell)', 'Arms', 'Incline_Dumbbell_Curl'),
    L('spider-curl', 'Spider Curl (Barbell)', 'Arms', 'Spider_Curl'),
    L('zottman', 'Zottman Curl (Dumbbell)', 'Arms', 'Zottman_Curl'),
    L('hammer', 'Hammer Curl (Dumbbell)', 'Arms', 'Hammer_Curls'),
    L('hammer-c', 'Hammer Curl (Cable)', 'Arms', 'Cable_Hammer_Curls_-_Rope_Attachment'),
    L('preacher', 'Preacher Curl (Barbell)', 'Arms', 'Preacher_Curl'),
    L('preacher-db', 'Preacher Curl (Dumbbell)', 'Arms', 'Two-Arm_Dumbbell_Preacher_Curl'),
    L('preacher-m', 'Preacher Curl (Machine)', 'Arms', 'Machine_Preacher_Curls'),
    L('preacher-c', 'Cable Preacher Curl', 'Arms', 'Cable_Preacher_Curl'),
    L('reverse-curl-bb', 'Reverse Curl (Barbell)', 'Arms', 'Reverse_Barbell_Curl'),
    L('reverse-curl-c', 'Reverse Curl (Cable)', 'Arms', 'Reverse_Cable_Curl'),
    L('pushdown', 'Triceps Pushdown', 'Arms', 'Triceps_Pushdown'),
    L('rope-pushdown', 'Triceps Rope Pushdown', 'Arms', 'Triceps_Pushdown_-_Rope_Attachment'),
    L('pushdown-single', 'Single Arm Triceps Pushdown (Cable)', 'Arms'),
    L('skull', 'Skullcrusher (Barbell)', 'Arms', 'Lying_Triceps_Press'),
    L('oh-ext', 'Overhead Triceps Extension (Cable)', 'Arms', 'Cable_Rope_Overhead_Triceps_Extension'),
    L('tri-ext-c', 'Triceps Extension (Cable)', 'Arms'),
    L('tri-ext-db', 'Triceps Extension (Dumbbell)', 'Arms', 'Standing_Dumbbell_Triceps_Extension'),
    L('tri-ext-db-single', 'Single Arm Tricep Extension (Dumbbell)', 'Arms', 'Dumbbell_One-Arm_Triceps_Extension'),
    L('tri-ext-bb', 'Triceps Extension (Barbell)', 'Arms', 'Standing_Overhead_Barbell_Triceps_Extension'),
    L('kickback-c', 'Triceps Kickback (Cable)', 'Arms'),
    L('kickback-db', 'Triceps Kickback (Dumbbell)', 'Arms', 'Tricep_Dumbbell_Kickback'),
    L('jm-press', 'JM Press (Barbell)', 'Arms', 'JM_Press'),
    L('cgbench', 'Bench Press - Close Grip (Barbell)', 'Arms', 'Close-Grip_Barbell_Bench_Press'),
    L('tri-dips', 'Triceps Dip', 'Arms', 'Dips_-_Triceps_Version', 'bw'),
    L('tri-dips-assist', 'Triceps Dip (Assisted)', 'Arms'),
    L('wristcurl', 'Wrist Curl (Barbell)', 'Arms', 'Seated_Palm-Up_Barbell_Wrist_Curl'),
    L('wrist-ext', 'Seated Wrist Extension (Barbell)', 'Arms', 'Seated_Palms-Down_Barbell_Wrist_Curl'),
    L('wristcurl-db', 'Seated Palms Up Wrist Curl', 'Arms', 'Seated_Dumbbell_Palms-Up_Wrist_Curl'),
    L('wristcurl-behind', 'Behind the Back Bicep Wrist Curl (Barbell)', 'Arms', 'Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl'),
    L('wrist-roller', 'Wrist Roller', 'Arms', 'Wrist_Roller'),
    L('squat-bb', 'Squat (Barbell)', 'Legs', 'Barbell_Squat'),
    L('squat-smith', 'Squat (Smith Machine)', 'Legs', 'Smith_Machine_Squat'),
    L('front-squat', 'Front Squat', 'Legs', 'Front_Barbell_Squat'),
    L('goblet', 'Goblet Squat', 'Legs', 'Goblet_Squat'),
    L('hack', 'Hack Squat (Machine)', 'Legs', 'Hack_Squat'),
    L('legpress', 'Leg Press (Machine)', 'Legs', 'Leg_Press'),
    L('lunge', 'Lunge (Dumbbell)', 'Legs', 'Dumbbell_Lunges'),
    L('bulgarian', 'Bulgarian Split Squat', 'Legs', 'Split_Squat_with_Dumbbells'),
    L('bulgarian-db', 'Bulgarian Split Squat (Dumbbell)', 'Legs', 'Split_Squat_with_Dumbbells'),
    L('bulgarian-smith', 'Bulgarian Split Squat (Smith Machine)', 'Legs', 'Smith_Single-Leg_Split_Squat'),
    L('legext', 'Leg Extension (Machine)', 'Legs', 'Leg_Extensions'),
    L('legcurl-l', 'Lying Leg Curl (Machine)', 'Legs', 'Lying_Leg_Curls'),
    L('legcurl-s', 'Seated Leg Curl (Machine)', 'Legs', 'Seated_Leg_Curl'),
    L('rdl-bb', 'Romanian Deadlift (Barbell)', 'Legs', 'Romanian_Deadlift'),
    L('rdl-db', 'Romanian Deadlift (Dumbbell)', 'Legs', 'Stiff-Legged_Dumbbell_Deadlift'),
    L('sldl', 'Straight Leg Deadlift', 'Legs', 'Stiff-Legged_Barbell_Deadlift'),
    L('hipthrust', 'Hip Thrust (Barbell)', 'Legs', 'Barbell_Hip_Thrust'),
    L('hipthrust-smith', 'Hip Thrust (Smith Machine)', 'Legs'),
    L('hipthrust-m', 'Hip Thrust (Machine)', 'Legs'),
    L('kickback', 'Glute Kickback (Cable)', 'Legs', 'One-Legged_Cable_Kickback'),
    L('abductor', 'Hip Abduction (Machine)', 'Legs', 'Thigh_Abductor'),
    L('adductor', 'Hip Adduction (Machine)', 'Legs', 'Thigh_Adductor'),
    L('calf-stand', 'Standing Calf Raise (Machine)', 'Legs', 'Standing_Calf_Raises'),
    L('calf-seat', 'Seated Calf Raise', 'Legs', 'Seated_Calf_Raise'),
    L('calf-press', 'Calf Press (Machine)', 'Legs', 'Calf_Press_On_The_Leg_Press_Machine'),
    L('calf-ext', 'Calf Extension (Machine)', 'Legs', 'Calf_Press'),
    L('stepup', 'Step Up', 'Legs', 'Dumbbell_Step_Ups'),
    L('crunch', 'Crunch', 'Core', 'Crunches', 'bw'),
    L('crunch-m', 'Crunch (Machine)', 'Core', 'Ab_Crunch_Machine'),
    L('decline-crunch-w', 'Decline Crunch (Weighted)', 'Core', 'Decline_Crunch'),
    L('cablecrunch', 'Cable Crunch', 'Core', 'Cable_Crunch'),
    L('legraise', 'Hanging Leg Raise', 'Core', 'Hanging_Leg_Raise', 'bw'),
    L('russian', 'Russian Twist', 'Core', 'Russian_Twist', 'bw'),
    L('abwheel', 'Ab Wheel', 'Core', 'Ab_Roller', 'bw'),
    L('plank', 'Plank', 'Core', 'Plank', 'time'),
    L('treadmill', 'Treadmill', 'Cardio', 'Running_Treadmill', 'time'),
    L('walking', 'Walking', 'Cardio', 'Walking_Treadmill', 'time'),
    L('bike', 'Cycling', 'Cardio', 'Bicycling_Stationary', 'time'),
    L('rower', 'Rowing Machine', 'Cardio', 'Rowing_Stationary', 'time'),
    L('stair', 'Stair Machine', 'Cardio', 'Stairmaster', 'time'),
    L('elliptical', 'Elliptical Trainer', 'Cardio', 'Elliptical_Trainer', 'time'),
  ];
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

  // The full database (876 exercises) is loaded next to the app and cached for offline use.
  let DBEX = [];
  const dbInfo = new Map();
  const dbReady = fetch('exercises.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const libImgs = new Set(LIB.map((e) => e.img).filter(Boolean));
      const libNames = new Set(LIB.map((e) => norm(e.name)));
      for (const o of list) {
        dbInfo.set(o.i, o);
        if (libImgs.has(o.i) || libNames.has(norm(o.n))) continue;
        DBEX.push({ id: 'db:' + o.i, name: o.n, group: o.g, type: o.t, img: o.i });
      }
      migrateCustoms();
      if (['gym', 'gymHistory', 'gymEx'].includes(ui.view)) core.render();
    })
    .catch(() => {});

  const exAll = () => [...LIB, ...G().custom, ...DBEX];
  const exById = (id) => exAll().find((e) => e.id === id) || { id, name: id.startsWith('db:') ? id.slice(3).replace(/_/g, ' ') : 'Unknown exercise', group: 'Other', type: 'kg' };

  // Earlier Hevy imports created custom exercises that now exist in the library: link them up.
  function migrateCustoms() {
    const g = G();
    const byName = new Map(LIB.map((e) => [norm(e.name), e.id]));
    const remap = new Map();
    for (const c of g.custom) { const id = byName.get(norm(c.name)); if (id) remap.set(c.id, id); }
    if (!remap.size) return;
    const fix = (items) => items && items.forEach((it) => { if (remap.has(it.exId)) it.exId = remap.get(it.exId); });
    g.workouts.forEach((w) => fix(w.items));
    g.routines.forEach((r) => fix(r.items));
    if (g.active) fix(g.active.items);
    g.custom = g.custom.filter((c) => !remap.has(c.id));
    core.save();
  }

  const infoOf = (ex) => (ex.img ? dbInfo.get(ex.img) : null);
  // Drawn versions (vector, background removed): flag `d` in exercises.json. Otherwise the photo is used.
  const isDrawn = (ex) => !!ex.img && !!(dbInfo.get(ex.img) || {}).d;
  function imgUrl(ex, frame = 0) {
    if (!ex.img) return null;
    if (isDrawn(ex)) return `drawings/${ex.img}/${frame}.svg`;
    const info = dbInfo.get(ex.img);
    return CDN + ((info && info.im && info.im[frame]) || `${ex.img}/${frame}.jpg`);
  }
  function thumbHTML(ex) {
    const u = imgUrl(ex, 0);
    return `<span class="ex-thumb${isDrawn(ex) ? ' is-drawn' : ''}" aria-hidden="true">${u ? `<img src="${u}" alt="" loading="lazy" decoding="async">` : `<span>${esc(ex.name.charAt(0))}</span>`}</span>`;
  }

  /* ---------------- Calculations ---------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  };
  const fmtDur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `${m} min`; };
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
    if (ex.type === 'bw') return st.r ? (st.w ? `+${fmtKg(st.w)}${short ? '' : ' kg'} × ${st.r}` : `${st.r} reps`) : '—';
    return st.r != null && st.w != null ? `${fmtKg(st.w)}${short ? '' : ' kg'} × ${st.r}` : '—';
  }
  // Sets from the previous time you did this exercise
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
  const prLabel = (p) => (p.kind === 'kg' ? `heaviest weight ${fmtKg(p.value)} kg` : `best estimated 1RM ${fmtKg(p.value)} kg`);

  /* ---------------- Saving ---------------- */
  let saveTimer;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => core.save(), 400); };
  const saveNow = () => { clearTimeout(saveTimer); core.save(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G().active) saveNow(); });
  window.addEventListener('pagehide', () => { if (G().active) saveNow(); });

  /* ---------------- Start / finish a workout ---------------- */
  const blankSets = (n, types) => (types ? types.map((t) => (t ? { t } : {})) : Array.from({ length: Math.max(1, n || 3) }, () => ({})));

  function startWorkout({ name = 'Workout', items = [], routineId = null } = {}) {
    const g = G();
    if (g.active && !confirm('A workout is already running. Discard it and start a new one?')) return;
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
    const done = a.items.reduce((n, it) => n + it.sets.filter((st) => st.d).length, 0);
    if (!done) {
      if (confirm('You haven’t ticked off any sets yet. Discard this workout?')) { g.active = null; saveNow(); core.render(); }
      return;
    }
    const open = a.items.reduce((n, it) => n + it.sets.filter((st) => !st.d).length, 0);
    if (open && !confirm(`${plural(open, 'set isn’t', 'sets aren’t')} ticked off and won’t be saved. Finish the workout?`)) return;
    const wk = {
      id: a.id, name: (a.name || 'Workout').trim() || 'Workout', start: a.start, end: Date.now(), routineId: a.routineId || null, note: a.note || '',
      items: a.items.map((it) => ({ exId: it.exId, sets: it.sets.filter((st) => st.d).map(({ d, ...st }) => st) })).filter((it) => it.sets.length),
    };
    wk.prs = computePRs(wk);
    g.workouts.push(wk);
    g.active = null;
    saveNow();
    core.render();
    openWorkout(wk.id, true);
  }

  /* ---------------- Rest timer ---------------- */
  let audio = null;
  function ensureAudio() {
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { /* no sound */ }
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

  /* ---------------- Clock (duration, rest timer, "workout running") ---------------- */
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
        toast('Rest over: next set!');
      } else {
        restBar.hidden = false;
        restBar.querySelector('.rest__time').textContent = clock(left);
        restBar.style.setProperty('--p', String(1 - left / (a.restTotal || 90)));
      }
    } else restBar.hidden = true;
    document.body.classList.toggle('has-rest', !restBar.hidden);
  }
  setInterval(tick, 250);

  /* ---------------- View: Workout ---------------- */
  const TYPE_LABEL = { w: 'W', d: 'D', f: 'F' };
  const REST_OPTS = [0, 30, 60, 90, 120, 150, 180, 240, 300];
  const restText = (s) => (!s ? 'Off' : s < 60 ? `${s}s` : s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60} min`);
  const openMenus = new Set();

  function sourceFor(it, j, prev) { return prev[j] || (j > 0 ? it.sets[j - 1] : null); }
  const minutes = (s) => (s == null ? '' : fmt(s / 60, s % 60 ? 1 : 0));

  function exCardHTML(it, i) {
    const ex = exById(it.exId);
    const prev = prevSets(it.exId);
    let n = 0;
    const head = ex.type === 'time'
      ? '<span>Set</span><span>Previous</span><span class="set-head--wide">Minutes</span><span></span>'
      : `<span>Set</span><span>Previous</span><span>${ex.type === 'bw' ? '+kg' : 'kg'}</span><span>Reps</span><span></span>`;
    const rows = it.sets.map((st, j) => {
      const label = TYPE_LABEL[st.t] || String(++n);
      const p = prev[j];
      const src = sourceFor(it, j, prev);
      const inputs = ex.type === 'time'
        ? `<input class="set-in set-in--wide" data-gin="s" inputmode="decimal" enterkeyhint="done" placeholder="${src && src.s ? minutes(src.s) : 'min'}" value="${minutes(st.s)}" aria-label="Minutes, set ${j + 1}">`
        : `<input class="set-in" data-gin="w" inputmode="decimal" enterkeyhint="next" placeholder="${src && src.w != null ? fmtKg(src.w) : ex.type === 'bw' ? '0' : 'kg'}" value="${fmtKg(st.w)}" aria-label="Kilograms, set ${j + 1}">
           <input class="set-in" data-gin="r" inputmode="numeric" enterkeyhint="done" placeholder="${src && src.r != null ? src.r : 'reps'}" value="${st.r ?? ''}" aria-label="Reps, set ${j + 1}">`;
      return `<div class="set-row${st.d ? ' is-done' : ''}${ex.type === 'time' ? ' set-row--time' : ''}" data-i="${i}" data-j="${j}">
        <label class="set-type set-type--${st.t || 'n'}"><span>${label}</span>
          <select data-gin="t" aria-label="Set type ${j + 1}">
            <option value="" ${!st.t ? 'selected' : ''}>Normal set</option>
            <option value="w" ${st.t === 'w' ? 'selected' : ''}>Warm-up set (W)</option>
            <option value="d" ${st.t === 'd' ? 'selected' : ''}>Drop set (D)</option>
            <option value="f" ${st.t === 'f' ? 'selected' : ''}>To failure (F)</option>
            <option value="x">Remove set</option>
          </select></label>
        <button type="button" class="set-prev" data-g="use-prev" ${p ? '' : 'disabled'} aria-label="Last time: ${esc(setText(ex, p))}">${esc(setText(ex, p, true))}</button>
        ${inputs}
        <button type="button" class="set-check" data-g="done" aria-pressed="${!!st.d}" aria-label="Set ${j + 1} done"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>
      </div>`;
    }).join('');
    const menu = openMenus.has(i) ? `<div class="ex-menu">
        <label class="ex-menu__rest">Rest timer <select data-gin="rest">${REST_OPTS.map((s) => `<option value="${s}" ${s === (it.rest ?? 90) ? 'selected' : ''}>${restText(s)}</option>`).join('')}</select></label>
        <div class="ex-menu__row">
          <button type="button" class="button" data-g="ex-up" ${i ? '' : 'disabled'}>↑ Up</button>
          <button type="button" class="button" data-g="ex-down">↓ Down</button>
          <button type="button" class="button button--danger" data-g="ex-del">Remove</button>
        </div>
      </div>` : '';
    return `<div class="card ex-card" data-i="${i}">
      <div class="ex-card__head">
        ${thumbHTML(ex)}
        <button type="button" class="ex-card__name" data-g="ex-info" data-ex="${esc(ex.id)}">${esc(ex.name)}</button>
        <span class="ex-card__rest">${it.rest ? `⏱ ${restText(it.rest)}` : ''}</span>
        <button type="button" class="ex-card__more" data-g="ex-menu" aria-expanded="${openMenus.has(i)}" aria-label="Options for ${esc(ex.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>
      </div>
      ${menu}
      <div class="set-row set-row--head${ex.type === 'time' ? ' set-row--time' : ''}" aria-hidden="true">${head}</div>
      ${rows}
      <button type="button" class="ex-card__add" data-g="add-set">+ Add set</button>
    </div>`;
  }

  function renderActive(el) {
    const a = G().active;
    el.innerHTML = `
      <div class="card wk-head">
        <input class="wk-title" data-gin="name" value="${esc(a.name)}" aria-label="Workout name" autocomplete="off">
        <div class="wk-stats">
          <div><span>Duration</span><strong id="wkClock">${clock((Date.now() - a.start) / 1000)}</strong></div>
          <div><span>Volume</span><strong id="wkVol">${fmtVol(itemsVol(a.items, true))} kg</strong></div>
          <div><span>Sets</span><strong id="wkSets">${itemsSets(a.items, true)}</strong></div>
        </div>
      </div>
      ${a.items.map(exCardHTML).join('')}
      ${a.items.length ? '' : '<p class="hint" style="text-align:center;margin:8px 0">Add your first exercise.</p>'}
      <button type="button" class="button button--primary" data-g="add-ex">+ Add exercise</button>
      <label class="field" style="margin:4px 0 0"><span class="field__label">Note</span><textarea data-gin="note" rows="2" placeholder="How did it go?">${esc(a.note)}</textarea></label>
      <div class="button-row">
        <button type="button" class="button button--danger" data-g="cancel">Discard</button>
        <button type="button" class="button" data-g="finish">Finish</button>
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
          <div class="stat"><span class="stat__label">This week</span><span class="stat__value">${plural(thisWeek, 'workout', 'workouts')}</span></div>
          <div class="stat"><span class="stat__label">Last</span><span class="stat__value">${last ? fmtShort(dayOf(last.start)) : '—'}</span></div>
        </div>
        <button type="button" class="button button--primary" data-g="start-empty">Start empty workout</button>
      </div>
      <div class="section-row"><h2 class="section-title">Routines · ${g.routines.length}</h2><button type="button" class="inline-link" data-g="new-routine">+ New routine</button></div>
      ${g.routines.length ? g.routines.map((r) => {
        const ld = lastDone(r.id);
        const names = r.items.map((it) => exById(it.exId).name);
        return `<div class="card routine">
          <div class="routine__main">
            <h3 class="routine__name">${esc(r.name)}</h3>
            <p class="routine__sub">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</p>
            <p class="routine__meta">${plural(r.items.length, 'exercise', 'exercises')}${ld ? ` · last ${fmtShort(dayOf(ld.start))}` : ''}</p>
          </div>
          <div class="routine__actions">
            <button type="button" class="button button--primary" data-g="start-routine" data-id="${r.id}">Start</button>
            <button type="button" class="inline-link" data-g="edit-routine" data-id="${r.id}">Edit</button>
          </div>
        </div>`;
      }).join('') : '<div class="card"><p class="prose">Create a routine for your regular workouts, like Push, Pull and Legs. Then you start them with one tap, with your previous weights alongside.</p></div>'}
      <div class="card">
        <h2 class="card__title" style="margin-bottom:6px">Coming from Hevy?</h2>
        <p class="prose" style="margin-bottom:12px">Export your workouts from Hevy as a CSV file (in its settings, under export) and import it here. Duplicate workouts are skipped.</p>
        <button type="button" class="button" data-g="hevy">Import Hevy CSV</button>
        <input type="file" id="hevyFile" accept=".csv,text/csv" hidden>
      </div>`;
  }

  function renderGym() {
    const el = viewEl('gym');
    if (G().active) renderActive(el); else renderStart(el);
  }

  /* ---------------- View: History ---------------- */
  function renderHistory() {
    const el = viewEl('gymHistory');
    const h = history();
    if (!h.length) {
      el.innerHTML = `<div class="card empty"><h2>No workouts yet</h2><p>Finished workouts show up here, with your volume and records.</p><button class="button button--primary" data-tab-go="gym">Start a workout</button></div>`;
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
    const MF = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
    el.innerHTML = `
      <div class="card">
        <div class="stats">
          <div class="stat"><span class="stat__label">This week</span><span class="stat__value">${counts[7]}</span></div>
          <div class="stat"><span class="stat__label">This month</span><span class="stat__value">${(byMonth[month] || []).length}</span></div>
          <div class="stat"><span class="stat__label">Total</span><span class="stat__value">${h.length}</span></div>
        </div>
        <div class="weekbars" role="img" aria-label="Workouts per week, last 8 weeks: ${counts.join(', ')}">
          ${counts.map((c, i) => `<div class="weekbars__col"><span class="weekbars__n">${c || ''}</span><span class="weekbars__bar${i === 7 ? ' is-now' : ''}" style="height:${Math.max(3, (c / max) * 64)}px"></span><span class="weekbars__lbl">${i === 7 ? 'now' : fmtShort(weeks[i])}</span></div>`).join('')}
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

  /* ---------------- View: Exercises ---------------- */
  const exUi = { q: '', group: '', shown: 60 };
  function exStats(exId) {
    const sessions = [];
    for (const w of [...G().workouts].sort((a, b) => a.start - b.start)) {
      const it = w.items.find((x) => x.exId === exId);
      if (it) sessions.push({ w, sets: it.sets });
    }
    return sessions;
  }
  function usageCounts() {
    const m = new Map();
    for (const w of G().workouts) for (const it of w.items) m.set(it.exId, (m.get(it.exId) || 0) + 1);
    return m;
  }
  // Search: your own exercises first (most used), then the rest alphabetically
  function filteredExercises(q, group) {
    const nq = norm(q);
    const used = usageCounts();
    return exAll().filter((e) => (!group || e.group === group) && (!nq || norm(e.name).includes(nq)))
      .sort((a, b) => (used.get(b.id) || 0) - (used.get(a.id) || 0) || (a.id.startsWith('db:') - b.id.startsWith('db:')) || a.name.localeCompare(b.name, 'en'));
  }
  function chipsHTML(sel, attr) {
    const groups = GROUPS.filter((g) => g !== 'Other' || exAll().some((c) => c.group === 'Other'));
    return `<div class="chips-scroll" role="group" aria-label="Muscle group">
      <button type="button" class="chip" data-g="${attr}" data-group="" aria-pressed="${!sel}">All</button>
      ${groups.map((g) => `<button type="button" class="chip" data-g="${attr}" data-group="${g}" aria-pressed="${sel === g}">${g}</button>`).join('')}
    </div>`;
  }
  function exListItems() {
    const all = filteredExercises(exUi.q, exUi.group);
    if (!all.length) return '<p class="hint" style="text-align:center;padding:20px 0">Nothing found.</p>';
    const list = all.slice(0, exUi.shown);
    return `<p class="hint" style="margin:4px 4px 8px">${plural(all.length, 'exercise', 'exercises')}</p><div class="list">${list.map((e) => {
      const ses = exStats(e.id);
      const last = ses[ses.length - 1];
      const best = last ? [...last.sets].filter(isWork).sort((a, b) => e1rm(b.w, b.r) - e1rm(a.w, a.r) || (b.r || 0) - (a.r || 0) || (b.s || 0) - (a.s || 0))[0] : null;
      return `<button class="list__item" data-g="ex-info" data-ex="${esc(e.id)}">
        ${thumbHTML(e)}
        <div class="list__main"><div class="list__title">${esc(e.name)}</div><div class="list__sub">${e.group}${last ? ` · ${plural(ses.length, 'time', 'times')}` : ''}</div></div>
        <div class="list__end">${best ? esc(setText(e, best)) : ''}<small>${last ? fmtShort(dayOf(last.w.start)) : ''}</small></div>${chev}
      </button>`;
    }).join('')}</div>
    ${all.length > list.length ? `<button type="button" class="button" data-g="ex-more" style="margin-top:10px">Show more (${all.length - list.length})</button>` : ''}`;
  }
  function renderExercises() {
    const el = viewEl('gymEx');
    el.innerHTML = `
      <input class="search" type="search" data-gin="ex-q" placeholder="Search ${exAll().length} exercises" value="${esc(exUi.q)}" aria-label="Search exercises">
      ${chipsHTML(exUi.group, 'ex-group')}
      <div id="exList">${exListItems()}</div>
      <button type="button" class="button" data-g="new-custom">+ Create custom exercise</button>
      <p class="hint" style="text-align:center">Images and instructions: free-exercise-db (public domain).</p>`;
  }

  /* ---------------- Sheet: exercise (stats) ---------------- */
  const exSheet = $('#exSheet');
  let exChart = 'e1rm';
  let exOpen = null;
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  function openExercise(exId) {
    exOpen = exId;
    renderExerciseSheet();
    if (!exSheet.open) exSheet.showModal();
    $('#exSheetBody').scrollTop = 0;
    drawExChart();
  }
  function renderExerciseSheet() {
    const ex = exById(exOpen);
    const info = infoOf(ex);
    const ses = exStats(exOpen);
    $('#exSheetTitle').textContent = ex.name;
    let stats = '';
    if (ses.length && ex.type === 'kg') {
      const all = ses.flatMap((s) => s.sets);
      const b = bestOf(all);
      const bestSetVol = Math.max(0, ...all.map(setVol));
      stats = `<div class="stats" style="margin-bottom:14px">
        <div class="stat"><span class="stat__label">Heaviest</span><span class="stat__value">${fmtKg(b.kg)} kg</span></div>
        <div class="stat"><span class="stat__label">Est. 1RM</span><span class="stat__value">${fmtKg(Math.round(b.e * 10) / 10)} kg</span></div>
        <div class="stat"><span class="stat__label">Best set</span><span class="stat__value">${fmtVol(bestSetVol)} kg</span></div>
      </div>`;
    } else if (ses.length) {
      stats = `<div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
        <div class="stat"><span class="stat__label">Times done</span><span class="stat__value">${ses.length}</span></div>
        <div class="stat"><span class="stat__label">Best</span><span class="stat__value">${ex.type === 'time' ? clock(Math.max(...ses.flatMap((s) => s.sets.map((st) => st.s || 0)))) : `${Math.max(...ses.flatMap((s) => s.sets.map((st) => st.r || 0)))} reps`}</span></div>
      </div>`;
    }
    const custom = G().custom.some((c) => c.id === ex.id);
    const visual = ex.img ? `<div class="ex-visual${isDrawn(ex) ? ' is-drawn' : ''}"><img src="${imgUrl(ex, 0)}" alt="${esc(ex.name)}: start position"><img class="ex-visual__end" src="${imgUrl(ex, 1)}" alt="${esc(ex.name)}: end position"></div>` : '';
    const muscles = info ? `<div class="ex-facts">
        ${info.p.length ? `<div><span>Primary</span>${esc(info.p.map(cap).join(', '))}</div>` : ''}
        ${info.s.length ? `<div><span>Secondary</span>${esc(info.s.map(cap).join(', '))}</div>` : ''}
        ${info.e ? `<div><span>Equipment</span>${esc(cap(info.e))}</div>` : ''}
        ${info.l ? `<div><span>Level</span>${esc(cap(info.l))}</div>` : ''}
      </div>` : '';
    const howto = info && info.x.length ? `<details class="ex-howto"><summary>How to do it</summary><ol>${info.x.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : '';
    $('#exSheetBody').innerHTML = `
      ${visual}
      <p class="eyebrow" style="margin-bottom:12px">${ex.group} · ${TYPES[ex.type] || ''}</p>
      ${muscles}
      ${howto}
      ${ses.length ? `${stats}
        ${ex.type === 'kg' ? `<div class="segmented segmented--full" role="group" aria-label="Chart" style="margin-bottom:10px">
          <button type="button" data-g="ex-chart" data-k="e1rm" aria-pressed="${exChart === 'e1rm'}">Est. 1RM</button>
          <button type="button" data-g="ex-chart" data-k="kg" aria-pressed="${exChart === 'kg'}">Heaviest</button>
          <button type="button" data-g="ex-chart" data-k="vol" aria-pressed="${exChart === 'vol'}">Volume</button>
        </div><div class="chart" id="exChart"></div>` : ''}
        <h3 class="section-title" style="margin:16px 0 8px">History</h3>
        ${[...ses].reverse().slice(0, 15).map((s) => `<div class="ex-hist">
          <div class="ex-hist__head"><span>${esc(DF_WEEKDAY.format(new Date(s.w.start)))}</span><span>${esc(s.w.name)}</span></div>
          ${s.sets.map((st, k) => `<div class="ex-hist__set"><span class="ex-hist__n">${TYPE_LABEL[st.t] || k + 1}</span>${esc(setText(ex, st))}${ex.type === 'kg' && isWork(st) && st.r ? `<span class="ex-hist__e">1RM ≈ ${fmtKg(Math.round(e1rm(st.w, st.r)))}</span>` : ''}</div>`).join('')}
        </div>`).join('')}`
        : '<p class="prose" style="margin-top:12px">You haven’t done this exercise yet. Once you tick it off in a workout, your records and a chart show up here.</p>'}
      ${custom ? `<button type="button" class="button button--danger" data-g="del-custom" style="margin-top:16px">Delete custom exercise</button>` : ''}`;
  }
  function drawExChart() {
    const el = $('#exChart');
    if (!el) return;
    const label = { e1rm: 'Estimated 1RM', kg: 'Heaviest weight', vol: 'Volume' }[exChart];
    const pts = exStats(exOpen).map((s) => {
      const b = bestOf(s.sets);
      const v = exChart === 'e1rm' ? Math.round(b.e * 10) / 10 : exChart === 'kg' ? b.kg : s.sets.reduce((a, st) => a + setVol(st), 0);
      return { date: dayOf(s.w.start), value: v };
    }).filter((p) => p.value > 0);
    lineChart(el, pts, { unit: 'kg', label, digits: exChart === 'vol' ? 0 : 1, height: 190 });
  }

  /* ---------------- Sheet: pick exercises ---------------- */
  const picker = $('#exPicker');
  const pk = { q: '', group: '', sel: [], onDone: null, form: false, shown: 60 };
  function openPicker(onDone) {
    Object.assign(pk, { q: '', group: '', sel: [], onDone, form: false, shown: 60 });
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
      ${thumbHTML(e)}
      <span class="pick__main"><span class="pick__name">${esc(e.name)}</span><span class="pick__sub">${e.group}</span></span>
      <span class="pick__n" aria-hidden="true">${on ? pk.sel.indexOf(e.id) + 1 : ''}</span></button>`;
  }
  function renderPickerList() {
    const all = filteredExercises(pk.q, pk.group);
    const list = all.slice(0, pk.shown);
    const recent = !pk.q && !pk.group ? recentIds().map(exById) : [];
    $('#pickList').innerHTML = (recent.length ? `<h3 class="section-title" style="margin:6px 0 8px">Recent</h3><div class="pick-list">${recent.map(pickRow).join('')}</div><h3 class="section-title" style="margin:16px 0 8px">All exercises · ${all.length}</h3>` : '')
      + (list.length ? `<div class="pick-list">${list.map(pickRow).join('')}</div>` : '<p class="hint" style="text-align:center;padding:20px 0">Nothing found. Create a custom exercise below.</p>')
      + (all.length > list.length ? `<button type="button" class="button" data-g="pick-more" style="margin-top:10px">Show more (${all.length - list.length})</button>` : '');
    $('#pickDone').textContent = pk.sel.length ? `Add (${pk.sel.length})` : 'Add';
  }
  function renderPicker() {
    $('#pickBody').innerHTML = pk.form ? customFormHTML() : `
      <input class="search" type="search" data-gin="pick-q" placeholder="Search exercises" value="${esc(pk.q)}" aria-label="Search exercises">
      ${chipsHTML(pk.group, 'pick-group')}
      <div id="pickList"></div>
      <button type="button" class="button" data-g="new-custom" style="margin-top:14px">+ Create custom exercise</button>`;
    if (!pk.form) renderPickerList();
    $('#pickDone').hidden = pk.form;
  }
  function customFormHTML() {
    return `<form id="customForm" novalidate>
      <label class="field"><span class="field__label">Name</span><input name="name" required autocomplete="off" placeholder="E.g. Incline Curl (Cable)" value="${esc(pk.q)}"></label>
      <label class="field"><span class="field__label">Muscle group</span><select class="select" name="group" style="width:100%">${GROUPS.map((g) => `<option ${g === (pk.group || 'Other') ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="field"><span class="field__label">Type</span><select class="select" name="type" style="width:100%">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <div class="button-row"><button type="button" class="button" data-g="custom-cancel">Back</button><button type="submit" class="button button--primary">Create</button></div>
    </form>`;
  }

  /* ---------------- Sheet: edit routine ---------------- */
  const routineSheet = $('#routineSheet');
  let draft = null;
  function openRoutine(id) {
    const r = id ? G().routines.find((x) => x.id === id) : null;
    draft = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', items: [], isNew: true };
    $('#routineTitle').textContent = r ? 'Edit routine' : 'New routine';
    renderRoutine();
    routineSheet.showModal();
  }
  function renderRoutine() {
    $('#routineBody').innerHTML = `
      <label class="field"><span class="field__label">Name</span><input data-gin="r-name" value="${esc(draft.name)}" placeholder="E.g. Push" autocomplete="off"></label>
      ${draft.items.length ? `<div class="list" style="margin-bottom:12px">${draft.items.map((it, i) => {
        const ex = exById(it.exId);
        return `<div class="r-item" data-i="${i}">
          <div class="r-item__main">${thumbHTML(ex)}<div><div class="list__title">${esc(ex.name)}</div><div class="list__sub">${ex.group} · rest ${restText(it.rest ?? 90)}</div></div></div>
          <div class="stepper" aria-label="Number of sets">
            <button type="button" data-g="r-minus" aria-label="Fewer sets">−</button><span>${it.n} sets</span><button type="button" data-g="r-plus" aria-label="More sets">+</button>
          </div>
          <div class="r-item__tools">
            <button type="button" data-g="r-up" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button>
            <button type="button" data-g="r-down" aria-label="Move down" ${i < draft.items.length - 1 ? '' : 'disabled'}>↓</button>
            <button type="button" data-g="r-del" aria-label="Remove ${esc(ex.name)}">×</button>
          </div>
        </div>`;
      }).join('')}</div>` : '<p class="hint">No exercises in this routine yet.</p>'}
      <button type="button" class="button" data-g="r-add">+ Add exercise</button>
      ${draft.isNew ? '' : '<button type="button" class="button button--danger" data-g="r-delete" style="margin-top:12px">Delete routine</button>'}`;
  }
  function saveRoutine() {
    const name = (draft.name || '').trim();
    if (!name) { toast('Give your routine a name'); routineSheet.querySelector('[data-gin="r-name"]')?.focus(); return; }
    if (!draft.items.length) { toast('Add at least one exercise'); return; }
    const { isNew, ...r } = { ...draft, name };
    const g = G();
    const i = g.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) g.routines[i] = r; else g.routines.push(r);
    saveNow();
    routineSheet.close();
    toast(isNew ? 'Routine created' : 'Routine saved');
    core.render();
  }

  /* ---------------- Sheet: view workout ---------------- */
  const workoutSheet = $('#workoutSheet');
  let wkOpen = null;
  function openWorkout(id, summary = false) {
    const w = G().workouts.find((x) => x.id === id);
    if (!w) return;
    wkOpen = id;
    $('#workoutTitle').textContent = summary ? 'Workout complete' : w.name;
    const prs = w.prs || [];
    $('#workoutBody').innerHTML = `
      ${summary ? `<div class="wk-done"><div class="wk-done__icon" aria-hidden="true">💪</div><h2>${esc(w.name)}</h2><p>Nice work! Your workout is saved.</p></div>` : ''}
      <p class="eyebrow" style="margin-bottom:10px">${esc(DF_WEEKDAY.format(new Date(w.start)))} · ${new Date(w.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <div class="stats" style="margin-bottom:14px">
        <div class="stat"><span class="stat__label">Duration</span><span class="stat__value">${w.end ? fmtDur(w.end - w.start) : '—'}</span></div>
        <div class="stat"><span class="stat__label">Volume</span><span class="stat__value">${fmtVol(itemsVol(w.items))} kg</span></div>
        <div class="stat"><span class="stat__label">Sets</span><span class="stat__value">${itemsSets(w.items)}</span></div>
      </div>
      ${prs.length ? `<div class="pr-box"><strong>🏆 ${plural(prs.length, 'new record', 'new records')}</strong>${prs.map((p) => `<span>${esc(exById(p.exId).name)}: ${prLabel(p)}</span>`).join('')}</div>` : ''}
      ${w.items.map((it) => {
        const ex = exById(it.exId);
        const pr = prs.find((p) => p.exId === it.exId);
        let n = 0;
        return `<div class="ex-hist"><div class="ex-hist__head"><button type="button" class="inline-link" data-g="ex-info" data-ex="${esc(ex.id)}">${esc(ex.name)}</button>${pr ? '<span>🏆</span>' : ''}</div>
          ${it.sets.map((st) => `<div class="ex-hist__set"><span class="ex-hist__n">${TYPE_LABEL[st.t] || ++n}</span>${esc(setText(ex, st))}</div>`).join('')}</div>`;
      }).join('')}
      ${w.note ? `<p class="prose" style="margin-top:12px">“${esc(w.note)}”</p>` : ''}
      <div class="button-row" style="margin-top:16px">
        <button type="button" class="button" data-g="redo">Do again</button>
        <button type="button" class="button" data-g="to-routine">Save as routine</button>
      </div>
      <button type="button" class="button button--danger" data-g="del-workout" style="margin-top:10px">Delete workout</button>`;
    if (!workoutSheet.open) workoutSheet.showModal();
  }

  /* ---------------- Hevy import ---------------- */
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
      ['Core', /crunch|plank| ab |abs|sit up|twist/],
      ['Cardio', /\bwalk|\brun(ning)?\b|treadmill|bike|cycl|elliptical|stair|cardio/],
      ['Legs', /calf|leg|squat|lunge|hip|glute|thrust|step up|romanian|straight leg|adduct|abduct/],
      ['Arms', /curl|tricep|bicep|skull|wrist|forearm|jm press|kickback|pushdown|hammer/],
      ['Shoulders', /shoulder|lateral|front raise|delt|reverse fly|overhead press|arnold|face pull|upright/],
      ['Back', /row|pull|lat |deadlift|shrug|back|kelso/],
      ['Chest', /bench|chest|fly|pec|push up|dip|crossover/],
    ];
    return (rules.find(([, re]) => re.test(t)) || ['Other'])[0];
  }
  async function importHevy(file) {
    try {
      await dbReady;
      const rows = parseCSV(await file.text());
      const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
      const col = (n) => head.indexOf(n);
      const C = { title: col('title'), start: col('start_time'), end: col('end_time'), desc: col('description'), ex: col('exercise_title'), type: col('set_type'), kg: col('weight_kg'), lbs: col('weight_lbs'), reps: col('reps'), dur: col('duration_seconds') };
      if (C.title < 0 || C.start < 0 || C.ex < 0) throw new Error('format');
      const g = G();
      const byName = new Map();
      for (const e of [...DBEX].reverse()) byName.set(norm(e.name), e.id);
      for (const e of [...LIB, ...g.custom]) byName.set(norm(e.name), e.id);
      const created = [];
      const map = new Map();
      for (const r of rows) {
        const start = parseHevyDate(r[C.start]);
        if (start == null || !r[C.ex]) continue;
        const key = r[C.title] + '|' + start;
        let wk = map.get(key);
        if (!wk) {
          const end = C.end >= 0 ? parseHevyDate(r[C.end]) : null;
          wk = { id: 'hevy-' + start, name: r[C.title] || 'Workout', start, end: end && end > start ? end : null, routineId: null, note: C.desc >= 0 ? r[C.desc] || '' : '', items: [], prs: [], src: 'hevy' };
          map.set(key, wk);
        }
        const title = r[C.ex].trim();
        let exId = byName.get(norm(title));
        if (!exId) {
          const c = { id: 'c-' + uid(), name: title, group: guessGroup(title), type: 'kg' };
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
      // Work out the type of new exercises from their sets
      for (const c of created) {
        const sets = [...map.values()].flatMap((w) => w.items.filter((i) => i.exId === c.id).flatMap((i) => i.sets));
        if (!sets.some((s) => s.w) && sets.some((s) => s.s)) c.type = 'time';
        else if (!sets.some((s) => s.w)) c.type = 'bw';
      }
      const fresh = [...map.values()].filter((w) => !g.workouts.some((x) => Math.abs(x.start - w.start) < 60000));
      if (!fresh.length) { g.custom = g.custom.filter((c) => !created.includes(c)); toast(map.size ? 'All of these workouts are already here' : 'No workouts found in this file'); return; }
      if (!confirm(`Import ${plural(fresh.length, 'workout', 'workouts')} from Hevy${created.length ? ` (${plural(created.length, 'new custom exercise', 'new custom exercises')})` : ''}?`)) { g.custom = g.custom.filter((c) => !created.includes(c)); return; }
      core.snapshot('restore');
      g.workouts.push(...fresh.sort((a, b) => a.start - b.start));
      // Work out records afterwards, in order
      for (const w of [...g.workouts].sort((a, b) => a.start - b.start)) if (fresh.includes(w)) w.prs = computePRs(w);
      saveNow();
      toast(`${plural(fresh.length, 'workout', 'workouts')} imported`);
      core.go('gymHistory');
    } catch {
      toast('This doesn’t look like a Hevy export (CSV)');
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
          if (st.w == null) st.w = src.w ?? null;
        }
        const ok = ex.type === 'time' ? st.s > 0 : ex.type === 'bw' ? st.r > 0 : st.r > 0 && st.w != null;
        if (!ok) { toast(ex.type === 'time' ? 'Enter the time' : ex.type === 'bw' ? 'Enter your reps' : 'Enter weight and reps'); b.closest('.set-row').querySelector('input')?.focus(); return; }
        st.d = true;
        startRest(it.rest ?? 90);
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
      case 'add-set': { a.items[cardOf(b)].sets.push({}); saveSoon(); core.render(); return; }
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
        if (!confirm(`Remove ${exById(a.items[i].exId).name} from this workout?`)) return;
        a.items.splice(i, 1); openMenus.clear(); saveNow(); core.render();
        return;
      }
      case 'ex-info': return openExercise(b.dataset.ex);
      case 'finish': return finishWorkout();
      case 'cancel':
        if (!confirm('Discard this workout? Nothing you entered will be saved.')) return;
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
        saveNow(); workoutSheet.close(); toast(`Routine “${w.name}” created`); core.go('gym');
        return;
      }
      case 'del-workout': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        if (!confirm(`Delete workout “${w.name}” from ${fmtDate(dayOf(w.start))}?`)) return;
        g.workouts = g.workouts.filter((x) => x !== w);
        saveNow(); workoutSheet.close(); toast('Workout deleted'); core.render();
        return;
      }
      case 'ex-chart': exChart = b.dataset.k; renderExerciseSheet(); drawExChart(); return;
      case 'del-custom': {
        const used = g.workouts.some((w) => w.items.some((it) => it.exId === exOpen)) || g.routines.some((r) => r.items.some((it) => it.exId === exOpen)) || a?.items.some((it) => it.exId === exOpen);
        if (used) { toast('This exercise is still used in workouts or routines'); return; }
        if (!confirm('Delete this custom exercise?')) return;
        g.custom = g.custom.filter((c) => c.id !== exOpen);
        saveNow(); exSheet.close(); core.render();
        return;
      }
      case 'ex-group': exUi.group = b.dataset.group; exUi.shown = 60; return renderExercises();
      case 'ex-more': exUi.shown += 100; $('#exList').innerHTML = exListItems(); return;
      case 'pick-group': pk.group = b.dataset.group; pk.shown = 60; return renderPicker();
      case 'pick-more': pk.shown += 100; return renderPickerList();
      case 'pick': {
        const id = b.dataset.ex;
        pk.sel = pk.sel.includes(id) ? pk.sel.filter((x) => x !== id) : [...pk.sel, id];
        return renderPickerList();
      }
      case 'pick-done': {
        if (!pk.sel.length) { toast('Pick at least one exercise'); return; }
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
        if (!confirm(`Delete routine “${draft.name}”? Your finished workouts stay saved.`)) return;
        g.routines = g.routines.filter((r) => r.id !== draft.id);
        saveNow(); routineSheet.close(); toast('Routine deleted'); core.render();
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
    else if (k === 'ex-q') { exUi.q = t.value; exUi.shown = 60; $('#exList').innerHTML = exListItems(); }
    else if (k === 'pick-q') { pk.q = t.value; pk.shown = 60; renderPickerList(); }
    else if (k === 'r-name') draft.name = t.value;
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    const a = act();
    if (t.id === 'hevyFile' && t.files[0]) { importHevy(t.files[0]); t.value = ''; return; }
    if (t.dataset?.gin === 't' && a) {
      const p = rowOf(t); if (!p) return;
      const it = a.items[p.i];
      if (t.value === 'x') { if (it.sets.length === 1) { toast('An exercise needs at least one set'); core.render(); return; } it.sets.splice(p.j, 1); }
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
    if (exAll().some((e) => norm(e.name) === norm(name))) { toast('That exercise already exists'); return; }
    const c = { id: 'c-' + uid(), name, group: f.group.value, type: f.type.value };
    G().custom.push(c);
    saveNow();
    toast('Exercise created');
    if (pk.onDone) { pk.form = false; pk.sel = [...pk.sel, c.id]; pk.q = ''; renderPicker(); }
    else { picker.close(); core.render(); }
  });

  // Close via the backdrop or [data-close]
  for (const dlg of [picker, routineSheet, workoutSheet, exSheet]) {
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close();
    });
  }
  $('#pickDone').dataset.g = 'pick-done';
  $('#routineSave').dataset.g = 'r-save';
  workoutSheet.addEventListener('close', () => { if (ui.view === 'gymHistory' || ui.view === 'gym') core.render(); });

  tick();

  return {
    views: { gym: renderGym, gymHistory: renderHistory, gymEx: renderExercises },
    titles: { gym: 'Workout', gymHistory: 'History', gymEx: 'Exercises' },
    afterRender() { tick(); },
    importHevy,
  };
};
