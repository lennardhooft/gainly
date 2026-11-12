/* Gainly — cloud sync with Supabase.
   The app keeps working offline from localStorage / IndexedDB; this module copies everything
   to a private Supabase project in the background and back again on other devices.
   - App data: one JSON row per user in public.gainly_state (row-level security: only you).
   - Photos: private storage bucket "photos", path <user id>/<date>_<pose>.jpg
   The publishable key below is meant to be public; the database rules protect your data. */
window.GainlySync = function GainlySync(core) {
  'use strict';
  const URL_ = 'https://hqedcntftsipwhqlitoq.supabase.co';
  const KEY = 'sb_publishable_V7CpxXZCZtHoZ2azICA8LA_Uae-RBnw';
  const AUTH_KEY = 'gainly:auth';
  const META_KEY = 'gainly:sync';
  const { $, esc, toast, ask } = core;

  // ---------- local sync bookkeeping ----------
  const readMeta = () => {
    try { const m = JSON.parse(localStorage.getItem(META_KEY) || '{}'); return { remoteAt: null, dirty: false, lastSync: null, photoUp: [], photoDel: [], photoKnown: [], ...m }; }
    catch { return { remoteAt: null, dirty: false, lastSync: null, photoUp: [], photoDel: [], photoKnown: [] }; }
  };
  let meta = readMeta();
  const writeMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* full */ } };
  const setAdd = (k, v) => { if (!meta[k].includes(v)) meta[k].push(v); };
  const setDel = (k, v) => { meta[k] = meta[k].filter((x) => x !== v); };

  // ---------- Supabase client (loaded only when needed) ----------
  let sb = null, user = null, status = 'idle', lastError = '';
  const hasSession = () => { try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; } };
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/supabase.min.js';
      s.onload = res; s.onerror = () => rej(new Error('lib'));
      document.head.append(s);
    });
  }
  async function client() {
    if (sb) return sb;
    await loadLib();
    sb = window.supabase.createClient(URL_, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY },
    });
    sb.auth.onAuthStateChange((ev, session) => {
      user = session ? session.user : null;
      if (ev === 'SIGNED_OUT') { user = null; refreshCard(); }
    });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    return sb;
  }

  const setStatus = (s, err = '') => { status = s; lastError = err; refreshCard(); };

  // ---------- app data ----------
  const summary = (d) => {
    const n = (d && d.entries ? d.entries.length : 0), w = (d && d.gym && d.gym.workouts ? d.gym.workouts.length : 0);
    const f = d && d.food && d.food.days ? Object.values(d.food.days).filter((x) => x && x.meals && Object.values(x.meals).some((m) => m && m.length)).length : 0;
    return `${n} measurement${n === 1 ? '' : 's'}, ${w} workout${w === 1 ? '' : 's'}, ${f} food day${f === 1 ? '' : 's'}`;
  };
  const isEmpty = (d) => !d || (!(d.entries && d.entries.length) && !(d.gym && d.gym.workouts && d.gym.workouts.length) && !(d.food && d.food.days && Object.keys(d.food.days).length));

  async function remoteMeta() {
    const { data, error } = await sb.from('gainly_state').select('updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data ? data.updated_at : null;
  }
  async function pushState() {
    const { data, error } = await sb.from('gainly_state')
      .upsert({ user_id: user.id, data: core.getState(), device: navigator.userAgent.slice(0, 120) })
      .select('updated_at').single();
    if (error) throw error;
    meta.remoteAt = data.updated_at; meta.dirty = false; meta.lastSync = new Date().toISOString(); writeMeta();
  }
  async function pullState() {
    const { data, error } = await sb.from('gainly_state').select('data, updated_at').eq('user_id', user.id).single();
    if (error) throw error;
    core.setState(data.data);
    meta.remoteAt = data.updated_at; meta.dirty = false; meta.lastSync = new Date().toISOString(); writeMeta();
  }

  // Declined the online data: only overwrite it after a second, explicit yes
  async function keepLocal() {
    if (await ask('Upload this iPhone’s data instead? It replaces the data that is online now.', 'Replace online data')) { await pushState(); return 'pushed'; }
    meta.dirty = true; writeMeta(); // ask again next time, never overwrite silently
    throw new Error('Sync paused: tap Sync now to choose which data to keep.');
  }

  // Decide what to do when both sides may have changed
  async function syncState({ first = false } = {}) {
    const remoteAt = await remoteMeta();
    if (!remoteAt) { await pushState(); return 'pushed'; }
    const remoteNewer = !meta.remoteAt || new Date(remoteAt) > new Date(meta.remoteAt);
    if (first && remoteNewer) {
      const local = core.getState();
      if (isEmpty(local)) { await pullState(); return 'pulled'; }
      const { data } = await sb.from('gainly_state').select('data').eq('user_id', user.id).single();
      const useCloud = await ask(`There is already Gainly data online (${summary(data.data)}). This iPhone has ${summary(local)}. Load the online data on this iPhone?`, 'Use online data');
      if (useCloud) { core.snapshot('before-cloud'); await pullState(); return 'pulled'; }
      return keepLocal();
    }
    if (remoteNewer && meta.dirty) {
      const useCloud = await ask('Gainly changed on another device and on this one since the last sync. Load the online version on this iPhone?', 'Use online version');
      if (useCloud) { core.snapshot('before-cloud'); await pullState(); return 'pulled'; }
      return keepLocal();
    }
    if (remoteNewer) { if (!isEmpty(core.getState())) core.snapshot('before-cloud'); await pullState(); return 'pulled'; }
    if (meta.dirty) { await pushState(); return 'pushed'; }
    return 'same';
  }

  // ---------- photos ----------
  const folder = () => user.id + '/';
  const pathOf = (id) => `${folder()}${id}.jpg`;
  async function remotePhotoIds() {
    const out = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await sb.storage.from('photos').list(user.id, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      for (const o of data || []) if (o.name && o.name.endsWith('.jpg')) out.push(o.name.slice(0, -4));
      if (!data || data.length < 100) break;
    }
    return out;
  }
  async function syncPhotos() {
    const local = await core.photos.all();
    const localIds = new Set(local.map((p) => p.id));
    let changed = false;
    // 1. deletions made here
    for (const id of [...meta.photoDel]) {
      const { error } = await sb.storage.from('photos').remove([pathOf(id)]);
      if (error) throw error;
      setDel('photoDel', id); setDel('photoKnown', id); writeMeta();
    }
    // 2. uploads made here
    for (const id of [...meta.photoUp]) {
      const p = local.find((x) => x.id === id);
      if (p) {
        const { error } = await sb.storage.from('photos').upload(pathOf(id), p.blob, { upsert: true, contentType: p.blob.type || 'image/jpeg' });
        if (error) throw error;
        setAdd('photoKnown', id);
      }
      setDel('photoUp', id); writeMeta();
    }
    // 3. compare with what's online
    const remote = new Set(await remotePhotoIds());
    for (const p of local) {
      if (remote.has(p.id)) { setAdd('photoKnown', p.id); continue; }
      if (meta.photoKnown.includes(p.id)) {
        // was synced before and is gone online: deleted on another device
        await core.photos.del(p.id); setDel('photoKnown', p.id); changed = true;
      } else {
        const { error } = await sb.storage.from('photos').upload(pathOf(p.id), p.blob, { upsert: true, contentType: p.blob.type || 'image/jpeg' });
        if (error) throw error;
        setAdd('photoKnown', p.id);
      }
      writeMeta();
    }
    for (const id of remote) {
      if (localIds.has(id)) continue;
      const { data, error } = await sb.storage.from('photos').download(pathOf(id));
      if (error) throw error;
      const m = /^(\d{4}-\d{2}-\d{2})_(.+)$/.exec(id);
      if (!m) continue;
      let w = 0, h = 0;
      try { const bmp = await createImageBitmap(data); w = bmp.width; h = bmp.height; bmp.close && bmp.close(); } catch { /* size unknown */ }
      await core.photos.put({ id, date: m[1], pose: m[2], blob: data, w, h, t: Date.now() });
      setAdd('photoKnown', id); writeMeta(); changed = true;
    }
    if (changed) await core.reloadPhotos();
  }

  // ---------- the sync loop ----------
  let running = null, pushTimer = 0, lastPull = 0;
  async function syncNow({ first = false, quiet = true } = {}) {
    if (running) return running;
    running = (async () => {
      try {
        await client();
        if (!user) return;
        if (!navigator.onLine) { setStatus('offline'); return; }
        setStatus('syncing');
        const r = await syncState({ first });
        await syncPhotos();
        lastPull = Date.now();
        meta.lastSync = new Date().toISOString(); writeMeta();
        setStatus('ok');
        if (!quiet) toast(r === 'pulled' ? 'Synced: loaded the online data' : 'Synced');
      } catch (e) {
        const msg = String((e && (e.message || e.error_description)) || e);
        setStatus('error', /relation|does not exist|schema cache/i.test(msg) ? 'The database isn’t set up yet (run setup.sql in Supabase).' : /bucket/i.test(msg) ? 'The photo storage isn’t set up yet (run setup.sql in Supabase).' : msg);
        if (!quiet) toast('Sync failed: ' + lastError);
      } finally { running = null; }
    })();
    return running;
  }

  // Called by the app after every local save
  function changed() {
    if (!hasSession()) return;
    meta.dirty = true; writeMeta();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow(), 4000);
  }
  function photoPut(id) { if (!hasSession()) return; setAdd('photoUp', id); setDel('photoDel', id); writeMeta(); clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(), 1500); }
  function photoDel(id) { if (!hasSession()) return; setAdd('photoDel', id); setDel('photoUp', id); writeMeta(); clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(), 1500); }

  // Pull when the app comes back to the foreground (at most once a minute)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && hasSession() && Date.now() - lastPull > 60000) syncNow(); });
  window.addEventListener('online', () => { if (hasSession()) syncNow(); });

  // ---------- sign in with e-mail + password ----------
  const login = { busy: false, email: '' };
  async function signIn(email, password, create) {
    await client();
    const r = create ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    if (r.error) throw r.error;
    if (!r.data.session) throw new Error('Account created, but e-mail confirmation is still switched on in Supabase.');
    user = r.data.user;
  }
  async function signOut() {
    if (!await ask('Sign out of cloud sync on this device? Your data stays on this iPhone and online.', 'Sign out')) return;
    try { await client(); await sb.auth.signOut({ scope: 'local' }); } catch { /* offline: drop the session anyway */ }
    try { localStorage.removeItem(AUTH_KEY); } catch { /* ok */ }
    user = null;
    meta = { remoteAt: null, dirty: false, lastSync: null, photoUp: [], photoDel: [], photoKnown: [] }; writeMeta();
    Object.assign(login, { email: '', busy: false });
    refreshCard(); toast('Signed out');
  }

  // ---------- settings card ----------
  const ago = (iso) => {
    if (!iso) return 'never';
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  function cardHTML() {
    if (user || (hasSession() && status !== 'signedout')) {
      const st = status === 'syncing' ? 'Syncing…' : status === 'offline' ? 'Offline: syncs when you’re back online' : status === 'error' ? `<span style="color:var(--bad)">${esc(lastError)}</span>` : `Last synced ${ago(meta.lastSync)}`;
      return `<h2 class="card__title" style="margin-bottom:6px">Cloud sync</h2>
        <p class="prose" style="margin-bottom:4px">Signed in as <b>${esc(user ? user.email : '…')}</b>. Measurements, workouts, nutrition, settings and photos are copied to your private online storage.</p>
        <p class="hint" style="margin:0 0 12px">${st}</p>
        <div class="button-row">
          <button type="button" class="button" data-sync="now">Sync now</button>
          <button type="button" class="button" data-sync="signout">Sign out</button>
        </div>`;
    }
    return `<h2 class="card__title" style="margin-bottom:6px">Cloud sync</h2>
      <p class="prose" style="margin-bottom:12px">Keep a copy of everything online, so you never lose it and can use Gainly on another device. First time? Choose an e-mail and password and tap <b>Create account</b>.</p>
      <form id="syncLoginForm" class="sync-form" autocomplete="on">
        <label class="field"><span class="field__label">E-mail</span><input name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(login.email)}" placeholder="you@example.com"></label>
        <label class="field"><span class="field__label">Password <small>at least 8 characters</small></span><input name="password" type="password" autocomplete="current-password" minlength="8"></label>
        <div class="button-row">
          <button type="submit" class="button button--primary" value="signin"${login.busy ? ' disabled' : ''}>${login.busy ? 'Please wait…' : 'Sign in'}</button>
          <button type="submit" class="button" value="signup"${login.busy ? ' disabled' : ''}>Create account</button>
        </div>
      </form>`;
  }
  function refreshCard() { const el = document.getElementById('syncCard'); if (el) el.innerHTML = cardHTML(); }

  document.addEventListener('submit', async (ev) => {
    const f = ev.target;
    if (f.id !== 'syncLoginForm') return;
    ev.preventDefault();
    const create = ev.submitter && ev.submitter.value === 'signup';
    const email = f.email.value.trim(), password = f.password.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid e-mail address'); return; }
    if (password.length < 8) { toast('Use a password of at least 8 characters'); return; }
    if (create) f.password.setAttribute('autocomplete', 'new-password');
    Object.assign(login, { email, busy: true }); refreshCard();
    try {
      await signIn(email, password, create);
      login.busy = false;
      toast(create ? 'Account created' : 'Signed in');
      refreshCard();
      await syncNow({ first: true, quiet: false });
    } catch (e) {
      login.busy = false; refreshCard();
      const m = e.message || '';
      toast(/invalid login/i.test(m) ? 'Wrong e-mail or password' : /already registered|already exists/i.test(m) ? 'This e-mail already has an account: tap Sign in' : /signups not allowed|signup.*disabled/i.test(m) ? 'New accounts are switched off for this project' : /password/i.test(m) ? m : 'Couldn’t sign in: ' + (m || 'try again'));
    }
  });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sync]');
    if (!b) return;
    if (b.dataset.sync === 'now') syncNow({ quiet: false });
    if (b.dataset.sync === 'signout') signOut();
  });

  // Start: if signed in before, sync in the background
  if (hasSession()) setTimeout(() => syncNow(), 1200);

  return {
    changed, photoPut, photoDel,
    settingsHTML: () => `<div class="card" id="syncCard">${cardHTML()}</div>`,
    isOn: () => hasSession(),
  };
};
