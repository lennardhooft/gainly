/* Gainly — Nutrition: daily food diary, macro rings, water tracker and diet goals.
   Everything lives in state.food (so it is part of backups and restore points):
   { days: { 'YYYY-MM-DD': { meals: { breakfast: [entry], lunch: [], dinner: [], snack: [] }, water: ml } },
     products: { id: product }, goals: { kcal, mode, protein, carbs, fat, water, waterStep, container } }
   An entry: { id, pid, g }  (grams eaten of product pid)
   A product: { id, name, brand, code, img, serving, n: { nutrient: value per 100 g } }
   Product data: Open Food Facts (open database, ODbL). Barcodes are scanned with html5-qrcode (Apache-2.0). */
window.GainlyFood = function (core) {
  'use strict';
  const { $, esc, fmt, fmtShort, fmtDate, toISO, todayISO, addDays, parseNum, uid, plural, chev, viewEl, toast, ui, DF_WEEKDAY } = core;

  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];
  const DEFAULT_SPLIT = { breakfast: 25, lunch: 35, dinner: 30, snack: 10 };
  const DEFAULT_GOALS = { kcal: 2000, mode: 'pct', protein: 30, carbs: 40, fat: 30, water: 2500, waterStep: 250, container: 'glass' };

  const F = () => {
    const s = core.state;
    if (!s.food || typeof s.food !== 'object') s.food = {};
    const f = s.food;
    if (!f.days || typeof f.days !== 'object') f.days = {};
    if (!f.products || typeof f.products !== 'object') f.products = {};
    if (!f.favs || typeof f.favs !== 'object') f.favs = {};
    if (!f.saved || typeof f.saved !== 'object') f.saved = {};
    if (!f.goals || typeof f.goals !== 'object') f.goals = {};
    for (const k in DEFAULT_GOALS) if (f.goals[k] == null) f.goals[k] = DEFAULT_GOALS[k];
    if (!f.goals.split || typeof f.goals.split !== 'object') f.goals.split = { ...DEFAULT_SPLIT };
    for (const k in DEFAULT_SPLIT) if (typeof f.goals.split[k] !== 'number') f.goals.split[k] = DEFAULT_SPLIT[k];
    return f;
  };
  const dayOf = (iso) => {
    const f = F();
    const d = f.days[iso] || (f.days[iso] = { meals: {}, water: 0 });
    for (const [k] of MEALS) if (!Array.isArray(d.meals[k])) d.meals[k] = [];
    if (typeof d.water !== 'number') d.water = 0;
    return d;
  };
  const peekDay = (iso) => F().days[iso];
  const hasFood = (d) => d && (MEALS.some(([k]) => (d.meals?.[k] || []).length) || d.water > 0);

  /* ---------------- Nutrients ---------------- */
  // k: our key · off: Open Food Facts nutriment key (stored in g per 100 g) · scale: g → display unit · ri: EU reference intake per day
  const N = (k, l, u, off, scale = 1, ri = null, sub = false, group = 'main', max = false) => ({ k, l, u, off, scale, ri, sub, group, max });
  const NUTRIENTS = [
    N('kcal', 'Calories', 'kcal', 'energy-kcal', 1),
    N('protein', 'Protein', 'g', 'proteins'),
    N('carbs', 'Carbohydrates', 'g', 'carbohydrates'),
    N('sugars', 'of which sugars', 'g', 'sugars', 1, 90, true, 'main', true),
    N('fiber', 'Fibre', 'g', 'fiber', 1, 30),
    N('fat', 'Fat', 'g', 'fat'),
    N('satfat', 'of which saturated', 'g', 'saturated-fat', 1, 20, true, 'main', true),
    N('monofat', 'monounsaturated', 'g', 'monounsaturated-fat', 1, null, true),
    N('polyfat', 'polyunsaturated', 'g', 'polyunsaturated-fat', 1, null, true),
    N('transfat', 'trans fat', 'g', 'trans-fat', 1, null, true),
    N('chol', 'Cholesterol', 'mg', 'cholesterol', 1000, 300, false, 'main', true),
    N('salt', 'Salt', 'g', 'salt', 1, 6, false, 'main', true),
    N('vita', 'Vitamin A', 'µg', 'vitamin-a', 1e6, 800, false, 'vit'),
    N('vitb1', 'Vitamin B1 (thiamin)', 'mg', 'vitamin-b1', 1000, 1.1, false, 'vit'),
    N('vitb2', 'Vitamin B2 (riboflavin)', 'mg', 'vitamin-b2', 1000, 1.4, false, 'vit'),
    N('vitb3', 'Vitamin B3 (niacin)', 'mg', 'vitamin-pp', 1000, 16, false, 'vit'),
    N('vitb6', 'Vitamin B6', 'mg', 'vitamin-b6', 1000, 1.4, false, 'vit'),
    N('vitb9', 'Folate (B9)', 'µg', 'vitamin-b9', 1e6, 200, false, 'vit'),
    N('vitb12', 'Vitamin B12', 'µg', 'vitamin-b12', 1e6, 2.5, false, 'vit'),
    N('vitc', 'Vitamin C', 'mg', 'vitamin-c', 1000, 80, false, 'vit'),
    N('vitd', 'Vitamin D', 'µg', 'vitamin-d', 1e6, 5, false, 'vit'),
    N('vite', 'Vitamin E', 'mg', 'vitamin-e', 1000, 12, false, 'vit'),
    N('vitk', 'Vitamin K', 'µg', 'vitamin-k', 1e6, 75, false, 'vit'),
    N('calcium', 'Calcium', 'mg', 'calcium', 1000, 800, false, 'min'),
    N('iron', 'Iron', 'mg', 'iron', 1000, 14, false, 'min'),
    N('magnesium', 'Magnesium', 'mg', 'magnesium', 1000, 375, false, 'min'),
    N('potassium', 'Potassium', 'mg', 'potassium', 1000, 2000, false, 'min'),
    N('zinc', 'Zinc', 'mg', 'zinc', 1000, 10, false, 'min'),
    N('phosphorus', 'Phosphorus', 'mg', 'phosphorus', 1000, 700, false, 'min'),
    N('sodium', 'Sodium', 'mg', 'sodium', 1000, null, false, 'min'),
  ];
  const NK = Object.fromEntries(NUTRIENTS.map((x) => [x.k, x]));
  const nfCache = {};
  const nfmt = (v, u) => {
    if (v == null) return '—';
    const d = u === 'kcal' || Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 || v === 0 ? 1 : 2;
    return (nfCache[d] ||= new Intl.NumberFormat('en-GB', { maximumFractionDigits: d })).format(v);
  };

  const productOf = (pid) => F().products[pid] || { id: pid, name: 'Unknown food', n: {} };
  // Nutrients for an entry (grams × per-100 g values)
  function entryN(e) {
    const p = productOf(e.pid), out = {};
    for (const x of NUTRIENTS) if (p.n[x.k] != null) out[x.k] = (p.n[x.k] * e.g) / 100;
    return out;
  }
  function sumN(entries) {
    const out = {}, known = {};
    for (const e of entries) {
      const n = entryN(e);
      for (const x of NUTRIENTS) if (n[x.k] != null) { out[x.k] = (out[x.k] || 0) + n[x.k]; known[x.k] = (known[x.k] || 0) + 1; }
    }
    return { n: out, known, count: entries.length };
  }
  const dayEntries = (d) => (d ? MEALS.flatMap(([k]) => d.meals?.[k] || []) : []);

  // Goals in grams (from % of calories or grams)
  function goalGrams() {
    const g = F().goals;
    if (g.mode === 'g') return { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat };
    return { kcal: g.kcal, protein: (g.kcal * g.protein / 100) / 4, carbs: (g.kcal * g.carbs / 100) / 4, fat: (g.kcal * g.fat / 100) / 9 };
  }

  // recommended kcal per meal, from the daily goal and the meal split
  function mealTarget(key) {
    const g = F().goals, sp = g.split, tot = Math.max(1, MEALS.reduce((a, [k]) => a + (sp[k] || 0), 0));
    return Math.round(g.kcal * (sp[key] || 0) / tot);
  }

  /* ---------------- Food types (for favourites) ---------------- */
  const CATS = [['fruitveg', 'Fruit & veg'], ['meatfish', 'Meat & fish'], ['dairy', 'Dairy & eggs'], ['grains', 'Bread, grains & potatoes'], ['plant', 'Plant protein & nuts'], ['snacks', 'Snacks & sweets'], ['drinks', 'Drinks'], ['other', 'Other']];
  const CAT_LABEL = Object.fromEntries(CATS);
  const NEVO_CAT = {
    'Vegetables': 'fruitveg', 'Fruits': 'fruitveg',
    'Meat and poultry': 'meatfish', 'Fish, crustacean and shellfish': 'meatfish', 'Cold meat cuts': 'meatfish',
    'Milk and milk products': 'dairy', 'Cheese': 'dairy', 'Eggs': 'dairy',
    'Bread': 'grains', 'Cereal products and types of flour': 'grains', 'Potatoes and tubers': 'grains',
    'Legumes': 'plant', 'Nuts and seeds': 'plant', 'Meat substitutes and dairy substitutes': 'plant',
    'Pastry and biscuits': 'snacks', 'Sugar, sweets and sweet sauces': 'snacks', 'Savoury snacks': 'snacks',
    'Non-alcoholic beverages': 'drinks', 'Alcoholic beverages': 'drinks',
  };
  const OFF_CAT = [
    ['drinks', /beverages|drinks|waters|juices|sodas|coffees|teas/],
    ['dairy', /dairies|dairy|cheeses|yogurts|yoghurts|milks|eggs|skyr|quark/],
    ['meatfish', /meats|poultr|chickens|fishes|seafood|hams|sausages/],
    ['plant', /meat-analogues|plant-based-foods-and-beverages.*protein|legumes|nuts|seeds|tofu|peanut/],
    ['snacks', /snacks|sweets|biscuits|chocolates|confectioner|desserts|candies|cakes|ice-creams|crisps|chips/],
    ['grains', /cereals|breads|pastas|rices|potatoes|flours|oats|muesli|granola/],
    ['fruitveg', /fruits|vegetables|salads/],
  ];
  function catFromTags(tags) {
    const t = (tags || []).join(' ');
    for (const [k, re] of OFF_CAT) if (re.test(t)) return k;
    return 'other';
  }
  const isFav = (pid) => !!F().favs[pid];
  function toggleFav(p) {
    const f = F();
    if (f.favs[p.id]) { delete f.favs[p.id]; saveNow(); toast('Removed from favourites'); return false; }
    if (!f.products[p.id]) f.products[p.id] = p;
    f.favs[p.id] = { cat: CAT_LABEL[p.cat] ? p.cat : 'other', at: Date.now() };
    saveNow(); toast('Added to favourites');
    return true;
  }
  // Breakfast in the morning, lunch around noon...: the meal a favourite goes to by default
  function mealNow() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
  }

  /* ---------------- NEVO (Dutch food composition table, RIVM) ---------------- */
  // Basic foods (fruit, rice, chicken...). Bundled, so it works instantly and offline.
  // Source: NEVO-online versie 2025/9.0, RIVM, Bilthoven. Values unchanged; salt = sodium × 2.5 is our addition.
  const NEVO_CREDIT = 'NEVO-online versie 2025/9.0, RIVM, Bilthoven';
  const fold = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let nevoP = null;
  function loadNevo() {
    return nevoP ||= fetch('nevo.json').then((r) => { if (!r.ok) throw new Error('nevo'); return r.json(); }).then((d) => d.foods.map((row) => {
      const [code, nl, en, syn, grp, ml, ...v] = row;
      const n = {};
      d.keys.forEach((k, i) => { if (v[i] != null) n[k] = v[i]; });
      if (n.sodium != null) n.salt = Math.round(n.sodium * 2.5) / 1000;
      return { p: { id: 'nevo:' + code, name: nl, brand: 'NEVO', img: '', serving: null, n, src: 'nevo', cat: NEVO_CAT[grp] || 'other', ...(ml ? { ml: 1 } : {}) }, name: fold(nl), hay: fold(`${nl} ${syn} ${en}`) };
    })).catch((e) => { nevoP = null; throw e; });
  }
  async function searchNevo(q) {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const list = await loadNevo();
    const hits = [];
    for (const f of list) {
      if (!words.every((w) => f.hay.includes(w))) continue;
      let score = 0;
      if (f.name.startsWith(words[0])) score += 6;
      if (f.name === words[0] || f.name.startsWith(words[0] + ' ')) score += 4;
      if (f.name === words.join(' ')) score += 5;
      for (const w of words) { if (new RegExp('(^|[\\s/(-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(f.name)) score += 3; else if (f.name.includes(w)) score += 1; }
      if (/\brauw\b|\bonbereid\b/.test(f.name)) score += 0.5;
      score -= f.name.length / 60;
      hits.push([score, f.p]);
    }
    return hits.sort((a, b) => b[0] - a[0]).slice(0, 25).map((h) => h[1]);
  }

  /* ---------------- Open Food Facts ---------------- */
  function fromOFF(p) {
    const nut = p.nutriments || {};
    const n = {};
    for (const x of NUTRIENTS) {
      const v = nut[x.off + '_100g'];
      if (v != null && v !== '' && Number.isFinite(+v)) n[x.k] = Math.round(+v * x.scale * 1000) / 1000;
    }
    if (n.kcal == null && Number.isFinite(+nut['energy_100g'])) n.kcal = Math.round(+nut['energy_100g'] / 4.184);
    const name = p.product_name_nl || p.product_name_en || p.product_name || p.generic_name || 'Unnamed product';
    const brand = Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || '').split(',')[0];
    return { id: 'off:' + p.code, code: p.code, name: String(name).trim(), brand: String(brand || '').trim(), img: p.image_front_small_url || p.image_small_url || '', serving: Number(p.serving_quantity) > 0 ? Math.round(+p.serving_quantity) : null, n, src: 'off', cat: catFromTags(p.categories_tags) };
  }
  const OFF_FIELDS = 'code,product_name,product_name_nl,product_name_en,generic_name,brands,serving_quantity,nutriments,image_front_small_url,image_small_url,categories_tags';
  async function lookupBarcode(code) {
    const known = F().products['off:' + code] || Object.values(F().products).find((p) => p.code === code);
    if (known) return known;
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${OFF_FIELDS}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.status !== 1 || !d.product) return null;
    return fromOFF({ ...d.product, code: d.product.code || code });
  }
  // Name search. The search servers are sometimes busy ("temporarily unavailable"), so try a few
  // of them with short pauses. The Belgian and Dutch sites show local products first.
  const SEARCH_FIELDS = 'code,product_name,product_name_nl,brands,serving_quantity,nutriments,image_front_small_url,categories_tags';
  async function searchOFF(q, stale = () => false) {
    const hosts = ['be', 'nl', 'be', 'world', 'nl', 'be'];
    for (let i = 0; i < hosts.length; i++) {
      if (stale()) throw new Error('stale');
      try {
        const r = await fetch(`https://${hosts[i]}.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${SEARCH_FIELDS}`);
        if (r.ok) {
          const d = await r.json();
          return (d.products || []).filter((p) => p.code && (p.product_name || p.product_name_nl)).map(fromOFF).filter((p) => p.n.kcal != null);
        }
      } catch { /* busy or offline: try again */ }
      if (!navigator.onLine) break;
      await new Promise((res) => setTimeout(res, 350 + i * 250));
    }
    throw new Error(navigator.onLine ? 'busy' : 'offline');
  }

  /* ---------------- Saving ---------------- */
  let saveTimer;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => core.save(), 300); };
  const saveNow = () => { clearTimeout(saveTimer); core.save(); };

  /* ---------------- View: Diary ---------------- */
  const fui = { day: null, cal: false, calMonth: null, open: new Set(['breakfast', 'lunch', 'dinner', 'snack']), favCat: 'all' };
  const curDay = () => fui.day || todayISO();
  function dayLabel(iso) {
    const t = todayISO();
    if (iso === t) return 'Today';
    if (iso === addDays(t, -1)) return 'Yesterday';
    if (iso === addDays(t, 1)) return 'Tomorrow';
    return DF_WEEKDAY.format(new Date(iso + 'T12:00:00'));
  }
  const MF = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  function calHTML() {
    const sel = curDay(), today = todayISO();
    const month = fui.calMonth || sel.slice(0, 7);
    const first = month + '-01';
    const wd = (new Date(first + 'T12:00:00').getDay() + 6) % 7;
    const start = addDays(first, -wd);
    const next = toISO(new Date(+month.slice(0, 4), +month.slice(5, 7), 1));
    const prevM = toISO(new Date(+month.slice(0, 4), +month.slice(5, 7) - 2, 1)).slice(0, 7);
    const cells = [];
    for (let d = start; d < next || cells.length % 7; d = addDays(d, 1)) cells.push(d);
    return `<div class="card cal food-cal">
      <div class="cal__head">
        <button type="button" class="cal__nav" data-f="cal-month" data-m="${prevM}" aria-label="Previous month">‹</button>
        <div class="cal__title">${MF.format(new Date(first + 'T12:00:00'))}</div>
        <button type="button" class="cal__nav" data-f="cal-month" data-m="${next.slice(0, 7)}" aria-label="Next month">›</button>
      </div>
      <div class="cal__grid">
        ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="cal__dow">${x}</span>`).join('')}
        ${cells.map((d) => {
          const cls = ['cal__day', !d.startsWith(month) ? 'is-out' : '', d === sel ? 'has-wk' : '', d === today ? 'is-today' : ''].filter(Boolean).join(' ');
          return `<button type="button" class="${cls}" data-f="pick-day" data-d="${d}" aria-label="${fmtDate(d)}">${+d.slice(8)}${hasFood(peekDay(d)) && d !== sel ? '<i></i>' : ''}</button>`;
        }).join('')}
      </div>
    </div>`;
  }

  function ring(label, eaten, goal, cls) {
    const R = 34, C = 2 * Math.PI * R;
    const pct = goal > 0 ? eaten / goal : 0;
    const over = pct > 1.05;
    const dash = Math.min(1, pct) * C;
    return `<div class="ring ${cls}${over ? ' is-over' : ''}">
      <svg viewBox="0 0 84 84" aria-hidden="true"><circle class="ring__bg" cx="42" cy="42" r="${R}"/><circle class="ring__fg" cx="42" cy="42" r="${R}" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/></svg>
      <div class="ring__mid"><strong>${Math.round(eaten)}</strong><span>g</span></div>
      <div class="ring__label">${label}</div>
      <div class="ring__sub">${Math.round(eaten)} / ${Math.round(goal)} g</div>
    </div>`;
  }

  const thumb = (p) => `<span class="food-thumb" aria-hidden="true">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<span>${esc((p.name || '?').charAt(0))}</span>`}</span>`;
  const macroLine = (n) => `P ${nfmt(n.protein || 0, 'g')} · C ${nfmt(n.carbs || 0, 'g')} · F ${nfmt(n.fat || 0, 'g')}`;

  const prevLabel = () => (curDay() === todayISO() ? 'yesterday' : 'the day before');
  function copyPrev(meals) {
    const to = dayOf(curDay()), from = peekDay(addDays(curDay(), -1));
    if (!from) return 0;
    let n = 0;
    for (const k of meals) for (const e of from.meals[k] || []) { to.meals[k].push({ id: uid(), pid: e.pid, g: e.g }); n++; }
    for (const k of meals) if ((from.meals[k] || []).length) fui.open.add(k);
    saveNow();
    return n;
  }
  function mealHTML(key, label, d) {
    const list = d.meals[key];
    const sum = sumN(list).n;
    const open = fui.open.has(key);
    const target = mealTarget(key), eaten = Math.round(sum.kcal || 0);
    return `<div class="card meal${open ? ' is-open' : ''}">
      <button type="button" class="meal__head" data-f="toggle-meal" data-meal="${key}" aria-expanded="${open}">
        <span class="meal__name">${label}</span>
        <span class="meal__kcal">${Math.round(sum.kcal || 0)}<small> / ${target} kcal</small></span>
        <span class="meal__macros">${macroLine(sum)}</span>
        <span class="meal__bar${eaten > target * 1.1 && target ? ' is-over' : ''}" aria-hidden="true"><i style="width:${target ? Math.min(100, (eaten / target) * 100) : 0}%"></i></span>
        <svg class="meal__chev" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1.5 5 5 5-5"/></svg>
      </button>
      ${open ? `
        ${list.length ? `<div class="meal__list">${list.map((e) => {
          const p = productOf(e.pid), n = entryN(e);
          return `<button type="button" class="food-row" data-f="edit-entry" data-meal="${key}" data-id="${e.id}">
            ${thumb(p)}
            <span class="food-row__main"><span class="food-row__name">${esc(p.name)}</span><span class="food-row__sub">${p.brand ? esc(p.brand) + ' · ' : ''}${nfmt(e.g, 'g')} g</span></span>
            <span class="food-row__kcal">${Math.round(n.kcal || 0)}<small>kcal</small></span>
          </button>`;
        }).join('')}</div>
        <div class="meal__nutr">
          ${['protein', 'carbs', 'sugars', 'fat', 'satfat', 'fiber', 'salt'].map((k) => `<span><b>${nfmt(sum[k] || 0, 'g')} g</b> ${NK[k].sub ? NK[k].l.replace('of which ', '') : NK[k].l.toLowerCase()}</span>`).join('')}
        </div>` : '<p class="hint" style="margin:4px 0 8px">Nothing logged yet.</p>'}
        <div class="meal__actions">
          <button type="button" class="ex-card__add" data-f="add-food" data-meal="${key}">+ Add food</button>
          ${list.length ? `<button type="button" class="ex-card__add" data-f="meal-to-saved" data-meal="${key}">Save as meal</button>`
            : (() => { const prev = peekDay(addDays(curDay(), -1)); const n = prev ? (prev.meals[key] || []).length : 0; return n ? `<button type="button" class="ex-card__add" data-f="copy-prev" data-meal="${key}">Copy ${prevLabel()} (${n})</button>` : ''; })()}
        </div>` : ''}
    </div>`;
  }

  const GLASS = '<svg viewBox="0 0 24 32" aria-hidden="true"><path class="w-shape" d="M3 2h18l-2.2 26.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path class="w-fill" d="M4.6 12h14.8l-1.6 16.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/></svg>';
  const BOTTLE = '<svg viewBox="0 0 24 36" aria-hidden="true"><path class="w-shape" d="M9 1h6v4l3 4v24a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l3-4z"/><path class="w-fill" d="M7.5 15h9v18a.8.8 0 0 1-.8.8H8.3a.8.8 0 0 1-.8-.8z"/></svg>';
  function waterHTML(d) {
    const g = F().goals;
    const step = g.waterStep, goal = g.water;
    const slots = Math.max(1, Math.ceil(goal / step));
    const full = Math.floor(d.water / step);
    const shown = Math.max(slots, full + 1);
    const icon = g.container === 'bottle' ? BOTTLE : GLASS;
    return `<div class="card water">
      <div class="water__head"><span class="card__title">Water</span><span class="water__total"><strong>${fmt(d.water / 1000, 2)} L</strong> / ${fmt(goal / 1000, 1)} L</span></div>
      <div class="water__icons">${Array.from({ length: shown }, (_, i) => `<button type="button" class="water__icon${i < full ? ' is-full' : ''}${i === full ? ' is-next' : ''}" data-f="${i < full ? 'water-set' : 'water-add'}" data-n="${i}" aria-label="${i < full ? `Remove to ${i} × ${step} ml` : `Add ${step} ml`}">${icon}${i === full ? '<i>+</i>' : ''}</button>`).join('')}</div>
      <p class="hint" style="margin:8px 0 0">Tap the next ${g.container} to add ${step} ml. Tap a full one to go back to it. Change the size under Goals.</p>
    </div>`;
  }

  function renderDiary() {
    const el = viewEl('food');
    const iso = curDay();
    const d = peekDay(iso) || { meals: Object.fromEntries(MEALS.map(([k]) => [k, []])), water: 0 };
    for (const [k] of MEALS) d.meals[k] ||= [];
    const tot = sumN(dayEntries(d)).n;
    const gg = goalGrams();
    const kcal = tot.kcal || 0;
    const left = gg.kcal - kcal;
    el.innerHTML = `
      <div class="day-nav">
        <button type="button" class="cal__nav" data-f="day" data-d="${addDays(iso, -1)}" aria-label="Previous day">‹</button>
        <button type="button" class="day-nav__label" data-f="cal" aria-expanded="${fui.cal}">${esc(dayLabel(iso))}<svg viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1.5 5 5 5-5"/></svg></button>
        <button type="button" class="cal__nav" data-f="day" data-d="${addDays(iso, 1)}" aria-label="Next day">›</button>
      </div>
      ${fui.cal ? calHTML() : ''}
      <div class="card macros">
        <div class="kcal">
          <div class="kcal__nums"><strong>${Math.round(kcal)}</strong><span> / ${Math.round(gg.kcal)} kcal</span></div>
          <span class="kcal__left${left < 0 ? ' is-over' : ''}">${left >= 0 ? `${Math.round(left)} left` : `${Math.round(-left)} over`}</span>
        </div>
        <div class="kcal__bar"><span style="width:${Math.min(100, (kcal / Math.max(1, gg.kcal)) * 100)}%"></span></div>
        <div class="rings">
          ${ring('Protein', tot.protein || 0, gg.protein, 'ring--p')}
          ${ring('Carbs', tot.carbs || 0, gg.carbs, 'ring--c')}
          ${ring('Fat', tot.fat || 0, gg.fat, 'ring--f')}
        </div>
      </div>
      <div class="sum-row">
        ${(() => { const r = rateDay(iso); return `<button type="button" class="button day-sum${r && r.level ? ' rate--' + r.level : ''}" data-f="summary">${r && r.level ? `<span class="rate__dot"></span>${r.live ? 'So far: ' : ''}${RATE_LABEL[r.level]}` : 'Day summary'}</button>`; })()}
        <button type="button" class="button" data-f="stats">Week & month</button>
      </div>
      ${(() => {
        if (dayEntries(d).length) return '';
        const prev = peekDay(addDays(iso, -1)); const n = prev ? dayEntries(prev).length : 0;
        return n ? `<button type="button" class="button copy-day" data-f="copy-prev-day">Copy all of ${prevLabel()} · ${plural(n, 'food', 'foods')}</button>` : '';
      })()}
      ${MEALS.map(([k, l]) => mealHTML(k, l, d)).join('')}
      ${waterHTML(d)}
      <p class="hint" style="text-align:center">Food data: Open Food Facts (open database).</p>`;
  }

  /* ---------------- Sheet: week & month overview + maintenance ---------------- */
  const statsSheet = $('#foodStats');
  const st = { mode: 'week', anchor: null };
  const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00'); return addDays(iso, -((d.getDay() + 6) % 7)); };
  function periodDays() {
    const a = st.anchor || todayISO();
    let from, to;
    if (st.mode === 'week') { from = mondayOf(a); to = addDays(from, 6); }
    else { from = a.slice(0, 8) + '01'; const n = new Date(+a.slice(0, 4), +a.slice(5, 7), 0).getDate(); to = a.slice(0, 8) + String(n).padStart(2, '0'); }
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    return { from, to, days };
  }
  const DF_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const DF_DAYMON = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const dfmt = (iso, f) => f.format(new Date(iso + 'T12:00:00'));
  const RATE_COLOR = { good: 'var(--good)', ok: '#d9a441', poor: 'var(--bad)' };

  function weights(fromISO, toISO) {
    return (core.state.entries || []).filter((e) => e.values && e.values.weight != null && e.date >= fromISO && e.date <= toISO)
      .map((e) => ({ date: e.date, w: +e.values.weight })).filter((x) => Number.isFinite(x.w)).sort((a, b) => a.date.localeCompare(b.date));
  }
  // Maintenance = average intake − (weight change × 7700 kcal per kg), over the last 28 days
  function estimateMaintenance() {
    const to = todayISO(), from = addDays(to, -27);
    const logged = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (d === to && new Date().getHours() < 20) continue; // today isn't finished
      const e = dayEntries(peekDay(d));
      if (e.length) logged.push(sumN(e).n.kcal || 0);
    }
    const ws = weights(from, to);
    const span = ws.length >= 2 ? daysBetweenISO(ws[0].date, ws[ws.length - 1].date) : 0;
    const need = { days: logged.length, weighIns: ws.length, span };
    if (logged.length < 14 || ws.length < 3 || span < 10) return { ok: false, ...need };
    const t0 = ws[0].date;
    const xs = ws.map((x) => daysBetweenISO(t0, x.date)), ys = ws.map((x) => x.w);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / Math.max(1e-9, xs.reduce((a, x) => a + (x - mx) ** 2, 0)); // kg per day
    const intake = logged.reduce((a, b) => a + b, 0) / logged.length;
    const tdee = intake - slope * 7700;
    const current = my + slope * (xs[xs.length - 1] - mx);
    return { ok: true, ...need, intake, slope, tdee, current, ws, t0, mx, my, from, to };
  }
  function daysBetweenISO(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }

  function openStats() { st.mode = st.mode || 'week'; st.anchor = curDay(); renderStats(); statsSheet.showModal(); $('#foodStatsBody').scrollTop = 0; }
  function renderStats() {
    const { from, to, days } = periodDays();
    const today = todayISO();
    const gg = goalGrams();
    const rows = days.map((d) => {
      const e = dayEntries(peekDay(d));
      const n = e.length ? sumN(e).n : null;
      const r = e.length && d <= today ? rateDay(d) : null;
      return { d, n, level: r && !r.live ? r.level : null, live: r && r.live, future: d > today };
    });
    const logged = rows.filter((r) => r.n && !(r.d === today && r.live));
    const avg = (k) => (logged.length ? logged.reduce((a, r) => a + (r.n[k] || 0), 0) / logged.length : null);
    const cnt = { good: 0, ok: 0, poor: 0 };
    for (const r of rows) if (r.level) cnt[r.level]++;
    const rated = cnt.good + cnt.ok + cnt.poor;
    const label = st.mode === 'week' ? `${dfmt(from, DF_DAYMON)} – ${dfmt(to, DF_DAYMON)}` : dfmt(from, DF_MONTH);
    const pastDays = rows.filter((r) => !r.future).length;

    // bar chart: kcal per day, goal as a dashed line, bar colour = day rating
    const W = 343, H = 150, padB = 20, padT = 8, n = rows.length, gap = n > 10 ? 2 : 6;
    const bw = (W - gap * (n - 1)) / n;
    const maxV = Math.max(gg.kcal * 1.25, ...rows.map((r) => (r.n ? r.n.kcal || 0 : 0)));
    const y = (v) => padT + (H - padB - padT) * (1 - v / maxV);
    const bars = rows.map((r, i) => {
      const x = i * (bw + gap), v = r.n ? r.n.kcal || 0 : 0;
      const col = r.level ? RATE_COLOR[r.level] : 'var(--faint)';
      const lab = st.mode === 'week' ? 'MTWTFSS'[i] : (i % 7 === 0 ? String(i + 1) : '');
      return `<g class="st-bar" data-f="stats-day" data-d="${r.d}">
        <rect x="${x}" y="${padT}" width="${bw}" height="${H - padB - padT}" fill="transparent"/>
        ${v ? `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(2, H - padB - y(v))}" rx="${Math.min(4, bw / 2)}" fill="${col}"${r.live ? ' opacity=".5"' : ''}><title>${dfmt(r.d, DF_DAYMON)}: ${Math.round(v)} kcal</title></rect>` : `<rect x="${x}" y="${H - padB - 2}" width="${bw}" height="2" rx="1" fill="var(--border)"/>`}
        ${lab ? `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${lab}</text>` : ''}
      </g>`;
    }).join('');
    const chart = `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day">
      ${bars}<line x1="0" x2="${W}" y1="${y(gg.kcal)}" y2="${y(gg.kcal)}" class="st-goal"/><text x="${W}" y="${y(gg.kcal) - 4}" text-anchor="end" class="st-goal-t">goal ${nfmt(gg.kcal, 'kcal')}</text></svg>`;

    const tile = (v, unit, label, sub) => `<div class="st-tile"><strong>${v}</strong><small>${unit}</small><span>${label}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
    const kc = avg('kcal'), pr = avg('protein');
    $('#foodStatsBody').innerHTML = `
      <div class="segmented segmented--full" role="group" aria-label="Period" style="margin-bottom:12px">
        <button type="button" data-f="stats-mode" data-m="week" aria-pressed="${st.mode === 'week'}">Week</button>
        <button type="button" data-f="stats-mode" data-m="month" aria-pressed="${st.mode === 'month'}">Month</button>
      </div>
      <div class="day-nav" style="margin-bottom:12px">
        <button type="button" class="cal__nav" data-f="stats-step" data-s="-1" aria-label="Previous">‹</button>
        <span class="day-nav__label" style="pointer-events:none">${label}</span>
        <button type="button" class="cal__nav" data-f="stats-step" data-s="1" aria-label="Next"${to >= today ? ' disabled' : ''}>›</button>
      </div>
      <div class="st-tiles">
        ${tile(kc != null ? nfmt(kc, 'kcal') : '—', 'kcal', 'Avg per day', kc != null ? `${Math.round((kc / gg.kcal) * 100)}% of goal` : '')}
        ${tile(pr != null ? Math.round(pr) : '—', 'g', 'Avg protein', pr != null ? `${Math.round((pr / gg.protein) * 100)}% of goal` : '')}
        ${tile(`${logged.length}<small>/${pastDays}</small>`, '', 'Days logged', '')}
      </div>
      <div class="card st-card">
        <h3 class="section-title" style="margin:0 0 8px">Calories per day</h3>
        ${chart}
        <div class="st-legend"><span><i style="background:var(--good)"></i>Good</span><span><i style="background:#d9a441"></i>Average</span><span><i style="background:var(--bad)"></i>Poor</span><span><i class="dash"></i>Goal</span></div>
        <p class="hint" style="margin:6px 0 0">Tap a day to open it in your diary.</p>
      </div>
      <div class="card st-card">
        <h3 class="section-title" style="margin:0 0 10px">Day ratings</h3>
        ${rated ? `<div class="st-stack" role="img" aria-label="${cnt.good} good, ${cnt.ok} average, ${cnt.poor} poor">${['good', 'ok', 'poor'].filter((k) => cnt[k]).map((k) => `<i style="flex:${cnt[k]};background:${RATE_COLOR[k]}"></i>`).join('')}</div>
        <div class="st-counts">${['good', 'ok', 'poor'].map((k) => `<div><span class="rate__dot" style="--rc:${RATE_COLOR[k]}"></span><b>${cnt[k]}</b> ${RATE_LABEL[k].replace(' day', '').toLowerCase()}</div>`).join('')}</div>`
        : '<p class="hint" style="margin:0">No finished days with food logged in this period yet.</p>'}
        ${logged.length ? `<p class="st-macros">Avg macros: ${macroLine({ protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') })} g</p>` : ''}
      </div>
      ${maintenanceHTML()}`;
  }
  function maintenanceHTML() {
    const m = estimateMaintenance();
    const bulk = core.state.settings && core.state.settings.goalType === 'bulk';
    if (!m.ok) return `<div class="card st-card">
      <h3 class="section-title" style="margin:0 0 6px">Your maintenance calories</h3>
      <p class="prose" style="margin:0">Gainly can estimate how many calories you really burn by comparing what you eat with how your weight changes. It needs, in the last 4 weeks:</p>
      <ul class="st-need">
        <li class="${m.days >= 14 ? 'is-done' : ''}">14+ days with food logged <b>(${m.days})</b></li>
        <li class="${m.weighIns >= 3 ? 'is-done' : ''}">3+ weigh-ins under Body <b>(${m.weighIns})</b></li>
        <li class="${m.span >= 10 ? 'is-done' : ''}">at least 10 days between the first and last weigh-in <b>(${m.span})</b></li>
      </ul></div>`;
    const perWeek = m.slope * 7;
    const rate = bulk ? 0.0025 : -0.005; // bulk +0.25 % per week, cut −0.5 % per week
    const target = Math.round((m.tdee + (rate * m.current * 7700) / 7) / 10) * 10;
    // small weight chart with trend line
    const W = 343, H = 90, pad = 6;
    const xs = m.ws.map((x) => daysBetweenISO(m.from, x.date)), ys = m.ws.map((x) => x.w);
    const lo = Math.min(...ys) - 0.3, hi = Math.max(...ys) + 0.3;
    const X = (d) => pad + (W - 2 * pad) * (d / 27), Y = (v) => pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo));
    const t0 = daysBetweenISO(m.from, m.t0);
    const ty = (d) => m.my + m.slope * (d - t0 - m.mx);
    const spark = `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over the last 4 weeks">
      <line x1="${X(0)}" x2="${X(27)}" y1="${Y(ty(0))}" y2="${Y(ty(27))}" class="st-trend"/>
      ${xs.map((d, i) => `<circle cx="${X(d)}" cy="${Y(ys[i])}" r="4" class="st-dot"><title>${dfmt(m.ws[i].date, DF_DAYMON)}: ${fmt(ys[i], 1)} kg</title></circle>`).join('')}</svg>`;
    return `<div class="card st-card">
      <h3 class="section-title" style="margin:0 0 6px">Your maintenance calories</h3>
      <p class="st-big"><strong>≈ ${nfmt(Math.round(m.tdee / 10) * 10, 'kcal')}</strong> kcal per day</p>
      <p class="prose" style="margin:0 0 10px">Over the last 4 weeks you ate <b>${nfmt(m.intake, 'kcal')} kcal</b> a day on average and your weight went <b>${perWeek >= 0 ? '+' : '−'}${fmt(Math.abs(perWeek), 2)} kg per week</b>.</p>
      ${spark}
      <div class="st-suggest">
        <span>For your ${bulk ? 'bulk (+0.25 % of your weight per week)' : 'cut (−0.5 % of your weight per week)'}</span>
        <strong>${nfmt(target, 'kcal')} kcal per day</strong>
        <button type="button" class="button" data-f="use-kcal" data-k="${target}">Use as my daily goal (now ${nfmt(F().goals.kcal, 'kcal')})</button>
      </div>
      <p class="hint" style="margin:10px 0 0">Based on ${m.days} logged days and ${m.weighIns} weigh-ins. Days you didn’t log are assumed to be similar. Water weight makes this jump around at first; it gets more accurate the longer you log.</p>
    </div>`;
  }

  /* ---------------- Sheet: day summary ---------------- */
  const summarySheet = $('#foodSummary');
  /* ---------------- Day rating: good / average / poor ---------------- */
  // Each check scores 2 (good), 1 (okay) or 0 (off). Today, before 20:00, things that still count up
  // (calories, protein, water, fibre) aren't judged while they're below target: they show "to go".
  function rateDay(iso) {
    const d = peekDay(iso);
    const entries = dayEntries(d);
    if (!entries.length) return null;
    const { n, known, count } = sumN(entries);
    const gg = goalGrams(), g = F().goals;
    const live = iso === todayISO() && new Date().getHours() < 20;
    const has = (k) => n[k] != null && (known[k] || 0) >= Math.ceil(count * 0.6);
    const checks = [];
    const add = (label, detail, score, todo = false) => checks.push({ label, detail, score: todo ? null : score });
    const kc = n.kcal || 0, rk = kc / Math.max(1, gg.kcal);
    add('Calories', `${nfmt(kc, 'kcal')} of ${nfmt(gg.kcal, 'kcal')} kcal${live && rk < 0.9 ? ` · ${nfmt(gg.kcal - kc, 'kcal')} to go` : ''}`,
      Math.abs(rk - 1) <= 0.1 ? 2 : Math.abs(rk - 1) <= 0.2 ? 1 : 0, live && rk < 0.9);
    const rp = (n.protein || 0) / Math.max(1, gg.protein);
    add('Protein', `${nfmt(n.protein || 0, 'g')} of ${Math.round(gg.protein)} g`, rp >= 0.9 ? 2 : rp >= 0.7 ? 1 : 0, live && rp < 0.9);
    if (!live) {
      const off = ['carbs', 'fat'].filter((k) => Math.abs((n[k] || 0) / Math.max(1, gg[k]) - 1) > 0.25);
      add('Carbs & fat balance', off.length ? `${off.map((k) => `${NK[k].l.toLowerCase()} ${Math.round(((n[k] || 0) / Math.max(1, gg[k])) * 100)}%`).join(', ')} of goal` : 'Both close to your goal', 2 - off.length);
    }
    if (has('fiber')) add('Fibre', `${nfmt(n.fiber, 'g')} g · aim for 25+ g`, n.fiber >= 25 ? 2 : n.fiber >= 15 ? 1 : 0, live && n.fiber < 25);
    if (has('sugars')) add('Sugars', `${nfmt(n.sugars, 'g')} g · max 90 g`, n.sugars <= 90 ? 2 : n.sugars <= 120 ? 1 : 0);
    if (has('satfat')) add('Saturated fat', `${nfmt(n.satfat, 'g')} g · max 20 g`, n.satfat <= 20 ? 2 : n.satfat <= 26 ? 1 : 0);
    if (has('salt')) add('Salt', `${nfmt(n.salt, 'g')} g · max 6 g`, n.salt <= 6 ? 2 : n.salt <= 8 ? 1 : 0);
    const w = d?.water || 0, rw = w / Math.max(1, g.water);
    add('Water', `${fmt(w / 1000, 2)} of ${fmt(g.water / 1000, 1)} L`, rw >= 1 ? 2 : rw >= 0.7 ? 1 : 0, live && rw < 1);
    const judged = checks.filter((c) => c.score != null);
    if (!judged.length) return { level: null, live, checks };
    const pct = judged.reduce((a, c) => a + c.score, 0) / (judged.length * 2);
    return { level: pct >= 0.75 ? 'good' : pct >= 0.5 ? 'ok' : 'poor', live, checks };
  }
  const RATE_LABEL = { good: 'Good day', ok: 'Average day', poor: 'Poor day' };
  function rateHTML(r) {
    if (!r) return '';
    const icon = (c) => (c.score == null ? '<i class="rate-i is-todo">…</i>' : c.score === 2 ? '<i class="rate-i is-good">✓</i>' : c.score === 1 ? '<i class="rate-i is-ok">~</i>' : '<i class="rate-i is-poor">✕</i>');
    return `<div class="rate rate--${r.level || 'none'}">
      <div class="rate__head"><span class="rate__dot"></span><strong>${r.level ? (r.live ? 'So far: ' : '') + RATE_LABEL[r.level] : 'Too early to tell'}</strong></div>
      <ul class="rate__list">${r.checks.map((c) => `<li>${icon(c)}<span><b>${c.label}</b><small>${c.detail}</small></span></li>`).join('')}</ul>
      ${r.live ? '<p class="hint" style="margin:8px 0 0">The day isn’t over yet: what still counts up (calories, protein, water) is judged from 20:00.</p>' : ''}
    </div>`;
  }

  function openSummary() {
    const iso = curDay();
    const d = peekDay(iso);
    const entries = dayEntries(d);
    const { n, known, count } = sumN(entries);
    const gg = goalGrams();
    const row = (x) => {
      const v = n[x.k];
      const target = x.k === 'kcal' ? gg.kcal : x.k === 'protein' ? gg.protein : x.k === 'carbs' ? gg.carbs : x.k === 'fat' ? gg.fat : x.ri;
      const pct = target && v != null ? Math.round((v / target) * 100) : null;
      const partial = count && (known[x.k] || 0) < count && v != null;
      return `<div class="nut-row${x.sub ? ' is-sub' : ''}">
        <span class="nut-row__name">${x.l}${partial ? ' <i title="Not every food has this value">*</i>' : ''}</span>
        <span class="nut-row__val">${v == null ? '—' : `${nfmt(v, x.u)} ${x.u}`}</span>
        ${target ? `<span class="nut-row__bar${x.max && pct > 100 ? ' is-over' : ''}"><i style="width:${Math.min(100, pct || 0)}%"></i></span><span class="nut-row__pct">${pct != null ? pct + '%' : ''}</span>` : '<span></span><span></span>'}
      </div>`;
    };
    const sec = (title, group) => `<h3 class="section-title" style="margin:16px 0 6px">${title}</h3><div class="nut-table">${NUTRIENTS.filter((x) => x.group === group).map(row).join('')}</div>`;
    $('#foodSummaryBody').innerHTML = `
      <h2 class="rv-title">${esc(dayLabel(iso))}</h2>
      <p class="eyebrow" style="margin-bottom:8px">${fmtDate(iso)} · ${plural(count, 'food', 'foods')} · water ${fmt((d?.water || 0) / 1000, 2)} L</p>
      ${rateHTML(rateDay(iso))}
      ${sec('Energy & macronutrients', 'main')}
      ${sec('Vitamins', 'vit')}
      ${sec('Minerals', 'min')}
      <p class="hint" style="margin-top:14px">Percentages are of your goals (calories, macros) or of the EU reference intake. For sugars, saturated fat, salt and cholesterol it’s a maximum. * = not every food has this value, so the real total is likely higher. Many products on Open Food Facts don’t list vitamins and minerals.</p>`;
    summarySheet.showModal();
    $('#foodSummaryBody').scrollTop = 0;
  }

  /* ---------------- Sheet: add food (search / recent / my foods / scan) ---------------- */
  const addSheet = $('#foodAdd');
  const fa = { meal: 'breakfast', q: '', results: null, busy: false, tab: 'recent', err: '', nevo: null, mine: null };
  function recentProducts() {
    const seen = new Map();
    for (const iso of Object.keys(F().days).sort().reverse()) {
      for (const e of dayEntries(F().days[iso])) if (!seen.has(e.pid)) seen.set(e.pid, e.g);
      if (seen.size >= 40) break;
    }
    return [...seen.keys()].map(productOf).filter((p) => p.n);
  }
  function openAdd(meal, { builder = false } = {}) {
    Object.assign(fa, { meal, builder, q: '', results: null, busy: false, err: '', tab: 'recent', nevo: null, mine: null });
    $('#foodAddTitle').textContent = builder ? `Add to ${mb.name.trim() || 'meal'}` : `Add to ${MEALS.find(([k]) => k === meal)[1]}`;
    $('#foodAddBody').innerHTML = '';
    renderAdd();
    addSheet.showModal();
  }
  const prodRow = (p) => `<button type="button" class="food-row" data-f="pick-product" data-pid="${esc(p.id)}">
    ${thumb(p)}
    <span class="food-row__main"><span class="food-row__name">${esc(p.name)}</span><span class="food-row__sub">${p.brand ? esc(p.brand) + ' · ' : ''}${nfmt(p.n.kcal, 'kcal')} kcal per 100 ${p.ml ? 'ml' : 'g'}</span></span>${chev}
  </button>`;
  let resultCache = new Map();
  function renderAdd() {
    const own = Object.values(F().products).filter((p) => p.src === 'own').sort((a, b) => a.name.localeCompare(b.name));
    let list;
    const searching = fa.nevo != null || fa.busy || fa.results || fa.err;
    const hint = (t) => `<p class="hint" style="text-align:center;padding:14px 0">${t}</p>`;
    const sec = (title, items) => `<h3 class="fa-sec">${title}</h3><div class="list">${items.map(prodRow).join('')}</div>`;
    if (searching) {
      const mine = fa.mine || [], nevo = fa.nevo || [];
      const parts = [];
      if (mine.length) parts.push(sec('Saved', mine));
      if (nevo.length) parts.push(sec('Basic foods', nevo));
      let off;
      if (fa.busy) off = hint('Searching Open Food Facts…');
      else if (fa.err) off = hint(esc(fa.err));
      else if (fa.results && fa.results.length) off = `<div class="list">${fa.results.map(prodRow).join('')}</div>`;
      else off = hint('No branded products found.');
      if (fa.q.length < 3 && !mine.length && !nevo.length) list = hint('Keep typing…');
      else if (fa.q.length < 3) list = parts.join('');
      else if (!mine.length && !nevo.length && fa.results && !fa.results.length) list = hint('Nothing found. Try other words, scan the barcode, or create the food yourself.');
      else list = parts.join('') + `<h3 class="fa-sec">Products</h3>${off}`;
    } else {
      const hintP = (t) => `<p class="hint" style="text-align:center;padding:20px 0">${t}</p>`;
      const favs = Object.entries(F().favs).sort((a, b) => b[1].at - a[1].at).map(([pid]) => productOf(pid));
      const src = fa.tab === 'own' ? own : fa.tab === 'favs' ? favs : recentProducts();
      if (fa.tab === 'meals') {
        const sm = savedList();
        list = sm.length ? `<div class="list">${sm.map((m) => `<button type="button" class="food-row" data-f="saved-quick" data-id="${m.id}">
          <span class="food-thumb" aria-hidden="true"><span>${esc(m.name.charAt(0) || '?')}</span></span>
          <span class="food-row__main"><span class="food-row__name">${esc(m.name)}</span><span class="food-row__sub">${plural(m.items.length, 'food', 'foods')} · ${nfmt(savedTotals(m).kcal || 0, 'kcal')} kcal</span></span><span class="food-row__kcal">+</span>
        </button>`).join('')}</div>` : hintP('Save a meal from your diary or create one under Nutrition › Meals.');
      } else list = src.length ? `<div class="list">${src.map(prodRow).join('')}</div>` : `<p class="hint" style="text-align:center;padding:20px 0">${fa.tab === 'own' ? 'Foods you create yourself show up here.' : fa.tab === 'favs' ? 'Tap the star on a food to add it to your favourites.' : 'Foods you log show up here, so you can add them again in one tap.'}</p>`;
    }
    const dyn = `
      ${searching ? `<button type="button" class="inline-link" data-f="clear-search" style="margin:10px 2px 0;text-decoration:none">‹ Back to recent</button>` : `<div class="segmented segmented--full" role="group" aria-label="List" style="margin-top:12px">
        <button type="button" data-f="add-tab" data-t="recent" aria-pressed="${fa.tab === 'recent'}">Recent</button>
        <button type="button" data-f="add-tab" data-t="favs" aria-pressed="${fa.tab === 'favs'}">Favourites</button>
        ${fa.builder ? '' : `<button type="button" data-f="add-tab" data-t="meals" aria-pressed="${fa.tab === 'meals'}">Meals</button>`}
        <button type="button" data-f="add-tab" data-t="own" aria-pressed="${fa.tab === 'own'}">My foods</button>
      </div>`}
      <div style="margin-top:12px">${list}</div>`;
    const live = $('#faDyn');
    if (live && $('#foodSearchForm')) { live.innerHTML = dyn; return; }
    $('#foodAddBody').innerHTML = `
      <form class="food-search" id="foodSearchForm">
        <input class="search" type="search" name="q" placeholder="Search a food or brand" value="${esc(fa.q)}" enterkeyhint="search" aria-label="Search food">
        <button type="button" class="food-scan" data-f="scan" aria-label="Scan barcode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>Scan</button>
      </form>
      <div id="faDyn">${dyn}</div>
      <button type="button" class="button" data-f="new-product" style="margin-top:14px">+ Create a food</button>
      <p class="hint" style="text-align:center;margin-top:10px">Basic foods: ${NEVO_CREDIT}.<br>Products and barcodes: Open Food Facts.</p>`;
  }
  // Search while typing: saved + basic foods (NEVO) update on every key, Open Food Facts after a short pause
  let searchSeq = 0, offTimer = 0;
  async function runSearch(q, { now = false } = {}) {
    q = q.trim();
    const seq = ++searchSeq;
    clearTimeout(offTimer);
    if (!q) { Object.assign(fa, { q: '', results: null, err: '', busy: false, nevo: null, mine: null }); return renderAdd(); }
    const words = fold(q).split(/\s+/).filter(Boolean);
    const mine = Object.values(F().products).filter((p) => { const h = fold(p.name + ' ' + (p.brand || '')); return words.every((w) => h.includes(w)); });
    let nevo = [];
    if (q.length >= 2) try { nevo = (await searchNevo(q)).filter((p) => !F().products[p.id]); } catch { /* offline before first load */ }
    if (seq !== searchSeq) return;
    resultCache = new Map(nevo.map((p) => [p.id, p]));
    const offOk = q.length >= 3;
    Object.assign(fa, { q, busy: offOk, err: '', results: offOk ? null : [], mine, nevo });
    renderAdd();
    if (!offOk) return;
    offTimer = setTimeout(async () => {
      try {
        const res = await searchOFF(q, () => seq !== searchSeq);
        if (seq !== searchSeq) return;
        for (const p of res) resultCache.set(p.id, p);
        fa.results = res.filter((p) => !F().products[p.id]);
      } catch (e) {
        if (seq !== searchSeq) return;
        fa.err = e.message === 'offline'
          ? 'Branded products need an internet connection.'
          : 'Open Food Facts is busy right now, so branded products are missing. Try again in a moment, or scan the barcode.';
      }
      fa.busy = false;
      renderAdd();
    }, now ? 0 : 650);
  }

  /* ---------------- Sheet: amount (add / edit an entry) ---------------- */
  const amountSheet = $('#foodAmount');
  const fam = { pid: null, meal: 'breakfast', g: 100, entryId: null, iso: null };
  function openAmount({ product, meal, g, entryId = null }) {
    if (!F().products[product.id]) resultCache.set(product.id, product);
    Object.assign(fam, { pid: product.id, meal, g: g ?? (product.serving || 100), entryId, iso: curDay(), builder: !!fa.builder && addSheet.open });
    renderAmount();
    amountSheet.showModal();
  }
  const pendingProduct = () => F().products[fam.pid] || resultCache.get(fam.pid) || productOf(fam.pid);
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17l-5.38 2.85 1.03-6L3.3 9.6l6-.9z"/></svg>';
  function renderAmount() {
    const p = pendingProduct();
    const n = {};
    for (const x of NUTRIENTS) if (p.n[x.k] != null) n[x.k] = (p.n[x.k] * (fam.g || 0)) / 100;
    $('#foodAmountTitle').textContent = fam.entryId ? 'Edit food' : 'Add food';
    $('#foodAmountBody').innerHTML = `
      <div class="fa-head">${thumb(p)}<div><h2 class="fa-name">${esc(p.name)}</h2><p class="eyebrow">${p.brand ? esc(p.brand) + ' · ' : ''}${nfmt(p.n.kcal, 'kcal')} kcal / 100 ${p.ml ? 'ml' : 'g'}</p></div>
        <button type="button" class="fav-btn" data-f="fav-toggle" aria-pressed="${isFav(p.id)}" aria-label="${isFav(p.id) ? 'Remove from favourites' : 'Add to favourites'}">${STAR}</button></div>
      ${isFav(p.id) ? `<label class="fav-type"><span>Favourite type</span><select data-fin="fav-cat">${CATS.map(([k, l]) => `<option value="${k}"${F().favs[p.id].cat === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span class="field__label">Amount <small>grams (or ml)</small></span>
        <input data-fin="grams" inputmode="decimal" value="${fam.g != null ? fmt(fam.g, fam.g % 1 ? 1 : 0) : ''}" aria-label="Amount in grams"></label>
      <div class="chips" style="margin:-4px 0 12px">
        ${p.serving ? `<button type="button" class="chip" data-f="set-g" data-g="${p.serving}">1 serving (${p.serving} g)</button>` : ''}
        ${[50, 100, 150, 200].map((x) => `<button type="button" class="chip" data-f="set-g" data-g="${x}">${x} g</button>`).join('')}
      </div>
      ${fam.builder ? '' : `<div class="segmented segmented--full" role="group" aria-label="Meal" style="margin-bottom:14px">
        ${MEALS.map(([k, l]) => `<button type="button" data-f="set-meal" data-meal="${k}" aria-pressed="${fam.meal === k}">${l}</button>`).join('')}
      </div>`}
      <div class="fa-kcal"><strong id="faKcal">${Math.round(n.kcal || 0)}</strong> kcal</div>
      <div class="fa-macros" id="faMacros">${['protein', 'carbs', 'fat'].map((k) => `<div><span>${NK[k].l}</span><strong>${nfmt(n[k] || 0, 'g')} g</strong></div>`).join('')}</div>
      <div class="nut-table" id="faTable" style="margin-top:10px">${['sugars', 'fiber', 'satfat', 'salt'].map((k) => `<div class="nut-row is-compact"><span class="nut-row__name">${NK[k].sub ? NK[k].l.replace('of which ', '') : NK[k].l}</span><span class="nut-row__val">${n[k] != null ? nfmt(n[k], 'g') + ' g' : '—'}</span></div>`).join('')}</div>
      ${canShare(p) ? `<button type="button" class="button" data-f="share-off" style="margin-top:12px;width:100%">Share on Open Food Facts</button>` : ''}
      <button type="button" class="button button--primary" data-f="save-entry" style="margin-top:16px">${fam.builder ? 'Add to meal' : fam.entryId ? 'Save' : 'Add to ' + MEALS.find(([k]) => k === fam.meal)[1]}</button>
      <div class="button-row" style="margin-top:10px">
        <button type="button" class="button" data-f="edit-product">Edit food values</button>
        ${fam.entryId ? '<button type="button" class="button button--danger" data-f="del-entry">Remove</button>' : '<span></span>'}
      </div>`;
  }
  function updateAmountNumbers() {
    const p = pendingProduct();
    const val = (k) => (p.n[k] != null ? (p.n[k] * (fam.g || 0)) / 100 : null);
    const k = $('#faKcal'); if (k) k.textContent = Math.round(val('kcal') || 0);
    const m = $('#faMacros'); if (m) m.innerHTML = ['protein', 'carbs', 'fat'].map((x) => `<div><span>${NK[x].l}</span><strong>${nfmt(val(x) || 0, 'g')} g</strong></div>`).join('');
    const t = $('#faTable'); if (t) t.innerHTML = ['sugars', 'fiber', 'satfat', 'salt'].map((x) => `<div class="nut-row is-compact"><span class="nut-row__name">${NK[x].sub ? NK[x].l.replace('of which ', '') : NK[x].l}</span><span class="nut-row__val">${val(x) != null ? nfmt(val(x), 'g') + ' g' : '—'}</span></div>`).join('');
  }
  function saveEntry() {
    if (!(fam.g > 0)) { toast('Enter an amount'); return; }
    const f = F();
    const p = pendingProduct();
    if (!f.products[p.id]) f.products[p.id] = p;
    if (fam.builder) {
      mb.items.push({ pid: p.id, g: fam.g });
      saveNow(); amountSheet.close(); if (addSheet.open) addSheet.close();
      renderMealBuilder(); toast(`${p.name} added`);
      return;
    }
    const d = dayOf(fam.iso);
    if (fam.entryId) {
      for (const [k] of MEALS) d.meals[k] = d.meals[k].filter((e) => e.id !== fam.entryId);
      d.meals[fam.meal].push({ id: fam.entryId, pid: p.id, g: fam.g });
    } else d.meals[fam.meal].push({ id: uid(), pid: p.id, g: fam.g });
    fui.open.add(fam.meal);
    saveNow();
    amountSheet.close();
    if (addSheet.open) addSheet.close();
    toast(fam.entryId ? 'Saved' : `${p.name} added`);
    core.render();
  }

  /* ---------------- Sheet: create / edit a food ---------------- */
  const productSheet = $('#foodProduct');
  let fp = null;
  const EDIT_KEYS = ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satfat', 'fiber', 'salt'];

  /* ---------------- Share own foods on Open Food Facts ---------------- */
  // The account lives in its own key on this device only: never in state, backups or exports.
  const OFF_KEY = 'gainly:off';
  // Only the username is kept on this iPhone; the password is asked each time you share (iOS can fill it in).
  const offAccount = () => { try { const a = JSON.parse(localStorage.getItem(OFF_KEY) || 'null'); return a && a.user ? { user: a.user } : null; } catch { return null; } };
  try { const a = JSON.parse(localStorage.getItem(OFF_KEY) || 'null'); if (a && a.pass) localStorage.setItem(OFF_KEY, JSON.stringify({ user: a.user })); } catch { /* ok */ }
  function askOffPassword(user) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'confirm';
      dlg.innerHTML = `<form method="dialog" class="off-pass" autocomplete="on">
        <p class="confirm__msg" style="margin-bottom:12px">Open Food Facts password for <b>${esc(user)}</b></p>
        <input type="text" name="username" autocomplete="username" value="${esc(user)}" hidden readonly>
        <input class="search" type="password" name="password" autocomplete="current-password" placeholder="Password" required>
        <p class="hint" style="margin:8px 0 12px">Only used for this upload, not stored by Gainly.</p>
        <div class="button-row"><button type="button" class="button" value="cancel">Cancel</button><button type="submit" class="button button--primary" value="ok">Share</button></div>
      </form>`;
      document.body.append(dlg);
      const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
      dlg.querySelector('[value="cancel"]').addEventListener('click', () => done(null));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
      dlg.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const v = dlg.querySelector('[name="password"]').value; done(v || null); });
      dlg.showModal();
      setTimeout(() => dlg.querySelector('[name="password"]').focus(), 50);
    });
  }
  const validCode = (c) => /^\d{8,14}$/.test(String(c || ''));
  const canShare = (p) => p && p.src === 'own' && validCode(p.code) && !p.offShared;
  async function shareOFF(p) {
    const acc = offAccount();
    if (!acc) { toast('Add your Open Food Facts account under Goals first'); return false; }
    if (!validCode(p.code)) { toast('This food needs a barcode to share it'); return false; }
    if (!navigator.onLine) { toast('Sharing needs an internet connection'); return false; }
    try {
      // Never overwrite someone else's product
      const ex = await fetch(`https://world.openfoodfacts.org/api/v2/product/${p.code}?fields=code,product_name`).then((r) => r.json()).catch(() => null);
      if (ex && ex.status === 1) { toast('This barcode is already on Open Food Facts'); return false; }
      const pass = await askOffPassword(acc.user);
      if (!pass) return false;
      const body = new URLSearchParams({
        code: p.code, user_id: acc.user, password: pass,
        product_name: p.name, lc: 'nl', nutrition_data_per: '100g',
        comment: 'Added with Gainly', app_name: 'Gainly',
      });
      if (p.brand) body.set('brands', p.brand);
      if (p.serving) body.set('serving_size', `${p.serving} g`);
      for (const k of EDIT_KEYS) {
        if (p.n[k] == null) continue;
        body.set(`nutriment_${NK[k].off}`, String(p.n[k]));
        body.set(`nutriment_${NK[k].off}_unit`, NK[k].u);
      }
      const r = await fetch('https://world.openfoodfacts.org/cgi/product_jqm2.pl', { method: 'POST', body });
      const d = await r.json().catch(() => ({}));
      if (d.status === 1) {
        const saved = F().products[p.id];
        if (saved) saved.offShared = Date.now();
        p.offShared = Date.now();
        saveNow();
        toast('Shared on Open Food Facts. Thanks!');
        return true;
      }
      const why = String(d.status_verbose || '');
      toast(/user|password|credential/i.test(why) ? 'Open Food Facts didn’t accept your username or password' : `Open Food Facts said: ${why || 'something went wrong'}`);
    } catch {
      toast('Couldn’t reach Open Food Facts. Try again later.');
    }
    return false;
  }
  function openProduct(p, { code = '', afterSave = null, copyOf = null } = {}) {
    fp = p ? { ...p, n: { ...p.n } } : { id: 'own:' + uid(), name: fa.q || '', brand: '', code, img: '', serving: null, n: {}, src: 'own' };
    fp.share = !fp.offShared && !!offAccount() && validCode(fp.code);
    fp.afterSave = afterSave;
    $('#foodProductTitle').textContent = copyOf ? 'Your own copy' : p ? 'Edit food' : 'New food';
    $('#foodProductBody').innerHTML = `
      ${copyOf ? '<p class="hint" style="margin:0 0 12px">Values from NEVO (RIVM) can’t be changed, so this saves your own copy under My foods. The original stays as it is.</p>' : ''}
      <label class="field"><span class="field__label">Name</span><input data-fin="p-name" value="${esc(fp.name)}" placeholder="E.g. Chicken breast" autocomplete="off"></label>
      <div class="field-grid">
        <label class="field"><span class="field__label">Brand <small>optional</small></span><input data-fin="p-brand" value="${esc(fp.brand || '')}" autocomplete="off"></label>
        <label class="field"><span class="field__label">Serving <small>g</small></span><input data-fin="p-serving" inputmode="decimal" value="${fp.serving || ''}" placeholder="—"></label>
      </div>
      <h3 class="section-title" style="margin:6px 0 10px">Per 100 g</h3>
      <div class="field-grid">
        ${EDIT_KEYS.map((k) => `<label class="field"><span class="field__label">${NK[k].sub ? NK[k].l.replace('of which ', '') : NK[k].l} <small>${NK[k].u}</small></span><input data-fin="n-${k}" inputmode="decimal" value="${fp.n[k] != null ? fmt(fp.n[k], fp.n[k] % 1 ? 1 : 0) : ''}" placeholder="0"></label>`).join('')}
      </div>
      ${fp.src === 'own' ? `<label class="field"><span class="field__label">Barcode <small>optional, the number under the bars</small></span><input data-fin="p-code" inputmode="numeric" value="${esc(fp.code || '')}" placeholder="—" autocomplete="off"></label>
      ${fp.offShared ? '<p class="hint">✓ Shared on Open Food Facts.</p>' : `<label class="check-row"><input type="checkbox" data-fin="p-share"${fp.share ? ' checked' : ''}><span><b>Share on Open Food Facts</b><small>${offAccount() ? 'Adds this food to the open database for everyone, if the barcode isn’t there yet.' : 'Add your Open Food Facts account under Nutrition › Goals to use this.'}</small></span></label>`}` : (fp.code ? `<p class="hint">Barcode ${esc(fp.code)}</p>` : '')}
      ${p && p.src === 'own' && !copyOf ? '<button type="button" class="button button--danger" data-f="del-product" style="margin-top:6px">Delete this food</button>' : ''}`;
    productSheet.showModal();
  }
  function saveProduct() {
    if (!fp.name.trim()) { toast('Give the food a name'); productSheet.querySelector('[data-fin="p-name"]').focus(); return; }
    if (fp.n.kcal == null) { toast('Enter the calories per 100 g'); productSheet.querySelector('[data-fin="n-kcal"]').focus(); return; }
    if (fp.code && !validCode(fp.code)) { toast('A barcode has 8 to 14 digits'); productSheet.querySelector('[data-fin="p-code"]')?.focus(); return; }
    if (fp.share && !offAccount()) { toast('Add your Open Food Facts account under Goals first'); return; }
    if (fp.share && !fp.code) { toast('Add the barcode to share this food'); productSheet.querySelector('[data-fin="p-code"]')?.focus(); return; }
    const { afterSave, share, ...p } = fp;
    p.name = p.name.trim();
    F().products[p.id] = p;
    resultCache.set(p.id, p);
    saveNow();
    productSheet.close();
    toast('Food saved');
    if (share && canShare(p)) shareOFF(p).then(() => { if (amountSheet.open) renderAmount(); });
    if (afterSave) afterSave(p);
    else if (amountSheet.open) renderAmount();
    else if (addSheet.open) renderAdd();
    core.render();
  }

  /* ---------------- Sheet: barcode scanner ---------------- */
  const scanSheet = $('#scanSheet');
  let scanner = null, scanBusy = false;
  function loadScanner() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/html5-qrcode.min.js';
      s.onload = res; s.onerror = () => rej(new Error('load'));
      document.head.append(s);
    });
  }
  async function openScan() {
    $('#scanStatus').textContent = 'Starting camera…';
    $('#scanCode').value = '';
    scanSheet.showModal();
    scanBusy = false;
    try {
      await loadScanner();
      const H = window.Html5Qrcode, Fm = window.Html5QrcodeSupportedFormats;
      scanner = new H('scanView', { formatsToSupport: [Fm.EAN_13, Fm.EAN_8, Fm.UPC_A, Fm.UPC_E, Fm.QR_CODE], verbose: false });
      await scanner.start({ facingMode: 'environment' }, { fps: 12, qrbox: (w, h) => ({ width: Math.min(300, w * 0.85), height: Math.min(160, h * 0.45) }), aspectRatio: 1.333 }, (text) => onCode(text), () => {});
      $('#scanStatus').textContent = 'Point the camera at the barcode.';
    } catch {
      $('#scanStatus').textContent = 'The camera can’t start. Allow camera access for Gainly, or type the number under the barcode below.';
    }
  }
  async function stopScan() {
    try { if (scanner && scanner.isScanning) await scanner.stop(); scanner?.clear(); } catch { /* ok */ }
    scanner = null;
  }
  scanSheet.addEventListener('close', stopScan);
  async function onCode(text) {
    if (scanBusy) return;
    const code = String(text).replace(/\D/g, '');
    if (code.length < 6) return;
    scanBusy = true;
    navigator.vibrate?.(30);
    $('#scanStatus').textContent = `Looking up ${code}…`;
    let p = null;
    try { p = await lookupBarcode(code); } catch { /* offline */ }
    await stopScan();
    scanSheet.close();
    if (p) openAmount({ product: p, meal: fa.meal });
    else if (await core.ask(`Barcode ${code} isn’t on Open Food Facts yet. Create this food yourself? Next time the barcode finds it.`, 'Create')) {
      openProduct(null, { code, afterSave: (np) => openAmount({ product: np, meal: fa.meal }) });
      fp.id = 'own:' + code;
    }
    scanBusy = false;
  }

  /* ---------------- View: Goals ---------------- */
  function goalsHTML() {
    const g = F().goals;
    const gg = goalGrams();
    const macroKcal = gg.protein * 4 + gg.carbs * 4 + gg.fat * 9;
    const pctSum = g.mode === 'pct' ? g.protein + g.carbs + g.fat : Math.round((macroKcal / Math.max(1, g.kcal)) * 100);
    const field = (k, label, color) => `<label class="field macro-field"><span class="field__label"><i class="dot" style="background:${color}"></i>${label} <small>${g.mode === 'pct' ? '%' : 'g'}</small></span>
      <input data-fin="goal-${k}" inputmode="decimal" value="${fmt(g[k], g[k] % 1 ? 1 : 0)}">
      <span class="macro-field__sub">${g.mode === 'pct' ? `${Math.round(gg[k])} g · ${Math.round(gg[k] * (k === 'fat' ? 9 : 4))} kcal` : `${Math.round(((gg[k] * (k === 'fat' ? 9 : 4)) / Math.max(1, g.kcal)) * 100)}% · ${Math.round(gg[k] * (k === 'fat' ? 9 : 4))} kcal`}</span></label>`;
    return `
      <div class="card">
        <h2 class="card__title" style="margin-bottom:12px">Calories</h2>
        <label class="field"><span class="field__label">Daily goal <small>kcal</small></span><input data-fin="goal-kcal" inputmode="numeric" value="${g.kcal}"></label>
      </div>
      <div class="card">
        <h2 class="card__title" style="margin-bottom:12px">Macronutrients</h2>
        <div class="segmented segmented--full" role="group" aria-label="Set macros in" style="margin-bottom:14px">
          <button type="button" data-f="goal-mode" data-mode2="pct" aria-pressed="${g.mode === 'pct'}">% of calories</button>
          <button type="button" data-f="goal-mode" data-mode2="g" aria-pressed="${g.mode === 'g'}">Grams</button>
        </div>
        <div class="macro-grid">
          ${field('protein', 'Protein', 'var(--mac-p)')}
          ${field('carbs', 'Carbs', 'var(--mac-c)')}
          ${field('fat', 'Fat', 'var(--mac-f)')}
        </div>
        <p class="macro-check${Math.abs(pctSum - 100) > 1 ? ' is-off' : ''}">${g.mode === 'pct'
          ? (Math.abs(pctSum - 100) <= 1 ? `✓ Adds up to 100% (${Math.round(macroKcal)} kcal)` : `Adds up to ${pctSum}%: make it 100%`)
          : `Macros give ${Math.round(macroKcal)} kcal (${pctSum}% of your goal)`}</p>
      </div>
      <div class="card">
        <h2 class="card__title" style="margin-bottom:4px">Calories per meal</h2>
        <p class="hint" style="margin:0 0 12px">How your daily calories are spread over the day. Each meal shows its recommended amount in the diary.</p>
        <div class="macro-grid split-grid">
          ${MEALS.map(([k, label]) => `<label class="field macro-field"><span class="field__label">${label} <small>%</small></span>
            <input data-fin="split-${k}" inputmode="numeric" value="${g.split[k]}">
            <span class="macro-field__sub split-sub">${mealTarget(k)} kcal</span></label>`).join('')}
        </div>
        ${(() => { const t = MEALS.reduce((a, [k]) => a + g.split[k], 0); return `<p class="macro-check split-check${t !== 100 ? ' is-off' : ''}">${t === 100 ? '✓ Adds up to 100%' : `Adds up to ${t}%: the kcal above are scaled to 100%`}</p>`; })()}
        <button type="button" class="button" data-f="split-reset" style="width:100%;margin-top:8px">Reset to 25 / 35 / 30 / 10</button>
      </div>
      <div class="card">
        <h2 class="card__title" style="margin-bottom:12px">Water</h2>
        <label class="field"><span class="field__label">Daily goal <small>ml</small></span><input data-fin="goal-water" inputmode="numeric" value="${g.water}"></label>
        <span class="field__label" style="display:block;margin-bottom:6px">One tap adds</span>
        <div class="segmented segmented--full" role="group" aria-label="Amount per tap" style="margin-bottom:12px">
          ${[200, 250, 330, 500].map((ml) => `<button type="button" data-f="water-step" data-ml="${ml}" aria-pressed="${g.waterStep === ml}">${ml} ml</button>`).join('')}
        </div>
        <span class="field__label" style="display:block;margin-bottom:6px">Shown as</span>
        <div class="segmented segmented--full" role="group" aria-label="Shown as">
          <button type="button" data-f="water-cont" data-c="glass" aria-pressed="${g.container === 'glass'}">Glass</button>
          <button type="button" data-f="water-cont" data-c="bottle" aria-pressed="${g.container === 'bottle'}">Bottle</button>
        </div>
      </div>
      <div class="card">
        <h2 class="card__title" style="margin-bottom:4px">Open Food Facts account</h2>
        ${offAccount() ? `<p class="hint" style="margin:0 0 12px">Username <b>${esc(offAccount().user)}</b>. Foods you create with a barcode can be shared on Open Food Facts. Gainly asks your password each time you share and doesn’t store it.</p>
          <button type="button" class="button" data-f="off-signout" style="width:100%">Remove account</button>`
        : `<p class="hint" style="margin:0 0 12px">Optional. With a free account from openfoodfacts.org you can add foods you create (with a barcode) to the open database. Gainly only keeps your username; it asks your password when you share.</p>
          <form id="offAccountForm" autocomplete="on">
            <label class="field"><span class="field__label">Username</span><input name="user" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
            <button type="submit" class="button" style="width:100%">Save username</button>
          </form>`}
      </div>
      <p class="hint" style="text-align:center">Changes are saved right away.</p>`;
  }
  function renderGoals() { viewEl('foodGoals').innerHTML = goalsHTML(); }
  function renderFavs() {
    const f = F();
    const all = Object.entries(f.favs).map(([pid, v]) => ({ p: productOf(pid), cat: CAT_LABEL[v.cat] ? v.cat : 'other' })).sort((a, b) => a.p.name.localeCompare(b.p.name));
    const counts = {};
    for (const x of all) counts[x.cat] = (counts[x.cat] || 0) + 1;
    if (fui.favCat !== 'all' && !counts[fui.favCat]) fui.favCat = 'all';
    const shown = all.filter((x) => fui.favCat === 'all' || x.cat === fui.favCat);
    const el = viewEl('foodFavs');
    if (!all.length) {
      el.innerHTML = `<div class="card empty"><h2>No favourites yet</h2><p>Open any food (search, scan or your diary) and tap the star. Your favourites show up here, sorted by type, so you can add them in one tap.</p></div>`;
      return;
    }
    const groups = fui.favCat === 'all' ? CATS.filter(([k]) => counts[k]) : CATS.filter(([k]) => k === fui.favCat);
    el.innerHTML = `
      <div class="chips-scroll fav-chips" role="group" aria-label="Filter by type">
        <button type="button" class="chip" data-f="fav-filter" data-c="all" aria-pressed="${fui.favCat === 'all'}">All ${all.length}</button>
        ${CATS.filter(([k]) => counts[k]).map(([k, l]) => `<button type="button" class="chip" data-f="fav-filter" data-c="${k}" aria-pressed="${fui.favCat === k}">${l} ${counts[k]}</button>`).join('')}
      </div>
      ${groups.map(([k, l]) => `<h3 class="fa-sec">${l}</h3><div class="card list fav-list">${shown.filter((x) => x.cat === k).map(({ p }) => `<button type="button" class="food-row" data-f="fav-open" data-pid="${esc(p.id)}">
        ${thumb(p)}
        <span class="food-row__main"><span class="food-row__name">${esc(p.name)}</span><span class="food-row__sub">${p.brand ? esc(p.brand) + ' · ' : ''}${nfmt(p.n.kcal, 'kcal')} kcal per 100 ${p.ml ? 'ml' : 'g'}</span></span>${chev}
      </button>`).join('')}</div>`).join('')}
      <p class="hint" style="text-align:center">Tap a food to add it to ${esc(fmtDayShort())}. Change its type or remove it with the star.</p>`;
  }
  const fmtDayShort = () => { const d = curDay(), l = dayLabel(d); return /^(Today|Yesterday|Tomorrow)$/.test(l) ? l.toLowerCase() : fmtShort(d); };
  /* ---------------- Saved meals ---------------- */
  const savedList = () => Object.values(F().saved).sort((a, b) => a.name.localeCompare(b.name));
  const savedTotals = (m) => sumN(m.items.map((it) => ({ pid: it.pid, g: it.g }))).n;
  function addSavedToDay(m, meal) {
    const d = dayOf(curDay());
    for (const it of m.items) d.meals[meal].push({ id: uid(), pid: it.pid, g: it.g });
    fui.open.add(meal);
    saveNow();
    toast(`${m.name} added to ${MEALS.find(([k]) => k === meal)[1]}`);
  }
  // Builder sheet: create or edit a saved meal
  const mealSheet = $('#mealSheet');
  const mb = { id: null, name: '', items: [] };
  function openMealBuilder(m, prefill) {
    Object.assign(mb, m ? { id: m.id, name: m.name, items: m.items.map((x) => ({ ...x })) } : { id: null, name: prefill?.name || '', items: prefill?.items || [] });
    $('#mealSheetTitle').textContent = m ? 'Edit meal' : 'New meal';
    renderMealBuilder();
    mealSheet.showModal();
  }
  function renderMealBuilder() {
    const t = sumN(mb.items).n;
    $('#mealSheetBody').innerHTML = `
      <label class="field"><span class="field__label">Name</span><input data-fin="mb-name" value="${esc(mb.name)}" placeholder="E.g. My standard breakfast" autocomplete="off"></label>
      <div class="kcal-mini"><strong id="mbKcal">${nfmt(t.kcal || 0, 'kcal')}</strong> kcal <span id="mbMacros">${macroLine(t)}</span></div>
      ${mb.items.length ? `<div class="list mb-list">${mb.items.map((it, i) => { const p = productOf(it.pid); return `<div class="mb-row">
        ${thumb(p)}
        <span class="food-row__main"><span class="food-row__name">${esc(p.name)}</span><span class="food-row__sub" data-mbk="${i}">${nfmt(((p.n.kcal || 0) * it.g) / 100, 'kcal')} kcal</span></span>
        <label class="mb-g"><input data-fin="mb-g" data-i="${i}" inputmode="decimal" value="${fmt(it.g, it.g % 1 ? 1 : 0)}" aria-label="Grams of ${esc(p.name)}"><small>g</small></label>
        <button type="button" class="mb-del" data-f="mb-del" data-i="${i}" aria-label="Remove ${esc(p.name)}">✕</button>
      </div>`; }).join('')}</div>` : '<p class="hint" style="text-align:center;padding:16px 0">No foods yet. Add the foods that make up this meal.</p>'}
      <button type="button" class="button" data-f="mb-add" style="width:100%;margin-top:12px">+ Add food</button>
      ${mb.id ? '<button type="button" class="button button--danger" data-f="mb-delete" style="width:100%;margin-top:10px">Delete this meal</button>' : ''}`;
  }
  function updateBuilderTotals() {
    const t = sumN(mb.items).n;
    const k = $('#mbKcal'); if (k) k.textContent = nfmt(t.kcal || 0, 'kcal');
    const m = $('#mbMacros'); if (m) m.textContent = macroLine(t);
    mb.items.forEach((it, i) => { const el = mealSheet.querySelector(`[data-mbk="${i}"]`); if (el) el.textContent = `${nfmt(((productOf(it.pid).n.kcal || 0) * it.g) / 100, 'kcal')} kcal`; });
  }
  function saveMealBuilder() {
    const name = mb.name.trim();
    if (!name) { toast('Give the meal a name'); mealSheet.querySelector('[data-fin="mb-name"]')?.focus(); return; }
    const items = mb.items.filter((it) => it.g > 0);
    if (!items.length) { toast('Add at least one food'); return; }
    const id = mb.id || uid();
    F().saved[id] = { id, name, items, at: F().saved[id]?.at || Date.now() };
    saveNow();
    mealSheet.close();
    toast(mb.id ? 'Meal saved' : `“${name}” saved under Meals`);
    core.render();
  }

  function renderMeals() {
    const list = savedList();
    const now = mealNow();
    viewEl('foodMeals').innerHTML = `
      <button type="button" class="button button--primary" data-f="mb-new" style="width:100%;margin-bottom:14px">+ Create meal</button>
      ${list.length ? list.map((m) => { const t = savedTotals(m); return `<div class="card saved-meal">
        <div class="saved-meal__head"><div><h2 class="saved-meal__name">${esc(m.name)}</h2><p class="saved-meal__sub">${nfmt(t.kcal || 0, 'kcal')} kcal · ${macroLine(t)}</p></div>
          <button type="button" class="link" data-f="mb-edit" data-id="${m.id}">Edit</button></div>
        <p class="saved-meal__items">${m.items.map((it) => `${esc(productOf(it.pid).name)} <span>${nfmt(it.g, 'g')} g</span>`).join(' · ')}</p>
        <div class="saved-meal__use">
          <select data-fin="sm-target" data-id="${m.id}" aria-label="Meal to add to">${MEALS.map(([k, l]) => `<option value="${k}"${k === (fui.smTarget?.[m.id] || now) ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <button type="button" class="button" data-f="saved-add" data-id="${m.id}">Add to ${esc(fmtDayShort())}</button>
        </div>
      </div>`; }).join('') : `<div class="card empty"><h2>No saved meals yet</h2><p>Open a meal in your diary and tap <b>Save as meal</b>, or tap <b>+ Create meal</b> to build one from scratch. Then add it to any day in one tap.</p></div>`}`;
  }

  /* ---------------- Events ---------------- */
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-f]');
    if (!b) return;
    switch (b.dataset.f) {
      case 'day': fui.day = b.dataset.d; fui.calMonth = null; return core.render();
      case 'cal': fui.cal = !fui.cal; fui.calMonth = null; return core.render();
      case 'cal-month': fui.calMonth = b.dataset.m; return core.render();
      case 'pick-day': fui.day = b.dataset.d; fui.cal = false; fui.calMonth = null; return core.render();
      case 'toggle-meal': { const k = b.dataset.meal; if (fui.open.has(k)) fui.open.delete(k); else fui.open.add(k); return core.render(); }
      case 'add-food': return openAdd(b.dataset.meal);
      case 'summary': return openSummary();
      case 'stats': return openStats();
      case 'stats-mode': st.mode = b.dataset.m; return renderStats();
      case 'stats-step': {
        const a = st.anchor || todayISO();
        if (st.mode === 'week') st.anchor = addDays(a, 7 * +b.dataset.s);
        else { const dt = new Date(+a.slice(0, 4), +a.slice(5, 7) - 1 + +b.dataset.s, 1); st.anchor = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`; }
        if (st.anchor > todayISO()) st.anchor = todayISO();
        return renderStats();
      }
      case 'stats-day': { const d = b.dataset.d; if (d > todayISO()) return; fui.day = d; statsSheet.close(); return core.render(); }
      case 'use-kcal': {
        const k = +b.dataset.k;
        if (!await core.ask(`Set your daily calorie goal to ${nfmt(k, 'kcal')} kcal?${F().goals.mode === 'g' ? ' Your macros are set in grams, so check them under Goals.' : ''}`, 'Set goal')) return;
        F().goals.kcal = k; saveNow(); toast('Daily goal updated'); renderStats(); return core.render();
      }
      case 'water-add': case 'water-set': {
        const d = dayOf(curDay()), step = F().goals.waterStep;
        d.water = b.dataset.f === 'water-add' ? d.water + step : Math.max(0, +b.dataset.n * step);
        saveSoon(); return core.render();
      }
      case 'add-tab': fa.tab = b.dataset.t; return renderAdd();
      case 'clear-search': { searchSeq++; clearTimeout(offTimer); Object.assign(fa, { q: '', results: null, err: '', busy: false, nevo: null, mine: null }); const i = $('#foodSearchForm')?.q; if (i) i.value = ''; return renderAdd(); }
      case 'scan': return openScan();
      case 'scan-find': { const v = $('#scanCode').value; if (v.replace(/\D/g, '').length >= 6) onCode(v); else toast('Type the number under the barcode'); return; }
      case 'pick-product': {
        const p = F().products[b.dataset.pid] || resultCache.get(b.dataset.pid);
        if (p) openAmount({ product: p, meal: fa.meal });
        return;
      }
      case 'new-product': return openProduct(null, { afterSave: (p) => openAmount({ product: p, meal: fa.meal }) });
      case 'edit-entry': {
        const d = dayOf(curDay());
        const e = d.meals[b.dataset.meal].find((x) => x.id === b.dataset.id);
        if (e) openAmount({ product: productOf(e.pid), meal: b.dataset.meal, g: e.g, entryId: e.id });
        return;
      }
      case 'set-g': fam.g = +b.dataset.g; return renderAmount();
      case 'set-meal': fam.meal = b.dataset.meal; return renderAmount();
      case 'save-entry': return saveEntry();
      case 'copy-prev': { const n = copyPrev([b.dataset.meal]); toast(`Copied ${plural(n, 'food', 'foods')}`); return core.render(); }
      case 'copy-prev-day': { const n = copyPrev(MEALS.map(([k]) => k)); toast(`Copied ${plural(n, 'food', 'foods')} from ${prevLabel()}`); return core.render(); }
      case 'meal-to-saved': {
        const key = b.dataset.meal, d = peekDay(curDay());
        const items = (d?.meals[key] || []).map((e) => ({ pid: e.pid, g: e.g }));
        if (!items.length) return;
        return openMealBuilder(null, { name: `My ${MEALS.find(([k]) => k === key)[1].toLowerCase()}`, items });
      }
      case 'mb-new': return openMealBuilder(null);
      case 'mb-edit': return openMealBuilder(F().saved[b.dataset.id]);
      case 'mb-add': return openAdd('breakfast', { builder: true });
      case 'mb-del': mb.items.splice(+b.dataset.i, 1); return renderMealBuilder();
      case 'mb-save': return saveMealBuilder();
      case 'mb-delete': {
        if (!await core.ask(`Delete the meal “${mb.name}”? Your diary stays as it is.`, 'Delete')) return;
        delete F().saved[mb.id]; saveNow(); mealSheet.close(); toast('Meal deleted'); return core.render();
      }
      case 'saved-add': {
        const m = F().saved[b.dataset.id]; if (!m) return;
        addSavedToDay(m, fui.smTarget?.[m.id] || mealNow()); return core.render();
      }
      case 'saved-quick': {
        const m = F().saved[b.dataset.id]; if (!m) return;
        addSavedToDay(m, fa.meal); addSheet.close(); return core.render();
      }
      case 'share-off': { b.disabled = true; b.textContent = 'Sharing…'; await shareOFF(pendingProduct()); return renderAmount(); }
      case 'off-signout': if (!await core.ask('Remove your Open Food Facts account from this iPhone?', 'Remove')) return; localStorage.removeItem(OFF_KEY); return renderGoals();
      case 'fav-toggle': { toggleFav(pendingProduct()); renderAmount(); return core.render(); }
      case 'fav-filter': fui.favCat = b.dataset.c; return core.render();
      case 'fav-open': { const p = productOf(b.dataset.pid); return openAmount({ product: p, meal: mealNow() }); }
      case 'del-entry': {
        const d = dayOf(fam.iso);
        for (const [k] of MEALS) d.meals[k] = d.meals[k].filter((e) => e.id !== fam.entryId);
        saveNow(); amountSheet.close(); toast('Removed'); return core.render();
      }
      case 'edit-product': {
        const p = pendingProduct();
        if (p.src !== 'nevo') return openProduct(p);
        // NEVO values may not be changed: edit your own copy instead
        const copy = { ...p, n: { ...p.n }, id: 'own:' + uid(), src: 'own', brand: '', basedOn: p.id };
        return openProduct(copy, { copyOf: p, afterSave: (np) => { fam.pid = np.id; renderAmount(); } });
      }
      case 'save-product': return saveProduct();
      case 'del-product': {
        const used = Object.values(F().days).some((d) => dayEntries(d).some((e) => e.pid === fp.id));
        if (used) { toast('This food is still in your diary'); return; }
        if (!await core.ask(`Delete “${fp.name}”?`, 'Delete')) return;
        delete F().products[fp.id]; delete F().favs[fp.id]; saveNow(); productSheet.close(); core.render(); return renderAdd();
      }
      case 'goal-mode': {
        const g = F().goals, gg = goalGrams(), mode = b.dataset.mode2;
        if (mode === g.mode) return;
        if (mode === 'g') Object.assign(g, { mode, protein: Math.round(gg.protein), carbs: Math.round(gg.carbs), fat: Math.round(gg.fat) });
        else {
          const t = Math.max(1, gg.protein * 4 + gg.carbs * 4 + gg.fat * 9);
          const p = Math.round((gg.protein * 4 / t) * 100), c = Math.round((gg.carbs * 4 / t) * 100);
          Object.assign(g, { mode, protein: p, carbs: c, fat: 100 - p - c });
        }
        saveNow(); return renderGoals();
      }
      case 'split-reset': F().goals.split = { ...DEFAULT_SPLIT }; saveNow(); return renderGoals();
      case 'water-step': F().goals.waterStep = +b.dataset.ml; saveNow(); return renderGoals();
      case 'water-cont': F().goals.container = b.dataset.c; saveNow(); return renderGoals();
    }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id === 'offAccountForm') {
      ev.preventDefault();
      const user = ev.target.user.value.trim();
      if (!user) { toast('Enter your username'); return; }
      try { localStorage.setItem(OFF_KEY, JSON.stringify({ user })); } catch { toast('Couldn’t save the account'); return; }
      toast('Username saved');
      return renderGoals();
    }
    if (ev.target.id !== 'foodSearchForm') return;
    ev.preventDefault();
    ev.target.q.blur();
    runSearch(ev.target.q.value, { now: true });
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.name !== 'q' || ev.target.form?.id !== 'foodSearchForm') return;
    runSearch(ev.target.value);
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target, k = t.dataset?.fin;
    if (!k) return;
    if (k === 'mb-name') { mb.name = t.value; return; }
    if (k === 'mb-g') { const n = parseNum(t.value); const it = mb.items[+t.dataset.i]; if (it && n != null && !Number.isNaN(n)) { it.g = n; updateBuilderTotals(); } return; }
    if (k === 'sm-target') { (fui.smTarget ||= {})[t.dataset.id] = t.value; return; }
    if (k === 'fav-cat') { const v = F().favs[fam.pid]; if (v) { v.cat = t.value; saveNow(); core.render(); } return; }
    if (k === 'grams') { const n = parseNum(t.value); if (!Number.isNaN(n)) { fam.g = n; updateAmountNumbers(); } return; }
    if (k.startsWith('p-') || k.startsWith('n-')) {
      if (k === 'p-name') fp.name = t.value;
      else if (k === 'p-brand') fp.brand = t.value;
      else if (k === 'p-code') { fp.code = t.value.replace(/\D/g, ''); const c = productSheet.querySelector('[data-fin="p-share"]'); if (c && offAccount() && validCode(fp.code) && !c.dataset.touched) { c.checked = true; fp.share = true; } }
      else if (k === 'p-share') { fp.share = t.checked; t.dataset.touched = '1'; }
      else if (k === 'p-serving') { const n = parseNum(t.value); fp.serving = n > 0 ? n : null; }
      else { const n = parseNum(t.value); if (!Number.isNaN(n)) { if (n == null) delete fp.n[k.slice(2)]; else fp.n[k.slice(2)] = n; } }
      return;
    }
    if (k.startsWith('split-')) {
      const n = parseNum(t.value);
      if (n == null || Number.isNaN(n) || n < 0) return;
      F().goals.split[k.slice(6)] = Math.round(n);
      saveSoon();
    }
    if (k.startsWith('goal-') || k.startsWith('split-')) {
      const n = parseNum(t.value);
      if (n == null || Number.isNaN(n) || n < 0) return;
      if (k.startsWith('goal-')) { F().goals[k.slice(5)] = n; saveSoon(); }
      // update the computed hints in place, so the field keeps focus and the keyboard stays put
      const tmp = document.createElement('div'); tmp.innerHTML = goalsHTML();
      const view = viewEl('foodGoals');
      const fresh = tmp.querySelectorAll('.macro-field__sub'), cur = view.querySelectorAll('.macro-field__sub');
      cur.forEach((el, i) => { if (fresh[i]) el.textContent = fresh[i].textContent; });
      for (const sel of ['.macro-check:not(.split-check)', '.split-check']) {
        const fc = tmp.querySelector(sel), cc = view.querySelector(sel);
        if (fc && cc) { cc.textContent = fc.textContent; cc.className = fc.className; }
      }
    }
  });

  // Close via backdrop or [data-close]; header buttons
  for (const dlg of [summarySheet, addSheet, amountSheet, productSheet, scanSheet, mealSheet, statsSheet]) {
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg || ev.target.closest('[data-close]')) dlg.close(); });
  }
  $('#foodProductSave').dataset.f = 'save-product';
  $('#mealSheetSave').dataset.f = 'mb-save';
  $('#scanFind').dataset.f = 'scan-find';

  return {
    views: { food: renderDiary, foodFavs: renderFavs, foodMeals: renderMeals, foodGoals: renderGoals },
    titles: { food: 'Nutrition', foodFavs: 'Favourites', foodMeals: 'Meals', foodGoals: 'Goals' },
  };
};
