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
    L('wristcurl-behind2', 'Behind the Back Wrist Curl (Barbell)', 'Arms', 'Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl'),
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
      const g0 = G();
      const usedIds = new Set([...g0.workouts, ...g0.routines, ...(g0.active ? [g0.active] : [])].flatMap((w) => (w.items || []).map((it) => it.exId)));
      for (const o of list) {
        dbInfo.set(o.i, o);
        if (libImgs.has(o.i) || libNames.has(norm(o.n))) continue;
        // Hidden (stretches, drills, extra cardio) unless you already used it somewhere
        if (o.h && !usedIds.has('db:' + o.i)) continue;
        DBEX.push({ id: 'db:' + o.i, name: o.n, group: o.g, type: o.t, img: o.i });
      }
      migrateCustoms();
      if (['gym', 'gymHistory', 'gymEx'].includes(ui.view)) core.render();
    })
    .catch(() => {});

  const exAll = () => [...LIB, ...G().custom, ...DBEX];
  const exById = (id) => exAll().find((e) => e.id === id) || { id, name: id.startsWith('db:') ? id.slice(3).replace(/_/g, ' ') : 'Unknown exercise', group: 'Other', type: 'kg' };

  // Earlier Hevy imports created custom exercises that now exist in the library: link them up.
  // Own exercise names from Hevy (typos and nicknames) → the matching exercise in the library.
  const ALIASES = {
    'Cable Preacjer Curl': 'preacher-c',
    'preacher hammer Curl': 'db:Preacher_Hammer_Dumbbell_Curl',
    'Peacher Hammer Dumbbell': 'db:Preacher_Hammer_Dumbbell_Curl',
    'Forearm Curls': 'wristcurl',
    'Behind The Back Forearm': 'wristcurl-behind',
    'Seated Dip Machine': 'db:Dip_Machine',
    'single arm bench row': 'row-db',
    'Romanian deadlift smith machine': 'db:Smith_Machine_Stiff-Legged_Deadlift',
  };
  // Own exercises that stay custom, but with a tidier name.
  const RENAME = { 'Jm Press Op Chest Press': 'JM Press (Chest Press Machine)' };
  const niceName = (t) => RENAME[t] || Object.entries(RENAME).find(([k]) => norm(k) === norm(t))?.[1] || t;
  const aliasMap = () => new Map(Object.entries(ALIASES).map(([k, v]) => [norm(k), v]));

  function migrateCustoms() {
    const g = G();
    const byName = new Map(LIB.map((e) => [norm(e.name), e.id]));
    for (const [k, v] of aliasMap()) byName.set(k, v);
    const remap = new Map();
    let renamed = false;
    for (const c of g.custom) {
      const id = byName.get(norm(c.name));
      if (id) remap.set(c.id, id);
      else if (niceName(c.name) !== c.name) { c.name = niceName(c.name); renamed = true; }
    }
    if (!remap.size) { if (renamed) core.save(); return; }
    const fix = (items) => items && items.forEach((it) => { if (remap.has(it.exId)) it.exId = remap.get(it.exId); });
    g.workouts.forEach((w) => { fix(w.items); fix(w.prs); });
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
    if (isDrawn(ex)) { const v = (dbInfo.get(ex.img) || {}).dv; return `drawings/${ex.img}/${frame}.svg${v ? `?v=${v}` : ''}`; }
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
  // Best weight / 1RM for an exercise over all finished workouts (for live records during a workout).
  function histBest(exId) {
    let had = false; const all = [];
    for (const w of G().workouts) for (const x of w.items) if (x.exId === exId) { had = true; all.push(...x.sets); }
    return { had, ...bestOf(all) };
  }
  const isRecordSet = (st, hb) => hb.had && isWork(st) && st.w > 0 && st.r > 0 && (st.w > hb.kg + 1e-9 || e1rm(st.w, st.r) > hb.e + 1e-9);
  function recomputeAllPRs() { for (const w of [...G().workouts].sort((a, b) => a.start - b.start)) w.prs = computePRs(w); }
  const prLabel = (p) => (p.kind === 'kg' ? `heaviest weight ${fmtKg(p.value)} kg` : `best estimated 1RM ${fmtKg(p.value)} kg`);

  /* ---------------- Saving ---------------- */
  let saveTimer;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => core.save(), 400); };
  const saveNow = () => { clearTimeout(saveTimer); core.save(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G().active) saveNow(); });
  window.addEventListener('pagehide', () => { if (G().active) saveNow(); });

  /* ---------------- Start / finish a workout ---------------- */
  const blankSets = (n, types) => (types ? types.map((t) => (t ? { t } : {})) : Array.from({ length: Math.max(1, n || 3) }, () => ({})));
  // Planned sets of a routine item: [{ t, w, r, s }]. Older routines only had a count (n) and types.
  const routineSets = (it) => (Array.isArray(it.sets) && it.sets.length ? it.sets : blankSets(it.n, it.types).map((x) => ({ t: x.t || '' })));
  const cleanSet = (x) => { const o = {}; if (x.t) o.t = x.t; for (const k of ['w', 'r', 's']) if (x[k] != null && x[k] !== '') o[k] = x[k]; return o; };

  async function startWorkout({ name = 'Workout', items = [], routineId = null } = {}) {
    const g = G();
    if (g.active && !await core.ask('A workout is already running. Discard it and start a new one?', 'Discard')) return;
    g.active = {
      id: uid(), name, start: Date.now(), routineId, note: '',
      // Planned values (pw/pr/ps) show as hints and are used when you tick a set without typing.
      items: items.map((it) => ({ exId: it.exId, rest: it.rest ?? 90, sets: routineSets(it).map((x) => ({ ...(x.t ? { t: x.t } : {}), pw: x.w ?? null, pr: x.r ?? null, ps: x.s ?? null })) })),
    };
    saveNow();
    ensureAudio();
    core.go('gym');
  }

  async function finishWorkout() {
    const g = G();
    const a = g.active;
    if (!a) return;
    const done = a.items.reduce((n, it) => n + it.sets.filter((st) => st.d).length, 0);
    if (!done) {
      if (await core.ask('You haven’t ticked off any sets yet. Discard this workout?', 'Discard')) { g.active = null; saveNow(); core.render(); }
      return;
    }
    const open = a.items.reduce((n, it) => n + it.sets.filter((st) => !st.d).length, 0);
    if (open && !await core.ask(`${plural(open, 'set isn’t', 'sets aren’t')} ticked off and won’t be saved. Finish the workout?`, 'Finish')) return;
    const wk = {
      id: a.id, name: (a.name || 'Workout').trim() || 'Workout', start: a.start, end: Date.now(), routineId: a.routineId || null, note: a.note || '',
      items: a.items.map((it) => {
        const note = (g.exNotes || {})[it.exId];
        return { exId: it.exId, ...(note ? { note } : {}), sets: it.sets.filter((st) => st.d).map(({ d, pw, pr, ps, run, ...st }) => st) };
      }).filter((it) => it.sets.length),
    };
    wk.prs = computePRs(wk);
    g.workouts.push(wk);
    const updated = updateRoutineFrom(a);
    g.active = null;
    saveNow();
    core.render();
    openWorkout(wk.id, true);
    if (updated) toast(`${updated} updated with today’s weights and reps`);
  }

  // The routine always takes over the values of its last session: each ticked set replaces the planned set
  // at the same position (extra sets are added). Sets you didn't tick keep their planned values.
  function updateRoutineFrom(a) {
    const r = a.routineId && G().routines.find((x) => x.id === a.routineId);
    if (!r) return null;
    let changed = false;
    const used = new Set();
    for (const it of a.items) {
      const k = r.items.findIndex((x, i) => x.exId === it.exId && !used.has(i));
      if (k < 0) continue;
      used.add(k);
      const ri = r.items[k];
      const planned = routineSets(ri).map((x) => ({ ...x }));
      it.sets.forEach((st, j) => {
        if (!st.d) return;
        const next = cleanSet({ t: st.t || '', w: st.w, r: st.r, s: st.s });
        if (j < planned.length) planned[j] = next; else planned.push(next);
      });
      ri.sets = planned.map(cleanSet);
      delete ri.n; delete ri.types;
      ri.rest = it.rest ?? ri.rest;
      changed = true;
    }
    return changed ? r.name : null;
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

  /* ---------------- Keep the screen on during a workout ---------------- */
  // Screen Wake Lock: the iPhone doesn't go to sleep while a workout runs, so the rest timer stays visible.
  // The lock is dropped automatically when the app goes to the background and re-taken when it comes back.
  let wakeLock = null, wakePending = false, wakeRetry = 0;
  async function syncWakeLock() {
    const want = !!G().active && document.visibilityState === 'visible';
    if (!('wakeLock' in navigator)) return;
    if (want && !wakeLock && !wakePending && Date.now() >= wakeRetry) {
      wakePending = true;
      try {
        // Never wait forever: some browsers leave the request hanging while the page is in the background.
        const lock = await Promise.race([navigator.wakeLock.request('screen'), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
        if (G().active && document.visibilityState === 'visible') wakeLock = lock; else lock.release().catch(() => {});
      } catch { wakeRetry = Date.now() + 15000; /* not allowed right now (e.g. low power mode): try again later */ }
      wakePending = false;
    } else if (!want && wakeLock) {
      try { await wakeLock.release(); } catch { /* ok */ }
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', syncWakeLock);

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
    if (a) a.items.forEach((it, i) => it.sets.forEach((st, j) => {
      if (!st.run) return;
      const inp = document.querySelector(`.set-row[data-i="${i}"][data-j="${j}"] [data-gin="s"]`);
      if (inp) inp.value = clock(runSecs(st));
    }));
    if (!plateBtn.hidden && document.activeElement !== plateInput) { plateInput = null; renderPlates(); }
    if (!!a !== !!wakeLock && !wakePending) syncWakeLock();
  }
  setInterval(tick, 250);

  /* ---------------- Drag to reorder ---------------- */
  // Hold the grip (≡) of an item and drag it; other items slide aside. Auto-scrolls near the edges.
  function makeSortable(list, onMove) {
    list.addEventListener('pointerdown', (ev) => {
      const h = ev.target.closest('.drag-handle');
      if (!h || !list.contains(h)) return;
      const item = h.closest('[data-sort]');
      if (!item) return;
      ev.preventDefault();
      const items = [...list.querySelectorAll(':scope > [data-sort]')];
      const from = items.indexOf(item);
      const rects = items.map((el) => el.getBoundingClientRect());
      const scroller = list.closest('.sheet__body') || document.scrollingElement;
      const startScroll = scroller.scrollTop, startY = ev.clientY;
      const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
      const step = rects[from].height + gap;
      let lastY = ev.clientY, to = from, raf = 0, done = false;
      item.classList.add('is-dragging');
      list.classList.add('is-sorting');
      try { h.setPointerCapture(ev.pointerId); } catch { /* ok */ }
      navigator.vibrate?.(8);
      const update = () => {
        const dy = lastY - startY + (scroller.scrollTop - startScroll);
        item.style.transform = `translateY(${dy}px)`;
        const center = rects[from].top + rects[from].height / 2 + dy;
        to = from;
        rects.forEach((r, i) => {
          const mid = r.top + r.height / 2;
          if (i < from && center < mid && i < to) to = i;
          if (i > from && center > mid) to = i;
        });
        items.forEach((el, i) => {
          if (el === item) return;
          const shift = from < to && i > from && i <= to ? -step : to < from && i >= to && i < from ? step : 0;
          el.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const loop = () => {
        if (done) return;
        const box = scroller === document.scrollingElement ? { top: 0, bottom: innerHeight - 140 } : scroller.getBoundingClientRect();
        const edge = 70;
        const v = lastY < box.top + edge ? -(box.top + edge - lastY) / 5 : lastY > box.bottom - edge ? (lastY - (box.bottom - edge)) / 5 : 0;
        if (v) { scroller.scrollTop += v; update(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const move = (e) => { lastY = e.clientY; update(); };
      const end = () => {
        done = true; cancelAnimationFrame(raf);
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end);
        items.forEach((el) => { el.style.transform = ''; });
        item.classList.remove('is-dragging'); list.classList.remove('is-sorting');
        if (to !== from) onMove(from, to);
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    });
  }
  const GRIP_HTML = '<button type="button" class="drag-handle" aria-label="Drag to reorder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg></button>';
  const moveItem = (arr, from, to) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); };

  /* ---------------- View: Workout ---------------- */
  const TYPE_LABEL = { w: 'W', d: 'D', f: 'F' };
  const REST_OPTS = [0, 30, 60, 90, 120, 150, 180, 240, 300];
  const restText = (s) => (!s ? 'Off' : s < 60 ? `${s}s` : s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60} min`);
  const openMenus = new Set();

  function sourceFor(it, j, prev) {
    const st = it.sets[j];
    if (st && (st.pw != null || st.pr != null || st.ps != null)) return { w: st.pw, r: st.pr, s: st.ps };
    return prev[j] || (j > 0 ? it.sets[j - 1] : null);
  }
  const minutes = (s) => (s == null ? '' : fmt(s / 60, s % 60 ? 1 : 0));
  const parseTime = (v) => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    if (t.includes(':')) { const [m, sec] = t.split(':').map((x) => parseNum(x) || 0); return Math.round(m * 60 + sec); }
    const n = parseNum(t);
    return Number.isNaN(n) ? NaN : Math.round(n * 60);
  };
  const runSecs = (st) => (st.run ? Math.max(0, Math.round((Date.now() - st.run) / 1000)) : st.s || 0);

  function exCardHTML(it, i) {
    const ex = exById(it.exId);
    const prev = prevSets(it.exId);
    const hb = ex.type === 'kg' ? histBest(it.exId) : { had: false };
    const note = (G().exNotes || {})[it.exId] || '';
    let n = 0;
    const head = ex.type === 'time'
      ? '<span>Set</span><span>Previous</span><span class="set-head--wide">Time</span><span></span><span></span>'
      : `<span>Set</span><span>Previous</span><span>${ex.type === 'bw' ? '+kg' : 'kg'}</span><span>Reps</span><span></span>`;
    const rows = it.sets.map((st, j) => {
      const label = TYPE_LABEL[st.t] || String(++n);
      const p = prev[j];
      const src = sourceFor(it, j, prev);
      const inputs = ex.type === 'time'
        ? `<input class="set-in set-in--wide" data-gin="s" inputmode="decimal" enterkeyhint="done" placeholder="${src && src.s ? clock(src.s) : '0:00'}" value="${st.run || st.s != null ? clock(runSecs(st)) : ''}" aria-label="Time, set ${j + 1} (minutes, or m:ss)" ${st.run ? 'readonly' : ''}>
           <button type="button" class="set-timer${st.run ? ' is-running' : ''}" data-g="sw" aria-label="${st.run ? 'Stop' : 'Start'} stopwatch, set ${j + 1}">${st.run
             ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
             : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'}</button>`
        : `<input class="set-in" data-gin="w" inputmode="decimal" enterkeyhint="next" placeholder="${src && src.w != null ? fmtKg(src.w) : ex.type === 'bw' ? '0' : 'kg'}" value="${fmtKg(st.w)}" aria-label="Kilograms, set ${j + 1}">
           <input class="set-in" data-gin="r" inputmode="numeric" enterkeyhint="done" placeholder="${src && src.r != null ? src.r : 'reps'}" value="${st.r ?? ''}" aria-label="Reps, set ${j + 1}">`;
      const rec = st.d && isRecordSet(st, hb);
      return `<div class="set-row${st.d ? ' is-done' : ''}${rec ? ' is-pr' : ''}${ex.type === 'time' ? ' set-row--time' : ''}" data-i="${i}" data-j="${j}">
        <label class="set-type set-type--${st.t || 'n'}"><span>${rec ? '🏆' : label}</span>
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
        <button type="button" class="button button--danger" data-g="ex-del">Remove exercise</button>
      </div>` : '';
    return `<div class="card ex-card" data-i="${i}">
      <div class="ex-card__head">
        ${thumbHTML(ex)}
        <button type="button" class="ex-card__name" data-g="ex-info" data-ex="${esc(ex.id)}">${esc(ex.name)}</button>
        <span class="ex-card__rest">${it.rest ? `⏱ ${restText(it.rest)}` : ''}</span>
        <button type="button" class="ex-card__more" data-g="ex-menu" aria-expanded="${openMenus.has(i)}" aria-label="Options for ${esc(ex.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>
      </div>
      ${menu}
      <textarea class="ex-note" data-gin="ex-note" rows="1" placeholder="Add a note (seat setting, grip, …)" aria-label="Note for ${esc(ex.name)}">${esc(note)}</textarea>
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
      ${a.items.length > 1 ? '<button type="button" class="button" data-g="reorder">⇅ Reorder exercises</button>' : ''}
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
      ${g.routines.length ? `<div class="routine-list" id="routineCards">${g.routines.map((r) => {
        const ld = lastDone(r.id);
        const names = r.items.map((it) => exById(it.exId).name);
        return `<div class="card routine" data-sort data-g="open-routine" data-id="${r.id}" role="button" tabindex="0">
          ${GRIP_HTML}
          <div class="routine__main">
            <h3 class="routine__name">${esc(r.name)}</h3>
            <p class="routine__sub">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ` +${names.length - 4}` : ''}</p>
            <p class="routine__meta">${plural(r.items.length, 'exercise', 'exercises')}${ld ? ` · last ${fmtShort(dayOf(ld.start))}` : ''}</p>
          </div>
          ${chev}
        </div>`;
      }).join('')}</div>` : '<div class="card"><p class="prose">Create a routine for your regular workouts, like Push, Pull and Legs. Then you start them with one tap, with your previous weights alongside.</p></div>'}
      <div class="card">
        <h2 class="card__title" style="margin-bottom:6px">Coming from Hevy?</h2>
        <p class="prose" style="margin-bottom:12px">Import your workouts (CSV export from Hevy) and your routines (JSON from the Hevy API, Pro). Duplicates are skipped or updated.</p>
        <div class="button-row">
          <button type="button" class="button" data-g="hevy">Workouts (CSV)</button>
          <button type="button" class="button" data-g="hevy-routines">Routines (JSON)</button>
        </div>
        <input type="file" id="hevyFile" accept=".csv,text/csv" hidden>
        <input type="file" id="hevyRoutineFile" accept=".json,application/json" multiple hidden>
      </div>`;
  }

  function renderGym() {
    const el = viewEl('gym');
    if (G().active) {
      renderActive(el);
      requestAnimationFrame(() => el.querySelectorAll('.ex-note').forEach((t) => { if (t.value) t.style.height = t.scrollHeight + 'px'; }));
    } else renderStart(el);
    const cards = $('#routineCards');
    if (cards) makeSortable(cards, (from, to) => { moveItem(G().routines, from, to); saveNow(); core.render(); });
  }

  /* ---------------- View: History ---------------- */
  /* Streak: consecutive weeks (Mon–Sun) with at least one workout. This week still counts as "in progress". */
  function streaks(h) {
    const weeks = new Set(h.map((w) => weekStart(dayOf(w.start))));
    let wk = weekStart(todayISO());
    if (!weeks.has(wk)) wk = addDays(wk, -7);
    let cur = 0;
    while (weeks.has(wk)) { cur++; wk = addDays(wk, -7); }
    const sorted = [...weeks].sort();
    let best = 0, run = 0, prev = null;
    for (const w of sorted) { run = prev && addDays(prev, 7) === w ? run + 1 : 1; best = Math.max(best, run); prev = w; }
    return { cur, best };
  }

  const histUi = { month: null, week: null };
  const MF_LONG = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  function calendarHTML(h) {
    const today = todayISO();
    const month = histUi.month || today.slice(0, 7);
    const first = month + '-01';
    const byDay = new Map();
    for (const w of h) { const d = dayOf(w.start); if (d.startsWith(month)) (byDay.get(d) || byDay.set(d, []).get(d)).push(w); }
    const start = weekStart(first);
    const nextMonth = toISO(new Date(+month.slice(0, 4), +month.slice(5, 7), 1));
    const cells = [];
    for (let d = start; d < nextMonth || cells.length % 7; d = addDays(d, 1)) cells.push(d);
    const prevM = toISO(new Date(+month.slice(0, 4), +month.slice(5, 7) - 2, 1)).slice(0, 7);
    const nextM = nextMonth.slice(0, 7);
    const days = [...byDay.keys()].length;
    return `<div class="card cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" data-g="cal-month" data-m="${prevM}" aria-label="Previous month">‹</button>
        <div class="cal__title">${MF_LONG.format(new Date(first + 'T12:00:00'))}<small>${plural(days, 'training day', 'training days')}</small></div>
        <button type="button" class="cal__nav" data-g="cal-month" data-m="${nextM}" aria-label="Next month" ${nextM > today.slice(0, 7) ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal__grid">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="cal__dow">${x}</span>`).join('')}
        ${cells.map((d) => {
          const ws = byDay.get(d);
          const out = !d.startsWith(month);
          const cls = ['cal__day', out ? 'is-out' : '', ws ? 'has-wk' : '', d === today ? 'is-today' : ''].filter(Boolean).join(' ');
          return ws && !out
            ? `<button type="button" class="${cls}" data-g="open-workout" data-id="${ws[0].id}" aria-label="${esc(ws.map((w) => w.name).join(', '))}, ${fmtDate(d)}">${+d.slice(8)}${ws.length > 1 ? '<i></i>' : ''}</button>`
            : `<span class="${cls}">${+d.slice(8)}</span>`;
        }).join('')}
      </div>
    </div>`;
  }

  /* Sets per muscle for one week (work sets only; an exercise counts for each of its primary muscles). */
  function muscleWeekHTML(h) {
    const thisWeek = weekStart(todayISO());
    const wk = histUi.week || thisWeek;
    const end = addDays(wk, 7);
    const count = new Map();
    let total = 0;
    for (const w of h) {
      const d = dayOf(w.start);
      if (d < wk || d >= end) continue;
      for (const it of w.items) {
        const n = it.sets.filter(isWork).length;
        if (!n) continue;
        total += n;
        for (const m of new Set(musclesOf(exById(it.exId)))) count.set(m, (count.get(m) || 0) + n);
      }
    }
    const rows = MUSCLES.map(([k, l]) => [l, count.get(k) || 0]).filter(([, c]) => c).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map(([, c]) => c));
    const label = wk === thisWeek ? 'This week' : wk === addDays(thisWeek, -7) ? 'Last week' : `Week of ${fmtShort(wk)}`;
    return `<div class="card musc">
      <div class="cal__head">
        <button type="button" class="cal__nav" data-g="musc-week" data-w="${addDays(wk, -7)}" aria-label="Previous week">‹</button>
        <div class="cal__title">Sets per muscle<small>${label} · ${plural(total, 'set', 'sets')}</small></div>
        <button type="button" class="cal__nav" data-g="musc-week" data-w="${addDays(wk, 7)}" aria-label="Next week" ${wk >= thisWeek ? 'disabled' : ''}>›</button>
      </div>
      ${rows.length ? `<div class="musc__rows">${rows.map(([l, c]) => `<div class="musc__row"><span class="musc__name">${l}</span><span class="musc__bar"><i style="width:${(c / max) * 100}%"></i></span><span class="musc__n">${c}</span></div>`).join('')}</div>`
        : '<p class="hint" style="margin:6px 0 2px">No workouts this week.</p>'}
      <p class="hint" style="margin:10px 0 0">Warm-up sets don’t count. Most lifters aim for about 10–20 sets per muscle per week.</p>
    </div>`;
  }

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
    const MF = MF_LONG;
    const st = streaks(h);
    void month;
    el.innerHTML = `
      <div class="card">
        <div class="stats">
          <div class="stat"><span class="stat__label">Streak</span><span class="stat__value">🔥 ${plural(st.cur, 'week', 'weeks')}</span></div>
          <div class="stat"><span class="stat__label">This week</span><span class="stat__value">${counts[7]}</span></div>
          <div class="stat"><span class="stat__label">Total</span><span class="stat__value">${h.length}</span></div>
        </div>
        ${st.best > st.cur ? `<p class="hint" style="margin:8px 2px 0">Best streak: ${plural(st.best, 'week', 'weeks')} in a row.</p>` : st.cur > 1 ? '<p class="hint" style="margin:8px 2px 0">This is your best streak so far. 💪</p>' : ''}
        <div class="weekbars" role="img" aria-label="Workouts per week, last 8 weeks: ${counts.join(', ')}">
          ${counts.map((c, i) => `<div class="weekbars__col"><span class="weekbars__n">${c || ''}</span><span class="weekbars__bar${i === 7 ? ' is-now' : ''}" style="height:${Math.max(3, (c / max) * 64)}px"></span><span class="weekbars__lbl">${i === 7 ? 'now' : fmtShort(weeks[i])}</span></div>`).join('')}
        </div>
      </div>
      ${calendarHTML(h)}
      ${muscleWeekHTML(h)}
      ${Object.entries(byMonth).map(([m, list]) => `
        <h2 class="section-title">${MF.format(new Date(m + '-15T12:00:00'))} · ${list.length}</h2>
        <div class="list">${list.map((w) => `<button class="list__item" data-g="open-workout" data-id="${w.id}">
          <div class="list__main"><div class="list__title">${esc(w.name)}${w.prs && w.prs.length ? ` <span class="pr-chip">🏆 ${w.prs.length}</span>` : ''}</div>
            <div class="list__sub">${esc(DF_WEEKDAY.format(new Date(w.start)))} · ${w.end ? fmtDur(w.end - w.start) : ''} · ${fmtVol(itemsVol(w.items))} kg</div></div>
          <div class="list__end">${itemsSets(w.items)}<small>sets</small></div>${chev}
        </button>`).join('')}</div>`).join('')}`;
  }

  /* ---------------- View: Exercises ---------------- */
  const exUi = { q: '', group: '', shown: 60, eq: new Set(), mu: new Set(), open: null };

  // Equipment and muscles per exercise: from the name (Hevy-style "(Barbell)") or the database, else from the muscle group.
  const EQUIP = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Smith machine', 'EZ bar', 'Plate', 'Bodyweight', 'Cardio machine', 'Other'];
  const DB_EQ = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', 'e-z curl bar': 'EZ bar', 'body only': 'Bodyweight' };
  function equipOf(ex) {
    const n = ex.name.toLowerCase();
    if (ex.group === 'Cardio') return 'Cardio machine';
    if (/smith/.test(n)) return 'Smith machine';
    if (/\bez\b|e-z/.test(n)) return 'EZ bar';
    if (/barbell|\(bar\)|deadlift \(|squat \(barbell|t bar/.test(n)) return 'Barbell';
    if (/dumbbell/.test(n)) return 'Dumbbell';
    if (/cable|pushdown|crossover|face pull|pulldown|rope/.test(n)) return 'Cable';
    if (/machine|pec deck|leg press|hack squat|leg extension|leg curl|calf raise|abduction|adduction|lever/.test(n)) return 'Machine';
    if (/plate/.test(n)) return 'Plate';
    const info = infoOf(ex);
    if (info && DB_EQ[info.e]) return DB_EQ[info.e];
    if (ex.type === 'bw') return 'Bodyweight';
    return 'Other';
  }
  const MUSCLES = [['chest', 'Chest'], ['shoulders', 'Shoulders'], ['lats', 'Lats'], ['middle back', 'Upper back'], ['lower back', 'Lower back'], ['traps', 'Traps'],
    ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Forearms'], ['abdominals', 'Abs'], ['quadriceps', 'Quads'], ['hamstrings', 'Hamstrings'],
    ['glutes', 'Glutes'], ['calves', 'Calves'], ['adductors', 'Adductors'], ['abductors', 'Abductors'], ['neck', 'Neck'], ['cardio', 'Cardio']];
  function musclesOf(ex) {
    const info = infoOf(ex);
    if (info && info.p && info.p.length) return info.p;
    const n = ex.name.toLowerCase();
    switch (ex.group) {
      case 'Chest': return ['chest'];
      case 'Back': return /shrug|kelso/.test(n) ? ['traps'] : /extension|hyperext/.test(n) ? ['lower back'] : /row/.test(n) ? ['middle back'] : ['lats'];
      case 'Shoulders': return ['shoulders'];
      case 'Arms': return /wrist|forearm|reverse curl/.test(n) ? ['forearms'] : /curl/.test(n) ? ['biceps'] : ['triceps'];
      case 'Legs': return /calf/.test(n) ? ['calves'] : /adduct/.test(n) ? ['adductors'] : /abduct/.test(n) ? ['abductors'] : /thrust|glute|kickback/.test(n) ? ['glutes'] : /leg curl|romanian|deadlift|stiff/.test(n) ? ['hamstrings'] : ['quadriceps'];
      case 'Core': return ['abdominals'];
      case 'Cardio': return ['cardio'];
      default: return [];
    }
  }
  const matchFilters = (st) => (e) => (!st.eq.size || st.eq.has(equipOf(e))) && (!st.mu.size || musclesOf(e).some((m) => st.mu.has(m)));
  function exFiltered(st = exUi) { return filteredExercises(st.q, '').filter(matchFilters(st)); }
  function filtersHTML(st = exUi, scope = 'ex') {
    const all = exAll();
    const eqCount = new Map(), muCount = new Map();
    for (const e of all) {
      eqCount.set(equipOf(e), (eqCount.get(equipOf(e)) || 0) + 1);
      for (const m of new Set(musclesOf(e))) muCount.set(m, (muCount.get(m) || 0) + 1);
    }
    const btn = (f, label, set) => `<button type="button" class="filter-btn${set.size ? ' is-active' : ''}" data-g="f-toggle" data-scope="${scope}" data-f="${f}" aria-expanded="${st.open === f}">
        ${label}${set.size ? ` <span class="filter-btn__n">${set.size}</span>` : ''}<svg viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1.5 5 5 5-5"/></svg></button>`;
    const opts = st.open === 'eq'
      ? EQUIP.filter((k) => eqCount.get(k)).map((k) => [k, k, eqCount.get(k)])
      : st.open === 'mu' ? MUSCLES.filter(([k]) => muCount.get(k)).map(([k, l]) => [k, l, muCount.get(k)]) : [];
    const set = st.open === 'eq' ? st.eq : st.mu;
    return `<div class="filters">
        ${btn('eq', 'Equipment', st.eq)}${btn('mu', 'Muscles', st.mu)}
        ${st.eq.size || st.mu.size ? `<button type="button" class="inline-link filters__clear" data-g="f-clear" data-scope="${scope}">Clear</button>` : ''}
      </div>
      ${st.open ? `<div class="filter-panel">${opts.map(([k, l, c]) => `<button type="button" class="chip" data-g="f-chip" data-scope="${scope}" data-f="${st.open}" data-v="${esc(k)}" aria-pressed="${set.has(k)}">${esc(l)} <span class="chip__n">${c}</span></button>`).join('')}</div>` : ''}`;
  }
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
    const all = exAll();
    const groups = GROUPS.filter((g) => all.some((c) => c.group === g));
    return `<div class="chips-scroll" role="group" aria-label="Muscle group">
      <button type="button" class="chip" data-g="${attr}" data-group="" aria-pressed="${!sel}">All</button>
      ${groups.map((g) => `<button type="button" class="chip" data-g="${attr}" data-group="${g}" aria-pressed="${sel === g}">${g}</button>`).join('')}
    </div>`;
  }
  function exListItems() {
    const all = exFiltered();
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
      <div id="exFilters">${filtersHTML()}</div>
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
    const recs = ses.length ? recordsHTML(ex, ses) : '';
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
      ${(G().exNotes || {})[ex.id] ? `<p class="ex-note-view">📝 ${esc(G().exNotes[ex.id])}</p>` : ''}
      ${muscles}
      ${howto}
      ${ses.length ? `
        ${ex.type === 'kg' ? `<div class="segmented segmented--full" role="group" aria-label="Chart" style="margin-bottom:10px">
          <button type="button" data-g="ex-chart" data-k="e1rm" aria-pressed="${exChart === 'e1rm'}">Est. 1RM</button>
          <button type="button" data-g="ex-chart" data-k="kg" aria-pressed="${exChart === 'kg'}">Heaviest</button>
          <button type="button" data-g="ex-chart" data-k="vol" aria-pressed="${exChart === 'vol'}">Volume</button>
        </div><div class="chart" id="exChart"></div>` : ''}
        ${recs}`
        : '<p class="prose" style="margin-top:12px">You haven’t done this exercise yet. Once you tick it off in a workout, your records and a chart show up here.</p>'}
      ${custom ? `<button type="button" class="button button--danger" data-g="del-custom" style="margin-top:16px">Delete custom exercise</button>` : ''}`;
  }
  // Personal records like Hevy: best weight, 1RM, set and session volume, plus the heaviest weight per number of reps.
  function recordsHTML(ex, ses) {
    const day = (w) => fmtShort(dayOf(w.start));
    const rows = [];
    const row = (label, value, w) => rows.push(`<div class="pr-row"><span>${label}</span><strong>${value}</strong>${w ? `<small>${day(w)}</small>` : ''}</div>`);
    const work = ses.flatMap((x) => x.sets.filter(isWork).map((st) => ({ st, w: x.w })));
    const maxBy = (arr, f) => arr.reduce((best, it) => (f(it) > (best ? f(best) : -Infinity) ? it : best), null);
    let setTable = '';
    if (ex.type === 'kg') {
      const heavy = maxBy(work.filter((x) => x.st.w > 0 && x.st.r > 0), (x) => x.st.w);
      const orm = maxBy(work.filter((x) => x.st.w > 0 && x.st.r > 0), (x) => e1rm(x.st.w, x.st.r));
      const vol = maxBy(work.filter((x) => x.st.w > 0 && x.st.r > 0), (x) => x.st.w * x.st.r);
      const sess = maxBy(ses, (x) => x.sets.reduce((a, st) => a + setVol(st), 0));
      if (heavy) row('Heaviest weight', `${fmtKg(heavy.st.w)} kg`, heavy.w);
      if (orm) row('Best 1RM (est.)', `${fmtKg(Math.round(e1rm(orm.st.w, orm.st.r) * 10) / 10)} kg`, orm.w);
      if (vol) row('Best set volume', `${fmtKg(vol.st.w)} kg × ${vol.st.r}`, vol.w);
      if (sess) row('Best session volume', `${fmtVol(sess.sets.reduce((a, st) => a + setVol(st), 0))} kg`, sess.w);
      const byReps = new Map();
      for (const x of work) {
        if (!(x.st.w > 0 && x.st.r > 0)) continue;
        const cur = byReps.get(x.st.r);
        if (!cur || x.st.w > cur.st.w) byReps.set(x.st.r, x);
      }
      const reps = [...byReps.keys()].sort((a, b) => a - b);
      if (reps.length) setTable = `<details class="pr-sets" open><summary>Set records</summary>
        <div class="pr-sets__head"><span>Reps</span><span>Personal best</span><span></span></div>
        ${reps.map((r) => { const x = byReps.get(r); return `<div class="pr-sets__row"><span>${r}</span><strong>${fmtKg(x.st.w)} kg</strong><small>${day(x.w)}</small></div>`; }).join('')}
      </details>`;
    } else if (ex.type === 'bw') {
      const most = maxBy(work, (x) => x.st.r || 0);
      const extra = maxBy(work.filter((x) => x.st.w > 0), (x) => x.st.w);
      const sess = maxBy(ses, (x) => x.sets.filter(isWork).reduce((a, st) => a + (st.r || 0), 0));
      if (most && most.st.r) row('Most reps (one set)', `${most.st.r} reps`, most.w);
      if (extra) row('Heaviest extra weight', `+${fmtKg(extra.st.w)} kg × ${extra.st.r}`, extra.w);
      if (sess) row('Most reps (one session)', `${sess.sets.filter(isWork).reduce((a, st) => a + (st.r || 0), 0)} reps`, sess.w);
    } else {
      const longest = maxBy(work, (x) => x.st.s || 0);
      const sess = maxBy(ses, (x) => x.sets.reduce((a, st) => a + (st.s || 0), 0));
      if (longest && longest.st.s) row('Longest set', clock(longest.st.s), longest.w);
      if (sess) row('Most time (one session)', clock(sess.sets.reduce((a, st) => a + (st.s || 0), 0)), sess.w);
    }
    row('Times done', String(ses.length));
    return `<div class="pr-card"><h3 class="pr-card__title">🏅 Personal records</h3>${rows.join('')}${setTable}</div>`;
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
  const pk = { q: '', group: '', sel: [], onDone: null, form: false, shown: 60, eq: new Set(), mu: new Set(), open: null };
  function openPicker(onDone) {
    Object.assign(pk, { q: '', group: '', sel: [], onDone, form: false, shown: 60, eq: new Set(), mu: new Set(), open: null });
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
    const all = exFiltered(pk);
    const list = all.slice(0, pk.shown);
    const recent = !pk.q && !pk.eq.size && !pk.mu.size ? recentIds().map(exById) : [];
    $('#pickList').innerHTML = (recent.length ? `<h3 class="section-title" style="margin:6px 0 8px">Recent</h3><div class="pick-list">${recent.map(pickRow).join('')}</div><h3 class="section-title" style="margin:16px 0 8px">All exercises · ${all.length}</h3>` : '')
      + (list.length ? `<div class="pick-list">${list.map(pickRow).join('')}</div>` : '<p class="hint" style="text-align:center;padding:20px 0">Nothing found. Create a custom exercise below.</p>')
      + (all.length > list.length ? `<button type="button" class="button" data-g="pick-more" style="margin-top:10px">Show more (${all.length - list.length})</button>` : '');
    $('#pickDone').textContent = pk.sel.length ? `Add (${pk.sel.length})` : 'Add';
  }
  function renderPicker() {
    $('#pickBody').innerHTML = pk.form ? customFormHTML() : `
      <input class="search" type="search" data-gin="pick-q" placeholder="Search exercises" value="${esc(pk.q)}" aria-label="Search exercises">
      <div id="pickFilters">${filtersHTML(pk, 'pick')}</div>
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

  /* ---------------- Sheet: reorder a running workout ---------------- */
  const reorderSheet = $('#reorderSheet');
  let reorderDraft = null;
  function openReorder() {
    reorderDraft = [...G().active.items];
    renderReorder();
    reorderSheet.showModal();
  }
  function renderReorder() {
    $('#reorderBody').innerHTML = `<p class="hint" style="margin:0 0 10px">Hold ≡ and drag an exercise to a new spot.</p>
      <div class="list sort-list" id="reorderList">${reorderDraft.map((it) => {
        const ex = exById(it.exId);
        const done = it.sets.filter((st) => st.d).length;
        return `<div class="r-item r-item--row" data-sort>
          <div class="r-item__main">${GRIP_HTML}${thumbHTML(ex)}<div><div class="list__title">${esc(ex.name)}</div><div class="list__sub">${plural(it.sets.length, 'set', 'sets')}${done ? ` · ${done} done` : ''}</div></div></div>
        </div>`;
      }).join('')}</div>`;
    makeSortable($('#reorderList'), (from, to) => { moveItem(reorderDraft, from, to); renderReorder(); });
  }

  /* ---------------- Sheet: routine page ---------------- */
  const routineView = $('#routineView');
  let rvId = null, rvChart = 'vol';
  const routineWorkouts = (r) => history().filter((w) => w.routineId === r.id || (!w.routineId && norm(w.name) === norm(r.name))).reverse();
  function setTableHTML(ex, sets) {
    let n = 0;
    const head = ex.type === 'time' ? '<span>Set</span><span>Time</span><span></span>' : `<span>Set</span><span>${ex.type === 'bw' ? '+kg' : 'kg'}</span><span>Reps</span>`;
    return `<div class="rv-sets"><div class="rv-row rv-row--head">${head}</div>
      ${sets.map((x) => `<div class="rv-row"><span class="set-type--${x.t || 'n'}">${TYPE_LABEL[x.t] || ++n}</span>${ex.type === 'time'
        ? `<span>${x.s ? clock(x.s) : '—'}</span><span></span>`
        : `<span>${x.w != null ? fmtKg(x.w) : '—'}</span><span>${x.r ?? '—'}</span>`}</div>`).join('')}</div>`;
  }
  function openRoutineView(id) {
    rvId = id;
    $('#rvEdit').dataset.id = id;
    renderRoutineView();
    if (!routineView.open) routineView.showModal();
    $('#routineViewBody').scrollTop = 0;
    drawRoutineChart();
  }
  function renderRoutineView() {
    const r = G().routines.find((x) => x.id === rvId);
    if (!r) { routineView.close(); return; }
    const ws = routineWorkouts(r);
    $('#routineViewBody').innerHTML = `
      <h2 class="rv-title">${esc(r.name)}</h2>
      <p class="eyebrow" style="margin-bottom:14px">${plural(r.items.length, 'exercise', 'exercises')} · ${plural(r.items.reduce((a, it) => a + routineSets(it).length, 0), 'set', 'sets')}${ws.length ? ` · done ${plural(ws.length, 'time', 'times')}` : ''}</p>
      <button type="button" class="button button--primary" data-g="start-routine" data-id="${r.id}">Start routine</button>
      ${ws.length > 1 ? `<div class="segmented segmented--full" role="group" aria-label="Chart" style="margin:16px 0 10px">
          <button type="button" data-g="rv-chart" data-k="vol" aria-pressed="${rvChart === 'vol'}">Volume</button>
          <button type="button" data-g="rv-chart" data-k="reps" aria-pressed="${rvChart === 'reps'}">Reps</button>
          <button type="button" data-g="rv-chart" data-k="dur" aria-pressed="${rvChart === 'dur'}">Duration</button>
        </div><div class="chart" id="rvChart"></div>` : ''}
      <div class="section-row" style="margin:18px 0 6px"><h3 class="section-title">Exercises</h3><button type="button" class="inline-link" data-g="edit-routine" data-id="${r.id}">Edit routine</button></div>
      ${r.items.map((it) => {
        const ex = exById(it.exId);
        return `<div class="rv-ex">
          <button type="button" class="rv-ex__head" data-g="ex-info" data-ex="${esc(ex.id)}">${thumbHTML(ex)}<span>${esc(ex.name)}</span></button>
          <p class="rv-ex__rest">⏱ Rest timer: ${restText(it.rest ?? 90)}</p>
          ${setTableHTML(ex, routineSets(it))}
        </div>`;
      }).join('')}`;
  }
  function drawRoutineChart() {
    const el = $('#rvChart');
    const r = G().routines.find((x) => x.id === rvId);
    if (!el || !r) return;
    const pts = routineWorkouts(r).map((w) => ({ date: dayOf(w.start), value: rvChart === 'vol' ? Math.round(itemsVol(w.items)) : rvChart === 'reps' ? w.items.reduce((a, it) => a + it.sets.filter(isWork).reduce((b, st) => b + (st.r || 0), 0), 0) : w.end ? Math.round((w.end - w.start) / 60000) : 0 })).filter((p) => p.value > 0);
    lineChart(el, pts, { unit: rvChart === 'vol' ? 'kg' : rvChart === 'reps' ? 'reps' : 'min', label: r.name, digits: 0, height: 190 });
  }

  /* ---------------- Sheet: edit routine ---------------- */
  const routineSheet = $('#routineSheet');
  let draft = null;
  function openRoutine(id) {
    const r = id ? G().routines.find((x) => x.id === id) : null;
    draft = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', items: [], isNew: true };
    draft.items = draft.items.map((it) => ({ exId: it.exId, rest: it.rest ?? 90, sets: routineSets(it).map((x) => ({ ...x })) }));
    $('#routineTitle').textContent = r ? 'Edit routine' : 'New routine';
    renderRoutine();
    routineSheet.showModal();
  }
  function renderRoutine() {
    $('#routineBody').innerHTML = `
      <label class="field"><span class="field__label">Name</span><input data-gin="r-name" value="${esc(draft.name)}" placeholder="E.g. Push" autocomplete="off"></label>
      ${draft.items.length ? `<div class="sort-list r-cards" id="routineList">${draft.items.map((it, i) => {
        const ex = exById(it.exId);
        let n = 0;
        return `<div class="r-card" data-i="${i}" data-sort>
          <div class="r-card__head">${GRIP_HTML}${thumbHTML(ex)}<span class="r-card__name">${esc(ex.name)}</span>
            <button type="button" class="r-item__del" data-g="r-del" aria-label="Remove ${esc(ex.name)}">×</button></div>
          <label class="ex-menu__rest r-card__rest">Rest timer <select data-gin="r-rest">${REST_OPTS.map((x) => `<option value="${x}" ${x === (it.rest ?? 90) ? 'selected' : ''}>${restText(x)}</option>`).join('')}</select></label>
          <div class="r-set r-set--head${ex.type === 'time' ? ' r-set--time' : ''}"><span>Set</span>${ex.type === 'time' ? '<span>Minutes</span>' : `<span>${ex.type === 'bw' ? '+kg' : 'kg'}</span><span>Reps</span>`}</div>
          ${it.sets.map((x, j) => `<div class="r-set${ex.type === 'time' ? ' r-set--time' : ''}" data-j="${j}">
            <label class="set-type set-type--${x.t || 'n'}"><span>${TYPE_LABEL[x.t] || ++n}</span>
              <select data-gin="r-t" aria-label="Set type ${j + 1}">
                <option value="" ${!x.t ? 'selected' : ''}>Normal set</option>
                <option value="w" ${x.t === 'w' ? 'selected' : ''}>Warm-up set (W)</option>
                <option value="d" ${x.t === 'd' ? 'selected' : ''}>Drop set (D)</option>
                <option value="f" ${x.t === 'f' ? 'selected' : ''}>To failure (F)</option>
                <option value="x">Remove set</option>
              </select></label>
            ${ex.type === 'time'
              ? `<input class="set-in" data-gin="r-s" inputmode="decimal" placeholder="min" value="${minutes(x.s)}" aria-label="Minutes, set ${j + 1}">`
              : `<input class="set-in" data-gin="r-w" inputmode="decimal" placeholder="${ex.type === 'bw' ? '0' : 'kg'}" value="${fmtKg(x.w)}" aria-label="Kilograms, set ${j + 1}">
                 <input class="set-in" data-gin="r-r" inputmode="numeric" placeholder="reps" value="${x.r ?? ''}" aria-label="Reps, set ${j + 1}">`}
          </div>`).join('')}
          <button type="button" class="ex-card__add" data-g="r-addset">+ Add set</button>
        </div>`;
      }).join('')}</div>` : '<p class="hint">No exercises in this routine yet.</p>'}
      <button type="button" class="button" data-g="r-add" style="margin-top:12px">+ Add exercise</button>
      ${draft.isNew ? '' : '<button type="button" class="button button--danger" data-g="r-delete" style="margin-top:12px">Delete routine</button>'}`;
    const list = $('#routineList');
    if (list) makeSortable(list, (from, to) => { moveItem(draft.items, from, to); renderRoutine(); });
  }
  function saveRoutine() {
    const name = (draft.name || '').trim();
    if (!name) { toast('Give your routine a name'); routineSheet.querySelector('[data-gin="r-name"]')?.focus(); return; }
    if (!draft.items.length) { toast('Add at least one exercise'); return; }
    const { isNew, ...r } = { ...draft, name, items: draft.items.map((it) => ({ exId: it.exId, rest: it.rest, sets: it.sets.map(cleanSet) })) };
    const g = G();
    const i = g.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) g.routines[i] = r; else g.routines.push(r);
    saveNow();
    routineSheet.close();
    toast(isNew ? 'Routine created' : 'Routine saved');
    core.render();
    if (routineView.open) { renderRoutineView(); drawRoutineChart(); }
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
          ${it.note ? `<p class="ex-hist__note">📝 ${esc(it.note)}</p>` : ''}
          ${it.sets.map((st) => `<div class="ex-hist__set"><span class="ex-hist__n">${TYPE_LABEL[st.t] || ++n}</span>${esc(setText(ex, st))}</div>`).join('')}</div>`;
      }).join('')}
      ${w.note ? `<p class="prose" style="margin-top:12px">“${esc(w.note)}”</p>` : ''}
      <button type="button" class="button" data-g="edit-workout" style="margin-top:16px">✎ Edit workout</button>
      <div class="button-row" style="margin-top:10px">
        <button type="button" class="button" data-g="redo">Do again</button>
        <button type="button" class="button" data-g="to-routine">Save as routine</button>
      </div>
      <button type="button" class="button button--danger" data-g="del-workout" style="margin-top:10px">Delete workout</button>`;
    if (!workoutSheet.open) workoutSheet.showModal();
  }

  /* ---------------- Sheet: edit a finished workout ---------------- */
  const wkEdit = $('#wkEditSheet');
  let weDraft = null;
  const pad2 = (n) => String(n).padStart(2, '0');
  function openWorkoutEdit(id) {
    const w = G().workouts.find((x) => x.id === id);
    if (!w) return;
    const d = new Date(w.start);
    weDraft = {
      id: w.id, name: w.name, note: w.note || '',
      date: toISO(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      dur: w.end ? Math.max(1, Math.round((w.end - w.start) / 60000)) : '',
      items: w.items.map((it) => ({ exId: it.exId, note: it.note, sets: it.sets.map((x) => ({ ...x })) })),
    };
    renderWorkoutEdit();
    wkEdit.showModal();
  }
  function renderWorkoutEdit() {
    const D = weDraft;
    $('#wkEditBody').innerHTML = `
      <label class="field"><span class="field__label">Name</span><input data-gin="we-name" value="${esc(D.name)}" autocomplete="off"></label>
      <div class="field-grid" style="grid-template-columns:1.3fr 1fr 1fr">
        <label class="field"><span class="field__label">Date</span><input type="date" data-gin="we-date" value="${D.date}"></label>
        <label class="field"><span class="field__label">Start</span><input type="time" data-gin="we-time" value="${D.time}"></label>
        <label class="field"><span class="field__label">Minutes</span><input data-gin="we-dur" inputmode="numeric" value="${D.dur}"></label>
      </div>
      ${D.items.length ? `<div class="sort-list r-cards" id="weList">${D.items.map((it, i) => {
        const ex = exById(it.exId);
        let n = 0;
        return `<div class="r-card we-card" data-i="${i}" data-sort>
          <div class="r-card__head">${GRIP_HTML}${thumbHTML(ex)}<span class="r-card__name">${esc(ex.name)}</span>
            <button type="button" class="r-item__del" data-g="we-del" aria-label="Remove ${esc(ex.name)}">×</button></div>
          <div class="r-set r-set--head${ex.type === 'time' ? ' r-set--time' : ''}"><span>Set</span>${ex.type === 'time' ? '<span>Minutes</span>' : `<span>${ex.type === 'bw' ? '+kg' : 'kg'}</span><span>Reps</span>`}</div>
          ${it.sets.map((x, j) => `<div class="r-set${ex.type === 'time' ? ' r-set--time' : ''}" data-j="${j}">
            <label class="set-type set-type--${x.t || 'n'}"><span>${TYPE_LABEL[x.t] || ++n}</span>
              <select data-gin="we-t" aria-label="Set type ${j + 1}">
                <option value="" ${!x.t ? 'selected' : ''}>Normal set</option>
                <option value="w" ${x.t === 'w' ? 'selected' : ''}>Warm-up set (W)</option>
                <option value="d" ${x.t === 'd' ? 'selected' : ''}>Drop set (D)</option>
                <option value="f" ${x.t === 'f' ? 'selected' : ''}>To failure (F)</option>
                <option value="x">Remove set</option>
              </select></label>
            ${ex.type === 'time'
              ? `<input class="set-in" data-gin="we-s" inputmode="decimal" placeholder="min" value="${minutes(x.s)}" aria-label="Minutes, set ${j + 1}">`
              : `<input class="set-in" data-gin="we-w" inputmode="decimal" placeholder="${ex.type === 'bw' ? '0' : 'kg'}" value="${fmtKg(x.w)}" aria-label="Kilograms, set ${j + 1}">
                 <input class="set-in" data-gin="we-r" inputmode="numeric" placeholder="reps" value="${x.r ?? ''}" aria-label="Reps, set ${j + 1}">`}
          </div>`).join('')}
          <button type="button" class="ex-card__add" data-g="we-addset">+ Add set</button>
        </div>`;
      }).join('')}</div>` : '<p class="hint">No exercises left in this workout.</p>'}
      <button type="button" class="button" data-g="we-add" style="margin-top:12px">+ Add exercise</button>
      <label class="field" style="margin-top:14px"><span class="field__label">Note</span><textarea data-gin="we-note" rows="2">${esc(D.note)}</textarea></label>`;
    const list = $('#weList');
    if (list) makeSortable(list, (from, to) => { moveItem(weDraft.items, from, to); renderWorkoutEdit(); });
  }
  function weInput(t, k) {
    const D = weDraft; if (!D) return;
    if (k === 'we-name') D.name = t.value;
    else if (k === 'we-note') D.note = t.value;
    else if (k === 'we-date') D.date = t.value;
    else if (k === 'we-time') D.time = t.value;
    else if (k === 'we-dur') D.dur = t.value;
    else if (k === 'we-w' || k === 'we-r' || k === 'we-s') {
      const x = D.items[+t.closest('.we-card').dataset.i].sets[+t.closest('.r-set').dataset.j];
      const n = parseNum(t.value);
      if (Number.isNaN(n)) return;
      if (k === 'we-w') x.w = n; else if (k === 'we-r') x.r = n == null ? null : Math.round(n); else x.s = n == null ? null : Math.round(n * 60);
    }
  }
  function saveWorkoutEdit() {
    const D = weDraft; const g = G();
    const w = g.workouts.find((x) => x.id === D.id); if (!w) return;
    const [y, mo, da] = (D.date || dayOf(w.start)).split('-').map(Number);
    const [hh, mm] = (D.time || '12:00').split(':').map(Number);
    const start = new Date(y, mo - 1, da, hh || 0, mm || 0).getTime();
    if (!Number.isFinite(start)) { toast('Check the date and time'); return; }
    const dur = parseNum(D.dur);
    const items = D.items.map((it) => ({ exId: it.exId, ...(it.note ? { note: it.note } : {}), sets: it.sets.map(cleanSet).filter((x) => x.w != null || x.r != null || x.s != null) })).filter((it) => it.sets.length);
    if (!items.length) { toast('A workout needs at least one set'); return; }
    Object.assign(w, { name: (D.name || 'Workout').trim() || 'Workout', note: D.note || '', start, end: dur > 0 ? start + dur * 60000 : w.end && w.end > start ? w.end : null, items });
    recomputeAllPRs();
    saveNow();
    wkEdit.close();
    toast('Workout updated');
    core.render();
    openWorkout(w.id);
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
  // Routines from the Hevy API (GET /v1/routines): one or more JSON files, e.g. page 1 and page 2.
  async function importHevyRoutines(files) {
    try {
      await dbReady;
      const list = [];
      for (const f of files) {
        const data = JSON.parse(await f.text());
        const rs = Array.isArray(data) ? data : data.routines || (data.routine ? [data.routine] : []);
        list.push(...rs);
      }
      if (!list.length) throw new Error('empty');
      const g = G();
      const byName = new Map();
      for (const e of [...DBEX].reverse()) byName.set(norm(e.name), e.id);
      for (const e of [...LIB, ...g.custom]) byName.set(norm(e.name), e.id);
      for (const [k, v] of aliasMap()) byName.set(k, v);
      const created = [];
      const TYPE = { warmup: 'w', dropset: 'd', failure: 'f' };
      const routines = list.filter((r) => r && r.title && Array.isArray(r.exercises)).map((r) => ({
        id: 'hevy-' + (r.id || norm(r.title)),
        name: r.title.trim(),
        items: [...r.exercises].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((e) => {
          const title = String(e.title || '').trim();
          let exId = byName.get(norm(title));
          if (!exId) {
            const sets = e.sets || [];
            const type = sets.some((s) => s.weight_kg) ? 'kg' : sets.some((s) => s.duration_seconds) ? 'time' : 'bw';
            const c = { id: 'c-' + uid(), name: niceName(title) || 'Exercise', group: guessGroup(title), type };
            g.custom.push(c); created.push(c); exId = c.id; byName.set(norm(title), exId);
          }
          const sets = (e.sets || []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
          return { exId, rest: Number.isFinite(e.rest_seconds) ? e.rest_seconds : 90,
            sets: (sets.length ? sets : [{}]).map((x) => cleanSet({ t: TYPE[x.type] || '', w: x.weight_kg ?? null, r: x.reps ?? null, s: x.duration_seconds ?? null })) };
        }),
      })).filter((r) => r.items.length);
      const existing = new Set(g.routines.map((r) => r.id));
      const updates = routines.filter((r) => existing.has(r.id)).length;
      const msg = `Import ${plural(routines.length, 'routine', 'routines')} from Hevy${updates ? ` (${updates} already here will be updated)` : ''}${created.length ? `, with ${plural(created.length, 'new custom exercise', 'new custom exercises')}` : ''}?`;
      if (!await core.ask(msg, 'Import')) { g.custom = g.custom.filter((c) => !created.includes(c)); return; }
      for (const r of routines) {
        const i = g.routines.findIndex((x) => x.id === r.id);
        if (i >= 0) g.routines[i] = r; else g.routines.push(r);
      }
      // Other routines from an earlier Hevy import that aren't in this file: offer to remove them.
      const keep = new Set(routines.map((r) => r.id));
      const others = g.routines.filter((r) => String(r.id).startsWith('hevy-') && !keep.has(r.id));
      if (others.length && await core.ask(`Also remove the ${plural(others.length, 'other imported Hevy routine', 'other imported Hevy routines')} that aren’t in this file (${others.slice(0, 4).map((r) => r.name).join(', ')}${others.length > 4 ? ', …' : ''})?`, 'Remove')) {
        g.routines = g.routines.filter((r) => !others.includes(r));
      }
      saveNow();
      toast(`${plural(routines.length, 'routine', 'routines')} imported`);
      core.go('gym');
    } catch {
      toast('This doesn’t look like a Hevy routines file (JSON)');
    }
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
      for (const [k, v] of aliasMap()) byName.set(k, v);
      for (const c of g.custom) for (const [from, to] of Object.entries(RENAME)) if (c.name === to) byName.set(norm(from), c.id);
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
          const c = { id: 'c-' + uid(), name: niceName(title), group: guessGroup(title), type: 'kg' };
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
      if (!await core.ask(`Import ${plural(fresh.length, 'workout', 'workouts')} from Hevy${created.length ? ` (${plural(created.length, 'new custom exercise', 'new custom exercises')})` : ''}?`, 'Import')) { g.custom = g.custom.filter((c) => !created.includes(c)); return; }
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

  /* ---------------- Plate calculator ---------------- */
  // Shows under a set's kg field for barbell-type exercises: which plates go on each side.
  const PLATES = [20, 10, 5, 2.5, 1.25]; // the plates in the user's gym
  const PLATE_COLOR = { 25: '#C8463D', 20: '#3C6FB4', 15: '#D9B43C', 10: '#3E8A55', 5: '#E8E4DC', 2.5: '#2B2826', 1.25: '#A39B92' };
  // Bar / sled choices per kind of equipment (0 = none)
  const BAR_CHOICES = { Barbell: [20, 25, 15, 10, 0], 'EZ bar': [10, 8, 0], 'Smith machine': [11, 15, 20, 0] };
  const SLED_OPTS = [0, 10, 15, 20, 50, 75];
  const barOptions = (ex) => (isPlateMachine(ex) ? SLED_OPTS : BAR_CHOICES[equipOf(ex)] || BAR_CHOICES.Barbell);
  // Plate-loaded machines (you put plates on them): calculator too, without a bar by default.
  const PLATE_MACHINE = /leg press|hack squat|t ?-?bar row|iso-lateral|lever|leverage|pendulum|belt squat|calf press|hip thrust \(machine\)|landmine|plate.loaded|v squat|power squat/i;
  const isPlateMachine = (ex) => PLATE_MACHINE.test(ex.name);
  const plateEquip = (ex) => ['Barbell', 'EZ bar', 'Smith machine'].includes(equipOf(ex)) || isPlateMachine(ex);
  const defaultBar = (ex) => (isPlateMachine(ex) ? 0 : barOptions(ex)[0]);
  const barFor = (ex) => { const b = G().bars && G().bars[ex.id]; return b != null ? b : defaultBar(ex); };
  function platesFor(total, bar) {
    let side = (total - bar) / 2;
    if (!(side > 0)) return { side: Math.max(0, side), list: [], rest: 0 };
    const list = [];
    for (const p of PLATES) while (side >= p - 1e-9) { list.push(p); side = Math.round((side - p) * 1000) / 1000; }
    return { side: (total - bar) / 2, list, rest: side };
  }
  function platesHTML(ex, total) {
    const bar = barFor(ex);
    const { side, list, rest } = platesFor(total || 0, bar);
    const maxH = 64;
    const plates = list.map((p) => `<span class="plate" style="--c:${PLATE_COLOR[p]};height:${Math.round(maxH * (0.38 + 0.62 * (p / 20)))}px;width:${p >= 10 ? 12 : p >= 2.5 ? 9 : 7}px" title="${fmtKg(p)} kg"></span>`).join('');
    const counts = [];
    for (const p of PLATES) { const n = list.filter((x) => x === p).length; if (n) counts.push(n > 1 ? `${n}×${fmtKg(p)}` : fmtKg(p)); }
    return `<div class="plates" data-ex="${esc(ex.id)}">
      <div class="plates__bar" aria-hidden="true"><span class="plates__sleeve"></span>${plates}<span class="plates__collar"></span><span class="plates__shaft"></span></div>
      <p class="plates__text">${!total ? 'Type a weight to see the plates.' : total < bar ? `Lighter than the ${isPlateMachine(ex) ? 'sled' : 'bar'} (${fmtKg(bar)} kg).` : list.length ? `<strong>Per side:</strong> ${counts.join(' + ')} kg` : `Just the ${isPlateMachine(ex) ? 'machine' : 'bar'}.`}
        ${rest > 0.001 ? `<span class="plates__rest">${fmtKg(Math.round(rest * 2 * 100) / 100)} kg can’t be loaded exactly</span>` : ''}</p>
      <div class="plates__bars" role="group" aria-label="Bar weight"><span>${isPlateMachine(ex) ? 'Sled' : 'Bar'}</span>${barOptions(ex).map((b) => `<button type="button" class="chip" data-g="bar" data-b="${b}" aria-pressed="${b === bar}">${b ? `${b} kg` : 'None'}</button>`).join('')}</div>
    </div>`;
  }
  // A small "Plates" button floats above the keyboard while you type kg for a plate exercise;
  // tapping it opens the calculator just above the keyboard.
  const plateBtn = $('#plateBtn'), platePanel = $('#platePanel');
  let plateInput = null, plateOpen = false;
  function plateContext() {
    const row = plateInput && plateInput.closest('.set-row');
    const a = act();
    if (!row || !a || !document.contains(plateInput)) return null;
    const it = a.items[+row.dataset.i];
    return it ? exById(it.exId) : null;
  }
  function renderPlates() {
    const ex = plateContext();
    const show = !!ex && plateEquip(ex) && document.activeElement === plateInput;
    plateBtn.hidden = !show;
    platePanel.hidden = !(show && plateOpen);
    plateBtn.setAttribute('aria-expanded', String(show && plateOpen));
    if (!show || !plateOpen) return;
    const v = parseNum(plateInput.value);
    const total = v != null && !Number.isNaN(v) ? v : parseNum(plateInput.placeholder);
    platePanel.innerHTML = platesHTML(ex, Number.isFinite(total) ? total : 0);
  }
  function showPlates(input) { plateInput = input; renderPlates(); }
  document.addEventListener('focusin', (ev) => { if (ev.target.matches?.('.set-row [data-gin="w"]')) showPlates(ev.target); });
  document.addEventListener('focusout', (ev) => {
    if (!ev.target.matches?.('.set-row [data-gin="w"]')) return;
    setTimeout(() => { if (!document.activeElement?.matches?.('.set-row [data-gin="w"]')) { plateInput = null; renderPlates(); } }, 120);
  });
  // Tapping the button or the panel must not close the keyboard
  document.addEventListener('pointerdown', (ev) => { if (ev.target.closest('#plateBtn, #platePanel')) ev.preventDefault(); });
  plateBtn.addEventListener('click', () => { plateOpen = !plateOpen; renderPlates(); });

  /* ---------------- Events ---------------- */
  const act = () => G().active;
  const rowOf = (el) => { const r = el.closest('.set-row'); return r ? { i: +r.dataset.i, j: +r.dataset.j } : null; };
  const cardOf = (el) => +el.closest('.ex-card')?.dataset.i;

  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-g]');
    if (!b) return;
    const g = G();
    const a = act();
    switch (b.dataset.g) {
      case 'start-empty': return startWorkout();
      case 'start-routine': {
        const r = g.routines.find((x) => x.id === b.dataset.id);
        if (routineView.open) routineView.close();
        if (r) startWorkout({ name: r.name, routineId: r.id, items: r.items });
        return;
      }
      case 'open-routine': if (ev.target.closest('.drag-handle')) return; return openRoutineView(b.dataset.id);
      case 'rv-chart': rvChart = b.dataset.k; renderRoutineView(); drawRoutineChart(); return;
      case 'new-routine': return openRoutine(null);
      case 'edit-routine': return openRoutine(b.dataset.id);
      case 'hevy': return $('#hevyFile').click();
      case 'hevy-routines': return $('#hevyRoutineFile').click();
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
        if (st.run) { st.s = runSecs(st); delete st.run; }
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
        if (ex.type === 'kg') {
          const hb = histBest(it.exId);
          if (isRecordSet(st, hb)) toast(st.w > hb.kg + 1e-9 ? `🏆 New record: heaviest ${ex.name} (${fmtKg(st.w)} kg)` : `🏆 New record: best 1RM ${ex.name} (≈ ${fmtKg(Math.round(e1rm(st.w, st.r)))} kg)`);
        }
        saveSoon(); core.render();
        return;
      }
      case 'sw': {
        const p = rowOf(b); if (!p || !a) return;
        const st = a.items[p.i].sets[p.j];
        if (st.run) { st.s = runSecs(st); delete st.run; }
        else { ensureAudio(); st.run = Date.now() - (st.s || 0) * 1000; }
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
      case 'ex-del': {
        const i = cardOf(b);
        if (!await core.ask(`Remove ${exById(a.items[i].exId).name} from this workout?`, 'Remove')) return;
        a.items.splice(i, 1); openMenus.clear(); saveNow(); core.render();
        return;
      }
      case 'ex-info': return openExercise(b.dataset.ex);
      case 'bar': {
        const box = b.closest('.plates'); const g0 = G();
        g0.bars = { ...(g0.bars || {}), [box.dataset.ex]: Number(b.dataset.b) };
        saveSoon();
        renderPlates();
        return;
      }
      case 'reorder': openMenus.clear(); return openReorder();
      case 'reorder-done':
        if (a && reorderDraft) { a.items = reorderDraft; saveNow(); }
        reorderSheet.close(); core.render(); return;
      case 'finish': return finishWorkout();
      case 'cancel':
        if (!await core.ask('Discard this workout? Nothing you entered will be saved.', 'Discard')) return;
        g.active = null; openMenus.clear(); saveNow(); core.render(); return;
      case 'rest-minus': if (a && a.restEnd) { a.restEnd -= 15000; a.restTotal = Math.max(15, (a.restTotal || 90) - 15); saveSoon(); tick(); } return;
      case 'rest-plus': if (a && a.restEnd) { a.restEnd += 15000; a.restTotal = (a.restTotal || 90) + 15; saveSoon(); tick(); } return;
      case 'rest-skip': return stopRest();
      case 'open-workout': return openWorkout(b.dataset.id);
      case 'edit-workout': return openWorkoutEdit(wkOpen);
      case 'we-save': return saveWorkoutEdit();
      case 'we-del': weDraft.items.splice(+b.closest('.we-card').dataset.i, 1); return renderWorkoutEdit();
      case 'we-addset': {
        const it = weDraft.items[+b.closest('.we-card').dataset.i];
        const last = it.sets[it.sets.length - 1];
        it.sets.push(last ? { ...last, t: last.t === 'w' ? '' : last.t } : {});
        return renderWorkoutEdit();
      }
      case 'we-add':
        return openPicker((ids) => { for (const id of ids) weDraft.items.push({ exId: id, sets: [{}, {}, {}] }); renderWorkoutEdit(); });
      case 'cal-month': histUi.month = b.dataset.m; return renderHistory();
      case 'musc-week': histUi.week = b.dataset.w; return renderHistory();
      case 'redo': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        workoutSheet.close();
        return startWorkout({ name: w.name, routineId: w.routineId, items: w.items.map((it) => ({ exId: it.exId, sets: it.sets.map(cleanSet) })) });
      }
      case 'to-routine': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        g.routines.push({ id: uid(), name: w.name, items: w.items.map((it) => ({ exId: it.exId, sets: it.sets.map(cleanSet), rest: 90 })) });
        saveNow(); workoutSheet.close(); toast(`Routine “${w.name}” created`); core.go('gym');
        return;
      }
      case 'del-workout': {
        const w = g.workouts.find((x) => x.id === wkOpen); if (!w) return;
        if (!await core.ask(`Delete workout “${w.name}” from ${fmtDate(dayOf(w.start))}?`, 'Delete')) return;
        g.workouts = g.workouts.filter((x) => x !== w);
        saveNow(); workoutSheet.close(); toast('Workout deleted'); core.render();
        return;
      }
      case 'ex-chart': exChart = b.dataset.k; renderExerciseSheet(); drawExChart(); return;
      case 'del-custom': {
        const used = g.workouts.some((w) => w.items.some((it) => it.exId === exOpen)) || g.routines.some((r) => r.items.some((it) => it.exId === exOpen)) || a?.items.some((it) => it.exId === exOpen);
        if (used) { toast('This exercise is still used in workouts or routines'); return; }
        if (!await core.ask('Delete this custom exercise?', 'Delete')) return;
        g.custom = g.custom.filter((c) => c.id !== exOpen);
        saveNow(); exSheet.close(); core.render();
        return;
      }
      case 'f-toggle': case 'f-chip': case 'f-clear': {
        const pick = b.dataset.scope === 'pick';
        const st = pick ? pk : exUi;
        if (b.dataset.g === 'f-toggle') st.open = st.open === b.dataset.f ? null : b.dataset.f;
        else if (b.dataset.g === 'f-clear') { st.eq.clear(); st.mu.clear(); st.open = null; }
        else { const set = b.dataset.f === 'eq' ? st.eq : st.mu; if (set.has(b.dataset.v)) set.delete(b.dataset.v); else set.add(b.dataset.v); }
        st.shown = 60;
        if (pick) { $('#pickFilters').innerHTML = filtersHTML(pk, 'pick'); renderPickerList(); }
        else { $('#exFilters').innerHTML = filtersHTML(); $('#exList').innerHTML = exListItems(); }
        return;
      }
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
        return openPicker((ids) => {
          for (const id of ids) { const pv = prevSets(id); draft.items.push({ exId: id, rest: 90, sets: pv.length ? pv.map(cleanSet) : [{}, {}, {}] }); }
          renderRoutine();
        });
      case 'r-addset': {
        const it = draft.items[+b.closest('.r-card').dataset.i];
        const last = it.sets[it.sets.length - 1];
        it.sets.push(last ? { ...last, t: last.t === 'w' ? '' : last.t } : {});
        return renderRoutine();
      }
      case 'r-del': draft.items.splice(+b.closest('.r-card').dataset.i, 1); return renderRoutine();
      case 'r-save': return saveRoutine();
      case 'r-delete':
        if (!await core.ask(`Delete routine “${draft.name}”? Your finished workouts stay saved.`, 'Delete')) return;
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
      const n = k === 's' ? 0 : parseNum(t.value);
      if (Number.isNaN(n)) return;
      if (k === 's') { const sec = parseTime(t.value); if (Number.isNaN(sec)) return; st.s = sec; }
      else if (k === 'r') st.r = n == null ? null : Math.round(n);
      else st.w = n;
      if (st.d) updateHead();
      if (k === 'w') showPlates(t);
      saveSoon();
    } else if (k === 'name' && a) { a.name = t.value; saveSoon(); }
    else if (k === 'note' && a) { a.note = t.value; saveSoon(); }
    else if (k === 'ex-q') { exUi.q = t.value; exUi.shown = 60; $('#exList').innerHTML = exListItems(); }
    else if (k === 'pick-q') { pk.q = t.value; pk.shown = 60; renderPickerList(); }
    else if (k === 'r-name') draft.name = t.value;
    else if (k === 'ex-note' && a) {
      const it = a.items[cardOf(t)]; if (!it) return;
      const g0 = G(); g0.exNotes = { ...(g0.exNotes || {}) };
      if (t.value.trim()) g0.exNotes[it.exId] = t.value; else delete g0.exNotes[it.exId];
      t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
      saveSoon();
    }
    else if (k.startsWith('we-')) weInput(t, k);
    else if (k === 'r-w' || k === 'r-r' || k === 'r-s') {
      const it = draft.items[+t.closest('.r-card').dataset.i], x = it.sets[+t.closest('.r-set').dataset.j];
      const n = parseNum(t.value);
      if (Number.isNaN(n)) return;
      if (k === 'r-w') x.w = n; else if (k === 'r-r') x.r = n == null ? null : Math.round(n); else x.s = n == null ? null : Math.round(n * 60);
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    const a = act();
    if (t.id === 'hevyFile' && t.files[0]) { importHevy(t.files[0]); t.value = ''; return; }
    if (t.id === 'hevyRoutineFile' && t.files.length) { importHevyRoutines([...t.files]); t.value = ''; return; }
    if (t.dataset?.gin === 't' && a) {
      const p = rowOf(t); if (!p) return;
      const it = a.items[p.i];
      if (t.value === 'x') { if (it.sets.length === 1) { toast('An exercise needs at least one set'); core.render(); return; } it.sets.splice(p.j, 1); }
      else it.sets[p.j].t = t.value || undefined;
      saveSoon(); core.render();
    } else if (t.dataset?.gin === 'we-t' && weDraft) {
      const it = weDraft.items[+t.closest('.we-card').dataset.i], j = +t.closest('.r-set').dataset.j;
      if (t.value === 'x') { if (it.sets.length > 1) it.sets.splice(j, 1); else toast('An exercise needs at least one set'); }
      else it.sets[j].t = t.value;
      renderWorkoutEdit();
    } else if (t.dataset?.gin === 'r-t' && draft) {
      const it = draft.items[+t.closest('.r-card').dataset.i], j = +t.closest('.r-set').dataset.j;
      if (t.value === 'x') { if (it.sets.length > 1) it.sets.splice(j, 1); else toast('An exercise needs at least one set'); }
      else it.sets[j].t = t.value;
      renderRoutine();
    } else if (t.dataset?.gin === 'r-rest' && draft) {
      draft.items[+t.closest('.r-card').dataset.i].rest = Number(t.value);
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
  for (const dlg of [picker, routineSheet, workoutSheet, exSheet, reorderSheet, routineView, wkEdit]) {
    dlg.addEventListener('click', (ev) => {
      if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close();
    });
  }
  $('#pickDone').dataset.g = 'pick-done';
  $('#routineSave').dataset.g = 'r-save';
  $('#reorderDone').dataset.g = 'reorder-done';
  $('#wkEditSave').dataset.g = 'we-save';
  workoutSheet.addEventListener('close', () => { if (ui.view === 'gymHistory' || ui.view === 'gym') core.render(); });

  tick();

  return {
    views: { gym: renderGym, gymHistory: renderHistory, gymEx: renderExercises },
    titles: { gym: 'Workout', gymHistory: 'History', gymEx: 'Exercises' },
    afterRender() { tick(); },
    importHevy,
    importHevyRoutines,
    // Figures for the weekly report (dates are local ISO days, inclusive)
    weekStats(from, to) {
      const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const ws = G().workouts.filter((w) => { const d = day(w.start); return d >= from && d <= to; }).sort((a, b) => a.start - b.start);
      let sets = 0, volume = 0, minutes = 0;
      const muscles = new Map(), prs = [];
      for (const w of ws) {
        minutes += Math.max(0, Math.round(((w.end || w.start) - w.start) / 60000));
        for (const it of w.items) {
          const ex = exById(it.exId);
          const n = it.sets.filter((st) => st.t !== 'w').length;
          sets += n;
          for (const st of it.sets) if (st.t !== 'w' && st.w > 0 && st.r > 0) volume += st.w * st.r;
          for (const m of new Set(musclesOf(ex))) muscles.set(m, (muscles.get(m) || 0) + n);
        }
        for (const pr of w.prs || []) prs.push({ name: exById(pr.exId).name, label: prLabel(pr), day: day(w.start) });
      }
      return { workouts: ws.map((w) => ({ name: w.name, day: day(w.start) })), sets, volume: Math.round(volume), minutes, prs, muscles: [...muscles].sort((a, b) => b[1] - a[1]) };
    },
  };
};
