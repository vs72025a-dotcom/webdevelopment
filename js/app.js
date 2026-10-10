/* ============================================================
   AnyWhere Anything — App Engine
   State • Rendering • Cart • Checkout + UPI • Seller • i18n
   ============================================================ */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const LS = {
  get:(k,f)=>{ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):f; }catch{ return f; } },
  set:(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch{ return false; } },
  del:(k)=>{ try{ localStorage.removeItem(k); }catch{} },
};
const uid = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- State ---------------- */
let settings = Object.assign({}, DEFAULT_SETTINGS, LS.get('aw_settings_v1', {}));
settings.sections = Object.assign({}, DEFAULT_SETTINGS.sections, (LS.get('aw_settings_v1', {}).sections||{}));
settings.theme = Object.assign({}, DEFAULT_SETTINGS.theme, (LS.get('aw_settings_v1', {}).theme||{}));
settings.commerce = Object.assign({}, DEFAULT_SETTINGS.commerce, (LS.get('aw_settings_v1', {}).commerce||{}));
if(!settings.lang) settings.lang = 'en';

let cart = LS.get('aw_cart_v1', {});
let wishlist = new Set(LS.get('aw_wish_v1', []));
let orders = LS.get('aw_orders_v1', []);
let user = LS.get('aw_user_v1', null);
let location = LS.get('aw_loc_v1', { n:'New York', pin:'10001', e:'🗽' });
let recent = LS.get('aw_recent_v1', []);
let activeCoupon = LS.get('aw_coupon_v1', null);
let extraProducts = LS.get('aw_products_extra_v1', []);
let deletedIds = LS.get('aw_products_deleted_v1', []);
let editedProducts = LS.get('aw_products_edited_v1', {});
let myReviews = LS.get('aw_reviews_v1', {});

let route = { page:'home', vertical:'all', category:'all', query:'', sort:'pop' };
let filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
let coState = { step:0, addr:{}, pay:'upi', upi:{ id:'', verified:false, name:'', app:'GPay' } };

const saveSettings = () => LS.set('aw_settings_v1', settings);
const saveCart = () => LS.set('aw_cart_v1', cart);
const saveWish = () => LS.set('aw_wish_v1', [...wishlist]);
const saveOrders = () => LS.set('aw_orders_v1', orders);

/* ---------------- Helpers ---------------- */
const t = k => (I18N[settings.lang] && I18N[settings.lang][k]) || I18N.en[k] || k;
const HI = () => settings.lang === 'hi';
const vname = v => (HI() && v.hn) ? v.hn : v.name;
const fmt = n => settings.commerce.currency + Number(Math.round(n)).toLocaleString('en-IN');
const off = p => p.m > p.p ? Math.round((1 - p.p/p.m)*100) : 0;
function getProducts(){
  const map = {};
  SEED_PRODUCTS.forEach(p => { if(!deletedIds.includes(p.id)) map[p.id] = editedProducts[p.id] || p; });
  extraProducts.forEach(p => { map[p.id] = p; });
  return Object.values(map);
}
const getP = id => getProducts().find(p => p.id === id);
const vertOf = id => VERTICALS.find(v => v.id === id);
const statusName = i => t('st'+Math.min(4,Math.max(0,i)));
function toast(msg, emoji='✅'){
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `<span>${emoji}</span><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; setTimeout(()=>el.remove(), 300); }, 2600);
}
function stars(r){ const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5-f); }
/* Product media: real image (upload/URL) with emoji fallback */
function mediaHTML(p){
  const em = `<span>${p.e||'📦'}</span>`;
  if(p.img) return `${em}<img class="pimg" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()"/>`;
  return em;
}
/* Compress an uploaded image so it fits in localStorage */
function fileToDataURL(file, maxDim=800, q=.82){
  return new Promise((res, rej)=>{
    if(!file || !file.type.startsWith('image/')) return rej('not-image');
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{
      const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width*sc); c.height = Math.round(img.height*sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = rej; img.src = url;
  });
}
/* Demo UPI QR (pseudo-random but stable per order) */
function drawUPIQR(canvas, seedStr){
  const n = 25, ctx = canvas.getContext('2d'), s = canvas.width / n;
  let h = 7; for(const ch of seedStr) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => (h = (h*1103515245 + 12345) >>> 0) / 4294967296;
  const inFinder = (x,y) => (x<8&&y<8)||(x>=n-8&&y<8)||(x<8&&y>=n-8);
  const finderCell = (x,y) => {
    const lx = x<8?x:x-(n-8), ly = y<8?y:y-(n-8);
    if(lx===0||lx===6||ly===0||ly===6) return true;
    if(lx===1||lx===5||ly===1||ly===5) return false;
    return true;
  };
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#111827';
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const on = inFinder(x,y) ? finderCell(x,y) : rnd() > .52;
    if(on) ctx.fillRect(Math.floor(x*s), Math.floor(y*s), Math.ceil(s), Math.ceil(s));
  }
}

/* ============================================================
   APPLY SETTINGS → theme + texts + language chrome
   ============================================================ */
function applySettings(){
  const T = settings.theme, r = document.documentElement;
  r.dataset.theme = T.mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : T.mode;
  r.style.setProperty('--primary', T.primary);
  r.style.setProperty('--primary-2', T.secondary);
  r.style.setProperty('--font', T.font);
  r.style.setProperty('--radius', T.radius + 'px');
  r.style.setProperty('--radius-sm', Math.max(6, T.radius-6) + 'px');
  const lm = $('#logoMark');
  if(settings.logoImg) lm.innerHTML = `<img src="${settings.logoImg}" alt="logo"/>`;
  else lm.textContent = settings.logoEmoji || '🌍';
  $('#storeName').textContent = settings.storeName || 'AnyWhere';
  $('#storeName2').textContent = settings.storeName2 || 'Anything';
  $('#storeTagline').textContent = settings.tagline || '';
  $('#sideLogo').textContent = `${settings.logoImg?'🏪':(settings.logoEmoji||'🌍')} ${settings.storeName||''} ${settings.storeName2||''}`;
  const an = $('#announce');
  an.textContent = settings.announce || '';
  an.classList.toggle('show', !!settings.showAnnounce && !!settings.announce);
  $('#btnTheme').textContent = r.dataset.theme === 'dark' ? '☀️' : '🌙';
  document.title = `${settings.storeName} ${settings.storeName2} — Food, Grocery, Shopping & More`;
}
function applyChromeI18n(){
  $('#searchInput').placeholder = t('searchPh');
  $('#searchInputM').placeholder = t('searchPhM');
  $('#btnSearch').textContent = t('search');
  $('#btnLang').textContent = HI() ? 'हिं' : 'EN';
  document.documentElement.lang = HI() ? 'hi' : 'en';
  $('.cart-btn span').textContent = t('cart');
  $('.loc-text small').textContent = t('deliverTo');
  $('#cartTitle').textContent = t('cartTitle');
  $('#wishTitle').textContent = '❤️ ' + t('wishTitle');
  $('#locTitle').textContent = '📍 ' + t('locTitle');
  $('#locLabel').textContent = t('locSearchPh');
  $('#locSearch').placeholder = t('locHint');
  $('#btnDetect').textContent = '🎯 ' + t('locDetect');
  $('#locPop').textContent = t('locPop');
  $('#authTitle').textContent = '👋 ' + t('auWelcome');
  $('#tabLogin').textContent = t('auLogin');
  $('#tabSignup').textContent = t('auSignup');
  $('#authNote').textContent = t('auDemo');
  $('#btnCustomize2').textContent = '🎨 ' + t('sideCustom');
  $('#btnLogin2').textContent = '👤 ' + t('sideLogin');
  const m = { home:'bHome', shop:'bExplore', offers:'bOffers', orders:'bOrders', cart:'bCart' };
  $$('.bottom-nav button').forEach(b => { b.querySelector('small').textContent = t(m[b.dataset.nav]); });
}

/* ============================================================
   HEADER / NAV
   ============================================================ */
function renderNav(){
  const nav = $('#catNav');
  nav.innerHTML = `<button class="cat-pill ${route.vertical==='all'?'active':''}" data-vert="all">🌍 ${t('all')}</button>` +
    VERTICALS.map(v => `<button class="cat-pill ${route.vertical===v.id?'active':''}" data-vert="${v.id}">${v.emoji} ${esc(vname(v))}</button>`).join('');
  $$('#catNav .cat-pill').forEach(b => b.onclick = () => {
    route = { page:'shop', vertical:b.dataset.vert, category:'all', query:'', sort:'pop' };
    filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
    renderAll(); window.scrollTo({top:0, behavior:'smooth'});
  });
  const links = [
    ['🏠', t('sideHome'), 'home'], ['🧭', t('sideExplore'), 'shop'], ['🏷️', t('sideOffers'), 'offers'],
    ['📦', t('sideOrders'), 'orders'], ['❤️', t('sideWish'), 'wish'], ['💼', t('sideSeller'), 'seller'],
    ['🎨', t('sideCustom'), 'custom'],
    ...VERTICALS.map(v => [v.emoji, vname(v), 'v:'+v.id]),
  ];
  $('#sideLinks').innerHTML = links.map(([e,n,a]) => `<button data-go="${a}">${e} ${esc(n)}</button>`).join('');
  $$('#sideLinks button').forEach(b => b.onclick = () => {
    closeAll(); const a = b.dataset.go;
    if(a==='home') route.page='home';
    else if(a==='shop') route={page:'shop',vertical:'all',category:'all',query:'',sort:'pop'};
    else if(a==='offers') route.page='offers';
    else if(a==='orders') route.page='orders';
    else if(a==='seller') route.page='seller';
    else if(a==='wish'){ openDrawer('wishDrawer'); renderWish(); return; }
    else if(a==='custom'){ openDrawer('customDrawer'); renderCustomizer('store'); return; }
    else if(a.startsWith('v:')) route={page:'shop',vertical:a.slice(2),category:'all',query:'',sort:'pop'};
    renderAll(); window.scrollTo({top:0,behavior:'smooth'});
  });
  $$('.bottom-nav button').forEach(b => b.onclick = () => {
    $$('.bottom-nav button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const n = b.dataset.nav;
    if(n==='cart'){ openDrawer('cartDrawer'); renderCart(); return; }
    if(n==='home') route.page='home';
    if(n==='shop') route={page:'shop',vertical:'all',category:'all',query:'',sort:'pop'};
    if(n==='offers') route.page='offers';
    if(n==='orders') route.page='orders';
    renderAll(); window.scrollTo({top:0,behavior:'smooth'});
  });
  $('#locLabel').textContent = `${location.n} ${location.pin}`;
  $('#locLabel2').textContent = `${location.n} ${location.pin}`;
}

/* ============================================================
   PRODUCT CARD
   ============================================================ */
function cardHTML(p){
  const q = cart[p.id] || 0;
  const wished = wishlist.has(p.id) ? 'active' : '';
  const c = settings.commerce;
  return `<div class="card" data-card="${p.id}">
    <div class="card-img ${p.g||'g1'}" data-open="${p.id}">
      ${mediaHTML(p)}
      ${off(p)?`<span class="off">${off(p)}% OFF</span>`:''}
      ${c.showVeg && p.veg!==undefined ? `<span class="veg ${p.veg?'':'nonveg'}">${p.veg?'🟢':'🔴'}</span>`:''}
      ${p.badge?`<span class="off" style="left:auto;right:10px;top:auto;bottom:8px;background:#111">${esc(p.badge)}</span>`:''}
      <button class="wish-heart ${wished}" data-wish="${p.id}" style="${p.badge?'bottom:34px':''}">♥</button>
    </div>
    <div class="card-body">
      <span class="card-store" data-open="${p.id}">${esc(p.s||'')} • ${esc(p.t||'')}</span>
      <span class="card-name" data-open="${p.id}">${esc(p.n)}</span>
      <span class="card-meta" data-open="${p.id}">
        ${c.showRatings?`<span class="rate">★ ${p.r}</span><span>(${(p.rc||0).toLocaleString('en-IN')})</span>`:''}
        ${c.showTime&&p.u?`<span>• ${esc(p.u)}</span>`:''}
      </span>
      <span class="card-price" data-open="${p.id}"><b>${fmt(p.p)}</b>${c.showMrp&&p.m>p.p?`<s>${fmt(p.m)}</s>`:''}</span>
      <div class="card-foot" data-qty-for="${p.id}">
        ${q===0 ? `<button class="add-btn" data-add="${p.id}">${t('addBtn')}</button>`
        : `<div class="qty-ctrl"><button data-dec="${p.id}">−</button><span>${q}</span><button data-inc="${p.id}">+</button></div>`}
      </div>
    </div>
  </div>`;
}
function bindCards(root=document){
  $$('[data-open]', root).forEach(el => el.onclick = e => { e.stopPropagation(); openProduct(el.dataset.open); });
  $$('[data-add]', root).forEach(el => el.onclick = e => { e.stopPropagation(); setQty(el.dataset.add, 1); });
  $$('[data-inc]', root).forEach(el => el.onclick = e => { e.stopPropagation(); setQty(el.dataset.inc, (cart[el.dataset.inc]||0)+1); });
  $$('[data-dec]', root).forEach(el => el.onclick = e => { e.stopPropagation(); setQty(el.dataset.dec, (cart[el.dataset.dec]||0)-1); });
  $$('[data-wish]', root).forEach(el => el.onclick = e => { e.stopPropagation(); toggleWish(el.dataset.wish); });
}

/* ============================================================
   HOME PAGE
   ============================================================ */
function homeHTML(){
  const S = settings.sections, prods = getProducts();
  const best = [...prods].sort((a,b)=>b.rc-a.rc).slice(0,10);
  const flash = [...prods].sort((a,b)=>off(b)-off(a)).slice(0,5);
  const food = prods.filter(p=>p.v==='food').slice(0,5);
  const elec = prods.filter(p=>p.v==='electronics').slice(0,5);
  let h = '';

  if(S.hero) h += `<section class="hero">
    <div>
      <span class="hero-badge">${esc(settings.heroBadge)}</span>
      <h1>${esc(settings.heroTitle)}</h1>
      <p>${esc(settings.heroSub)}</p>
      <div class="hero-cta">
        <button class="btn light" data-hero="food">🍔 ${esc(settings.heroCta1)}</button>
        <button class="btn secondary" data-hero="all" style="background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.4)">✨ ${esc(settings.heroCta2)}</button>
      </div>
      <div class="hero-stats">
        <div><b>10M+</b><small>${t('statCustomers')}</small></div>
        <div><b>500+</b><small>${t('statCities')}</small></div>
        <div><b>4.8★</b><small>${t('statRating')}</small></div>
      </div>
    </div>
    <div class="hero-art"><div class="hero-float-wrap">
      <div class="float-card"><span class="fe">🍕</span><b>${vname(VERTICALS[0])}</b><small>30-min delivery</small></div>
      <div class="float-card"><span class="fe">🥦</span><b>${vname(VERTICALS[1])}</b><small>Farm fresh</small></div>
      <div class="float-card"><span class="fe">🎧</span><b>${vname(VERTICALS[3])}</b><small>Top brands</small></div>
      <div class="float-card"><span class="fe">🧹</span><b>${vname(VERTICALS[7])}</b><small>At doorstep</small></div>
    </div></div>
  </section>`;

  if(S.verticals) h += `<section class="section"><div class="sec-head"><div><h2>${t('secCat')}</h2><p>${t('secCatSub')}</p></div></div>
    <div class="vert-grid">${VERTICALS.map(v=>`<div class="vert-card" data-vert-go="${v.id}"><span class="ve">${v.emoji}</span><b>${esc(vname(v))}</b><small>${v.tag}</small></div>`).join('')}</div></section>`;

  if(S.promos) h += `<section class="section"><div class="banner-row">${BANNERS.map((b,i)=>
    `<button class="banner" style="background:${b.bg}" data-banner="${i}"><span class="be">${b.e}</span><b>${b.t}</b><small>${b.s}</small><span class="go">GRAB WITH ${b.code} →</span></button>`).join('')}</div></section>`;

  if(S.flash) h += `<section class="section"><div class="flash"><div class="flash-head"><h2>⚡ ${t('secFlash')}</h2>
    <div class="timer"><span id="tH">00</span>:<span id="tM">00</span>:<span id="tS">00</span></div>
    <button class="link" data-vert-go="all" style="margin-left:auto;color:#fff">${t('viewAll')}</button></div>
    <div class="flash-grid">${flash.map(cardHTML).join('')}</div></div></section>`;

  if(S.best) h += `<section class="section"><div class="sec-head"><div><h2>🔥 ${t('secBest')}</h2><p>${t('secBestSub')} ${esc(location.n)}</p></div><button class="link" data-vert-go="all">${t('viewAll')}</button></div>
    <div class="prod-grid">${best.map(cardHTML).join('')}</div></section>`;

  if(S.collections) h += `<section class="section"><div class="sec-head"><div><h2>${t('secCur')}</h2><p>${t('secCurSub')}</p></div></div>
    <div class="coll-grid">
      <button class="coll" data-vert-go="food" style="background:linear-gradient(135deg,#f97316,#b91c1c)"><span class="ce">🍔</span><b>Cravings Fix</b><small>30-min delivery • 500+ dishes</small><span class="go">Order now →</span></button>
      <button class="coll" data-vert-go="grocery" style="background:linear-gradient(135deg,#16a34a,#14532d)"><span class="ce">🥬</span><b>Fresh Mandi</b><small>Farm to door in 2 hrs</small><span class="go">Shop fresh →</span></button>
      <button class="coll" data-vert-go="electronics" style="background:linear-gradient(135deg,#4f46e5,#1e1b4b)"><span class="ce">🎧</span><b>Gadget Fest</b><small>Up to 60% off + EMI</small><span class="go">Grab deals →</span></button>
    </div></section>`;

  h += `<section class="section"><div class="sec-head"><div><h2>🍕 ${t('secFood')}</h2><p>${t('secFoodSub')} ${esc(location.n)}</p></div><button class="link" data-vert-go="food">${t('viewAll')}</button></div>
    <div class="prod-grid">${food.map(cardHTML).join('')}</div></section>`;

  if(S.services){
    const svcs = prods.filter(p=>p.v==='services').slice(0,3);
    h += `<section class="section"><div class="sec-head"><div><h2>🛠️ ${t('secSvc')}</h2><p>${t('secSvcSub')}</p></div><button class="link" data-vert-go="services">${t('viewAll')}</button></div>
    <div class="svc-grid">${svcs.map(p=>`<div class="svc" data-open="${p.id}"><span class="se ${p.g}">${mediaHTML(p)}</span><div><b>${esc(p.n)}</b><p>${esc((p.d||'').slice(0,70))}…</p><span class="rate">★ ${p.r}</span> <b>${fmt(p.p)}</b> <s class="muted small">${fmt(p.m)}</s></div></div>`).join('')}</div></section>`;
  }

  h += `<section class="section"><div class="sec-head"><div><h2>⚡ ${t('secTrend')}</h2><p>${t('secTrendSub')}</p></div><button class="link" data-vert-go="electronics">${t('viewAll')}</button></div>
    <div class="prod-grid">${elec.map(cardHTML).join('')}</div></section>`;

  if(S.recent && recent.length) h += `<section class="section"><div class="sec-head"><div><h2>🕘 ${t('secRecent')}</h2></div></div>
    <div class="recent-row">${recent.map(id=>{const p=getP(id); return p?`<div class="recent-item" data-open="${p.id}"><div class="re ${p.g}">${mediaHTML(p)}</div><b>${esc(p.n)}</b></div>`:'';}).join('')}</div></section>`;

  if(S.cities) h += `<section class="section"><div class="sec-head"><div><h2>🌍 ${t('secAny')}</h2><p>${t('secAnySub')}</p></div></div>
    <div class="city-strip">${CITIES.slice(0,6).map(c=>`<div class="city" data-city="${c.n}"><span class="ce">${c.e}</span><b>${c.n}</b><small>${c.pin}</small></div>`).join('')}</div></section>`;

  if(S.testimonials) h += `<section class="section"><div class="sec-head"><div><h2>💬 ${t('secLoved')}</h2><p>${t('secLovedSub')}</p></div></div>
    <div class="testi-grid">${TESTIMONIALS.map(t2=>`<div class="testi"><div class="stars">${'★'.repeat(t2.s)}${'☆'.repeat(5-t2.s)}</div><p>"${t2.t}"</p><div class="who"><span class="ava">${t2.e}</span><div><b>${t2.n}</b><small>${t2.c} • Verified buyer</small></div></div></div>`).join('')}</div></section>`;

  return h;
}

/* ============================================================
   SHOP PAGE
   ============================================================ */
function filteredProducts(){
  let list = getProducts();
  if(route.vertical !== 'all') list = list.filter(p => p.v === route.vertical);
  if(route.category !== 'all') list = list.filter(p => p.c === route.category);
  if(route.query) { const q = route.query.toLowerCase(); list = list.filter(p => (p.n+' '+p.d+' '+p.c+' '+p.s).toLowerCase().includes(q)); }
  if(filters.cats.size) list = list.filter(p => filters.cats.has(p.c));
  list = list.filter(p => p.p <= filters.maxPrice && p.r >= filters.minRating);
  if(filters.vegOnly) list = list.filter(p => p.veg);
  const s = route.sort;
  if(s==='plh') list.sort((a,b)=>a.p-b.p);
  else if(s==='phl') list.sort((a,b)=>b.p-a.p);
  else if(s==='rate') list.sort((a,b)=>b.r-a.r);
  else if(s==='off') list.sort((a,b)=>off(b)-off(a));
  else list.sort((a,b)=>b.rc-a.rc);
  return list;
}
function shopHTML(){
  const cats = route.vertical==='all'
    ? [...new Set(getProducts().map(p=>p.c))].slice(0,14)
    : (CATEGORIES[route.vertical]||[]);
  const list = filteredProducts();
  const v = vertOf(route.vertical);
  const title = route.query ? (HI()?`"${esc(route.query)}" ${t('shopResults')}`:`${t('shopResults')} "${esc(route.query)}"`)
    : v ? `${v.emoji} ${esc(vname(v))}` : `🧭 ${t('shopExplore')}`;
  return `<div class="sec-head" style="margin-top:6px"><div>
      <h2>${title}</h2>
      <p>${list.length} ${t('shopItems')}${route.vertical!=='all'?' • '+v.tag:''} • ${t('shopDelivering')} ${esc(location.n)}</p></div></div>
  <div class="chip-row">
    <button class="chip ${route.vertical==='all'?'active':''}" data-fvert="all">🌍 ${t('all')}</button>
    ${VERTICALS.map(x=>`<button class="chip ${route.vertical===x.id?'active':''}" data-fvert="${x.id}">${x.emoji} ${esc(vname(x))}</button>`).join('')}
  </div>
  <div class="shop-layout">
    <aside class="filters">
      <h3>${t('fFilters')}</h3><span class="small muted">${list.length} ${t('fResults')}</span>
      <div class="f-group"><h4>${t('fCategory')}</h4>${cats.map(c=>`<label class="f-check"><input type="checkbox" data-fcat="${esc(c)}" ${filters.cats.has(c)?'checked':''}/> ${esc(c)}</label>`).join('')||`<span class="small muted">—</span>`}</div>
      <div class="f-group"><h4>${t('fMaxPrice')}: <b id="priceLbl">${fmt(filters.maxPrice>99999?100000:filters.maxPrice)}</b></h4>
        <input type="range" class="f-range" id="priceRange" min="100" max="60000" step="100" value="${Math.min(filters.maxPrice,60000)}" /></div>
      <div class="f-group"><h4>${t('fRating')}</h4>
        ${[0,3,4,4.5].map(r=>`<label class="f-check"><input type="radio" name="frate" value="${r}" ${filters.minRating==r?'checked':''}/> ${r===0?t('fAny'):`★ ${r} ${t('fAbove')}`}</label>`).join('')}</div>
      <div class="f-group"><label class="f-check"><input type="checkbox" id="vegOnly" ${filters.vegOnly?'checked':''}/> 🌱 ${t('fVeg')}</label></div>
      <div class="f-group"><button class="btn secondary full sm" id="clearFilters">${t('fClear')}</button></div>
    </aside>
    <div>
      <div class="toolbar"><span class="res">${list.length} ${t('itemsFound')}</span>
        <select id="sortSel">
          <option value="pop" ${route.sort==='pop'?'selected':''}>${t('sortPop')}</option>
          <option value="plh" ${route.sort==='plh'?'selected':''}>${t('sortPlh')}</option>
          <option value="phl" ${route.sort==='phl'?'selected':''}>${t('sortPhl')}</option>
          <option value="rate" ${route.sort==='rate'?'selected':''}>${t('sortRate')}</option>
          <option value="off" ${route.sort==='off'?'selected':''}>${t('sortOff')}</option>
        </select></div>
      ${list.length?`<div class="prod-grid cols-4">${list.map(cardHTML).join('')}</div>`
        :`<div class="empty"><div class="big">🔍</div><h3>${t('noMatch')}</h3><p>${t('noMatchSub')}</p><button class="btn primary" id="emptyReset">${t('fClear')}</button></div>`}
    </div>
  </div>`;
}

/* ============================================================
   OFFERS + ORDERS PAGES
   ============================================================ */
function offersHTML(){
  return `<div class="sec-head" style="margin-top:6px"><div><h2>🏷️ ${t('offTitle')}</h2><p>${t('offSub')}</p></div></div>
  <div class="promo-strip" style="margin-bottom:18px">${BANNERS.map((b,i)=>`<div class="promo-chip" data-banner="${i}"><span class="pc" style="background:${b.bg}">${b.e}</span><span>${b.t}<br/><small class="muted">${b.code}</small></span></div>`).join('')}</div>
  <div class="coupon-grid">${COUPONS.map(c=>`<div class="coupon"><span class="cc">${c.e}</span><b>${c.t}</b><p>${c.d}</p>
    <div class="code-row"><code>${c.code}</code><button class="btn secondary sm" data-copy="${c.code}">${t('copyBtn')}</button><button class="btn primary sm" data-apply="${c.code}">${activeCoupon===c.code?t('appliedBtn'):t('applyBtn')}</button></div></div>`).join('')}</div>`;
}
function ordersHTML(){
  if(!orders.length) return `<div class="empty" style="padding-top:80px"><div class="big">📦</div><h3>${t('ordEmpty')}</h3><p>${t('ordEmptySub')}</p><button class="btn primary" data-vert-go="all">${t('ordStart')}</button></div>`;
  const sub = HI() ? `${orders.length} ऑर्डर • लाइव ट्रैकिंग` : `${orders.length} order(s) • live tracking`;
  return `<div class="sec-head" style="margin-top:6px"><div><h2>📦 ${t('ordTitle')}</h2><p>${sub}</p></div></div>` +
  [...orders].reverse().map(o=>`<div class="order-card"><div class="order-top"><b>#${o.id}</b>
    <span class="status st-${['placed','preparing','shipped','out','delivered'][o.status]}">${statusName(o.status)}</span></div>
    <div class="order-items">${o.items.map(i=>{const p=getP(i.id);return p?p.e:'📦';}).join('')}</div>
    <div class="order-meta"><span>🧾 ${o.items.reduce((a,i)=>a+i.qty,0)} ${t('ordItems')}</span><span>💰 ${fmt(o.total)}</span><span>📅 ${o.date}</span><span>📍 ${esc(o.addr.city||location.n)}</span></div>
    <div class="track-steps">${[0,1,2,3,4].map(i=>`<div class="tstep ${i<=o.status?'done':''}"><div class="tdot">${i<=o.status?'✓':i+1}</div>${statusName(i)}</div>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn secondary sm" data-track="${o.id}">📍 ${t('ordTrack')}</button><button class="btn ghost sm" data-reorder="${o.id}">🔁 ${t('ordReorder')}</button></div>
  </div>`).join('');
}

/* ============================================================
   SELLER CENTRAL
   ============================================================ */
function seedSampleOrders(){
  const ps = getProducts();
  const mk = i => { const a = ps[(i*7)%ps.length], b = ps[(i*7+3)%ps.length];
    return { id:uid('AW').toUpperCase(), items:[{id:a.id,qty:2,price:a.p},{id:b.id,qty:1,price:b.p}],
    total:a.p*2+b.p, sub:0, discount:0, status:Math.min(4,i+1),
    date:new Date(Date.now()-i*864e5).toLocaleString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short'}),
    addr:{name:user?.name||'Guest',line:'221 Baker Street',city:location.n,pin:location.pin}, pay:'UPI (GPay)', placedAt:Date.now()-i*864e5 }; };
  orders.push(mk(0), mk(1), mk(2)); saveOrders();
}
function sellerHTML(){
  const prods = getProducts();
  const rev = orders.reduce((a,o)=>a+o.total,0);
  const avg = prods.length ? (prods.reduce((a,p)=>a+p.r,0)/prods.length).toFixed(1) : '—';
  const days = [];
  for(let i=6;i>=0;i--){ const d = new Date(Date.now()-i*864e5); days.push({ label:'SMTWTFS'[d.getDay()], key:d.toDateString(), total:0 }); }
  orders.forEach(o=>{ const f = days.find(d=>d.key===new Date(o.placedAt||Date.now()).toDateString()); if(f) f.total += o.total; });
  const max = Math.max(...days.map(d=>d.total), 1);
  const bars = days.map((d,i)=>{
    const hgt = Math.max(4, Math.round(d.total/max*104));
    return `<g><rect x="${12+i*46}" y="${132-hgt}" width="30" height="${hgt}" rx="7" style="fill:${d.total?'var(--primary)':'var(--surface-3)'}"/>
    <text x="${27+i*46}" y="150" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--muted)">${d.label}</text>
    ${d.total?`<text x="${27+i*46}" y="${124-hgt}" text-anchor="middle" font-size="9.5" font-weight="800" style="fill:var(--text)">${d.total>=1000?(d.total/1000).toFixed(1)+'k':d.total}</text>`:''}</g>`;
  }).join('');
  const top = [...prods].sort((a,b)=>b.rc-a.rc).slice(0,5);
  const recentOrders = [...orders].reverse().slice(0,5);
  const payout = Math.round(rev*0.93);
  const nextPay = new Date(Date.now()+3*864e5).toLocaleDateString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short'});
  return `<div class="sec-head" style="margin-top:6px"><div><h2>💼 ${t('selTitle')}</h2><p>${t('selSub')}</p></div>
    <div class="seller-actions"><button class="btn secondary sm" id="sView">🏪 ${t('selView')}</button><button class="btn primary sm" id="sAdd">＋ ${t('selAdd')}</button></div></div>
  <div class="stat-grid">
    <div class="stat"><small>${t('selRevenue')}</small><b>${fmt(rev)}</b><span>▲ ${HI()?'इस सप्ताह':'this week'}</span></div>
    <div class="stat"><small>${t('selOrders')}</small><b>${orders.length}</b><span>${orders.filter(o=>o.status<4).length} ${HI()?'चालू':'active'}</span></div>
    <div class="stat"><small>${t('selProducts')}</small><b>${prods.length}</b><span>${VERTICALS.length} verticals</span></div>
    <div class="stat"><small>${t('selRating')}</small><b>${avg}★</b><span>${HI()?'सभी प्रोडक्ट':'all products'}</span></div>
  </div>
  <div class="seller-grid"><div>
    <div class="panel"><h3>📊 ${t('selChart')}</h3><p class="psub">${t('selChartSub')}</p>
      <svg viewBox="0 0 340 158" style="width:100%;display:block">${bars}</svg>
      ${!orders.length?`<p class="muted small center" style="margin:10px 0 2px">${t('selEmpty')}</p><div class="center"><button class="btn secondary sm" id="sSeed">✨ ${t('selSeed')}</button></div>`:''}
    </div>
    <div class="panel"><h3>🧾 ${t('selRecent')}</h3><p class="psub">${orders.length} total</p>
      ${recentOrders.length ? recentOrders.map(o=>`<div class="sord"><span class="so">📦</span><div class="si"><b>#${o.id}</b><small>${o.items.reduce((a,i)=>a+i.qty,0)} ${t('ordItems')} • ${fmt(o.total)} • ${o.date}</small></div>
        <span class="status st-${['placed','preparing','shipped','out','delivered'][o.status]}">${statusName(o.status)}</span>
        ${o.status<4?`<button class="btn secondary sm" data-sadv="${o.id}">${t('selAdvance')} →</button>`:''}</div>`).join('')
      : `<p class="muted small">${t('selEmpty')}</p>`}
    </div>
  </div><div>
    <div class="panel payout"><h3>💰 ${t('selPayout')}</h3><p class="psub">${t('selAvail')}</p>
      <div class="pamt">${fmt(payout)}</div><p class="psub">${t('selNext')}: <b>${nextPay}</b> • UPI</p></div>
    <div class="panel"><h3>🏆 ${t('selTop')}</h3><p class="psub">${t('selProducts')}: ${prods.length}</p>
      ${top.map(p=>`<div class="pm-row"><span class="pe ${p.g}">${mediaHTML(p)}</span><div class="pi"><b>${esc(p.n)}</b><small>★ ${p.r} • ${(p.rc||0).toLocaleString('en-IN')} ratings • ${fmt(p.p)}</small></div>
      <button class="btn secondary sm" data-sedit="${p.id}">${t('selEdit')}</button></div>`).join('')}
    </div>
  </div></div>`;
}

/* ============================================================
   RENDER CORE
   ============================================================ */
function renderPage(){
  const pg = $('#page');
  if(route.page==='home') pg.innerHTML = homeHTML();
  else if(route.page==='shop') pg.innerHTML = shopHTML();
  else if(route.page==='offers') pg.innerHTML = offersHTML();
  else if(route.page==='orders') pg.innerHTML = ordersHTML();
  else if(route.page==='seller') pg.innerHTML = sellerHTML();
  bindCards(pg);
  $$('[data-vert-go]', pg).forEach(b => b.onclick = () => {
    route = { page:'shop', vertical:b.dataset.vertGo, category:'all', query:'', sort:'pop' };
    filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
    renderAll(); window.scrollTo({top:0,behavior:'smooth'});
  });
  $$('[data-hero]', pg).forEach(b => b.onclick = () => {
    route = { page:'shop', vertical:b.dataset.hero, category:'all', query:'', sort:'pop' };
    renderAll(); window.scrollTo({top:0,behavior:'smooth'});
  });
  $$('[data-banner]', pg).forEach(b => b.onclick = () => applyCoupon(BANNERS[+b.dataset.banner].code, true));
  $$('[data-city]', pg).forEach(b => b.onclick = () => {
    const c = CITIES.find(x=>x.n===b.dataset.city);
    if(c){ location = c; LS.set('aw_loc_v1', location); renderNav(); toast(`Delivering to ${c.n} ${c.pin} 📍`,'📍'); }
  });
  $$('[data-fvert]', pg).forEach(b => b.onclick = () => {
    route.vertical = b.dataset.fvert; route.category='all'; filters.cats = new Set(); renderAll();
  });
  $$('[data-fcat]', pg).forEach(c => c.onchange = () => {
    c.checked ? filters.cats.add(c.dataset.fcat) : filters.cats.delete(c.dataset.fcat);
    preserveRender();
  });
  const pr = $('#priceRange'); if(pr) pr.oninput = () => {
    filters.maxPrice = +pr.value; $('#priceLbl').textContent = fmt(+pr.value);
    clearTimeout(pr._t); pr._t = setTimeout(preserveRender, 350);
  };
  $$('input[name=frate]', pg).forEach(r => r.onchange = () => { filters.minRating = +r.value; preserveRender(); });
  const vo = $('#vegOnly'); if(vo) vo.onchange = () => { filters.vegOnly = vo.checked; preserveRender(); };
  const ss = $('#sortSel'); if(ss) ss.onchange = () => { route.sort = ss.value; preserveRender(); };
  const cf = $('#clearFilters'); if(cf) cf.onclick = () => { filters={cats:new Set(),maxPrice:100000,minRating:0,vegOnly:false}; renderAll(); };
  const er = $('#emptyReset'); if(er) er.onclick = () => { filters={cats:new Set(),maxPrice:100000,minRating:0,vegOnly:false}; route.query=''; renderAll(); };
  $$('[data-copy]', pg).forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy); toast(`Code ${b.dataset.copy} copied`,'📋'); });
  $$('[data-apply]', pg).forEach(b => b.onclick = () => applyCoupon(b.dataset.apply));
  $$('[data-track]', pg).forEach(b => b.onclick = () => openTrack(b.dataset.track));
  $$('[data-reorder]', pg).forEach(b => b.onclick = () => {
    const o = orders.find(x=>x.id===b.dataset.reorder);
    if(o){ o.items.forEach(i => { if(getP(i.id)) cart[i.id]=(cart[i.id]||0)+i.qty; }); saveCart(); updateBadges(); renderCart(); openDrawer('cartDrawer'); toast('Items added back to cart','🔁'); }
  });
  // seller bindings
  const sAdd = $('#sAdd'); if(sAdd) sAdd.onclick = ()=>openPM(null);
  const sView = $('#sView'); if(sView) sView.onclick = ()=>{ route.page='home'; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  const sSeed = $('#sSeed'); if(sSeed) sSeed.onclick = ()=>{ seedSampleOrders(); renderPage(); toast('Sample orders added','📦'); };
  $$('[data-sadv]', pg).forEach(b => b.onclick = () => {
    const o = orders.find(x=>x.id===b.dataset.sadv);
    if(o){ o.status=Math.min(4,o.status+1); saveOrders(); renderPage(); toast('Status: '+statusName(o.status),'📦'); }
  });
  $$('[data-sedit]', pg).forEach(b => b.onclick = ()=>openPM(b.dataset.sedit));
  startFlashTimer();
  renderFooter();
}
function preserveRender(){ const y = window.scrollY; renderPage(); window.scrollTo(0, y); }
function renderFooter(){
  const f = $('#footer');
  if(!settings.sections.footer){ f.innerHTML=''; f.style.display='none'; return; }
  f.style.display='';
  const desc = HI() ? 'एक ऐप में खाना, किराना, फैशन, इलेक्ट्रॉनिक्स, दवा, घर व सर्विस — हर जगह, मिनटों में।'
    : 'One app for food, grocery, fashion, electronics, pharmacy, home & services — delivered anywhere, in minutes.';
  const rights = HI() ? '• डेमो प्रोजेक्ट — कोई असली ऑर्डर नहीं' : '• Demo project — no real orders';
  f.innerHTML = `<div class="foot-inner">
    <div class="foot-brand"><a class="logo" href="#"><span class="logo-mark">${settings.logoImg?`<img src="${settings.logoImg}" alt=""/>`:esc(settings.logoEmoji)}</span>
      <span class="logo-text"><b>${esc(settings.storeName)}</b><i>${esc(settings.storeName2)}</i></span></a><p>${esc(settings.tagline)}.<br/>${desc}</p></div>
    <div><h4>${t('ftShop')}</h4>${VERTICALS.slice(0,5).map(v=>`<button data-fv="${v.id}">${v.emoji} ${esc(vname(v))}</button>`).join('')}</div>
    <div><h4>${t('ftCompany')}</h4><a href="#">${t('ftAbout')}</a><a href="#">${t('ftCareers')}</a><a href="#">${t('ftPartner')}</a><a href="#">${t('ftGift')}</a><a href="#">${t('ftBlog')}</a></div>
    <div><h4>${t('ftHelp')}</h4><a href="#">${t('ftHelpC')}</a><a href="#">${t('ftTrack')}</a><a href="#">${t('ftReturns')}</a><a href="#">${t('ftTerms')}</a><button id="footSeller">💼 ${t('ftSeller')}</button><button id="footCustom">🎨 ${t('ftCustom')}</button></div>
  </div><div class="foot-bottom">© 2026 ${esc(settings.storeName)} ${esc(settings.storeName2)} ${rights}</div>`;
  $$('#footer [data-fv]').forEach(b => b.onclick = () => { route={page:'shop',vertical:b.dataset.fv,category:'all',query:'',sort:'pop'}; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); });
  const fc = $('#footCustom'); if(fc) fc.onclick = () => { openDrawer('customDrawer'); renderCustomizer('store'); };
  const fs = $('#footSeller'); if(fs) fs.onclick = () => { route.page='seller'; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
}
function renderAll(){ applySettings(); applyChromeI18n(); renderNav(); renderPage(); updateBadges(); }

/* ---------------- Flash timer ---------------- */
let flashInt = null;
function startFlashTimer(){
  clearInterval(flashInt);
  if(!$('#tH')) return;
  const end = Date.now() + 1000*60*60*5 + 1000*60*23;
  const tick = () => {
    const d = Math.max(0, end - Date.now());
    const h = String(Math.floor(d/3600000)).padStart(2,'0'),
          m = String(Math.floor(d%3600000/60000)).padStart(2,'0'),
          s = String(Math.floor(d%60000/1000)).padStart(2,'0');
    if($('#tH')){ $('#tH').textContent=h; $('#tM').textContent=m; $('#tS').textContent=s; }
    else clearInterval(flashInt);
  };
  tick(); flashInt = setInterval(tick, 1000);
}

/* ============================================================
   CART + WISHLIST
   ============================================================ */
function cartDetailed(){
  return Object.entries(cart).map(([id,qty])=>({p:getP(id),qty})).filter(x=>x.p);
}
function cartTotals(){
  const items = cartDetailed();
  const mrp = items.reduce((a,i)=>a+i.p.m*i.qty,0);
  const sub = items.reduce((a,i)=>a+i.p.p*i.qty,0);
  let discount = 0, freeDel = false;
  const cp = COUPONS.find(c=>c.code===activeCoupon);
  if(cp && sub >= cp.min){
    const eligible = cp.vert ? items.filter(i=>i.p.v===cp.vert).reduce((a,i)=>a+i.p.p*i.qty,0) : sub;
    if(cp.type==='pct'||cp.type==='flat_pct') discount = Math.min(eligible*cp.val/100, cp.cap||Infinity);
    else if(cp.type==='flat') discount = Math.min(cp.val, eligible);
    else if(cp.type==='freedel') freeDel = true;
  }
  const cm = settings.commerce;
  let del = items.length ? cm.deliveryFee : 0;
  if(freeDel || (sub-discount) >= cm.freeAbove || !items.length) del = 0;
  const tax = Math.max(0,(sub-discount)) * cm.taxPct/100;
  return { items, mrp, sub, discount, del, tax, total: Math.max(0, sub-discount+del+tax), count: items.reduce((a,i)=>a+i.qty,0) };
}
function setQty(id, qty){
  qty = Math.max(0, Math.min(20, qty));
  if(qty===0) delete cart[id]; else cart[id]=qty;
  saveCart(); updateBadges(); renderCart();
  preserveRender();
  const pm = $('#pmQty'); if(pm && pm.dataset.id===id) pm.textContent = cart[id]||0;
}
function toggleWish(id){
  wishlist.has(id) ? wishlist.delete(id) : wishlist.add(id);
  saveWish(); updateBadges(); preserveRender(); renderWish();
  toast(wishlist.has(id)?'Saved to wishlist':'Removed from wishlist', wishlist.has(id)?'❤️':'🤍');
}
function updateBadges(){
  const tmp = cartTotals();
  $('#cartCount').textContent = tmp.count;
  const w = $('#wishCount'); w.textContent = wishlist.size; w.classList.toggle('hidden', !wishlist.size);
  $('#cartHeadCount').textContent = tmp.count?`(${tmp.count})`:'';
}
function renderCart(){
  const tt = cartTotals(), box = $('#cartItems'), foot = $('#cartFoot');
  const cm = settings.commerce;
  const pct = Math.min(100, ((tt.sub-tt.discount)/cm.freeAbove)*100);
  const need = fmt(cm.freeAbove-(tt.sub-tt.discount));
  $('#cartFreeBar').innerHTML = !tt.items.length ? '' :
    (tt.del===0 ? `🎉 <b>${t('freeWon')}</b><div class="free-track"><div class="free-fill" style="width:100%"></div></div>`
    : HI() ? `मुफ़्त डिलीवरी के लिए <b>${need}</b> और जोड़ें<div class="free-track"><div class="free-fill" style="width:${pct}%"></div></div>`
    : `Add <b>${need}</b> more for FREE delivery<div class="free-track"><div class="free-fill" style="width:${pct}%"></div></div>`);
  if(!tt.items.length){
    box.innerHTML = `<div class="empty"><div class="big">🛒</div><h3>${t('cartEmpty')}</h3><p>${t('cartEmptySub')}</p></div>`;
    foot.innerHTML = `<button class="btn primary full" data-close="cartDrawer" onclick="closeAll()">${t('cartBrowse')}</button>`;
    bindDrawerClose(foot); return;
  }
  box.innerHTML = tt.items.map(({p,qty})=>`<div class="cart-item"><span class="ce ${p.g}">${mediaHTML(p)}</span>
    <div class="ci"><b>${esc(p.n)}</b><small>${esc(p.s||'')} • ${fmt(p.p)}</small>
    <div class="ci-row"><span class="mini-qty"><button data-cdec="${p.id}">−</button>${qty}<button data-cinc="${p.id}">+</button></span>
    <span class="ci-price">${fmt(p.p*qty)}</span></div></div></div>`).join('');
  $$('[data-cinc]',box).forEach(b=>b.onclick=()=>setQty(b.dataset.cinc,(cart[b.dataset.cinc]||0)+1));
  $$('[data-cdec]',box).forEach(b=>b.onclick=()=>setQty(b.dataset.cdec,(cart[b.dataset.cdec]||0)-1));
  foot.innerHTML = `
    <div class="coupon-box"><input id="couponInput" placeholder="${t('couponPh')}" value="${activeCoupon||''}"/><button class="btn secondary sm" id="couponApply">${activeCoupon?t('remove'):t('apply')}</button></div>
    ${tt.discount?`<div class="bill-row"><span>${t('couponLbl')} (${activeCoupon})</span><span class="off">− ${fmt(tt.discount)}</span></div>`:''}
    <div class="bill-row"><span>${t('subtotal')}</span><span>${fmt(tt.sub)}</span></div>
    <div class="bill-row"><span>${t('delivery')}</span><span>${tt.del?fmt(tt.del):`<b class="off">${t('free')}</b>`}</span></div>
    <div class="bill-row"><span>${t('tax')} (${cm.taxPct}%)</span><span>${fmt(tt.tax)}</span></div>
    <div class="bill-row"><span class="off">${t('saveMrp')}</span><span class="off">${fmt(tt.mrp-tt.sub)}</span></div>
    <div class="bill-row total"><span>${t('total')}</span><span>${fmt(tt.total)}</span></div>
    <button class="btn primary full" id="btnCheckout" style="margin-top:12px">${t('checkoutBtn')}</button>`;
  $('#couponApply').onclick = () => {
    if(activeCoupon){ activeCoupon=null; LS.del('aw_coupon_v1'); }
    else { const v = $('#couponInput').value.trim().toUpperCase(); if(!applyCoupon(v)) return; }
    renderCart();
  };
  $('#btnCheckout').onclick = openCheckout;
}
function renderWish(){
  const box = $('#wishItems');
  const items = [...wishlist].map(getP).filter(Boolean);
  box.innerHTML = items.length ? items.map(p=>`<div class="cart-item"><span class="ce ${p.g}">${mediaHTML(p)}</span>
    <div class="ci"><b>${esc(p.n)}</b><small>${fmt(p.p)}</small>
    <div class="ci-row"><button class="btn primary sm" data-wadd="${p.id}">${HI()?'कार्ट में डालें':'Move to cart'}</button>
    <button class="btn ghost sm" data-wdel="${p.id}">${t('remove')}</button></div></div></div>`).join('')
    : `<div class="empty"><div class="big">🤍</div><h3>${t('wishTitle')}</h3><p>Tap ♥ on anything to save it.</p></div>`;
  $$('[data-wadd]',box).forEach(b=>b.onclick=()=>{ setQty(b.dataset.wadd,(cart[b.dataset.wadd]||0)+1); wishlist.delete(b.dataset.wadd); saveWish(); updateBadges(); renderWish(); });
  $$('[data-wdel]',box).forEach(b=>b.onclick=()=>toggleWish(b.dataset.wdel));
}
function applyCoupon(code, silent){
  code = (code||'').toUpperCase();
  const cp = COUPONS.find(c=>c.code===code);
  if(!cp){ if(!silent) toast('Invalid coupon code','⚠️'); return false; }
  const tt = cartTotals();
  const elig = cp.vert ? tt.items.filter(i=>i.p.v===cp.vert).reduce((a,i)=>a+i.p.p*i.qty,0) : tt.sub;
  if(elig < cp.min){ toast(`Needs min order ${fmt(cp.min)}${cp.vert?' in '+cp.vert:''}`,'⚠️'); return false; }
  activeCoupon = code; LS.set('aw_coupon_v1', code);
  toast(`Coupon ${code} applied!`,'🎉'); renderCart();
  if(route.page==='offers') renderPage();
  return true;
}

/* ============================================================
   DRAWERS + MODALS plumbing
   ============================================================ */
function openDrawer(id){ closeAll(); $('#'+id).classList.add('show'); $('#overlay').classList.add('show'); }
function openModal(id){ $('#'+id).classList.add('show'); }
function closeAll(){
  $$('.drawer').forEach(d=>d.classList.remove('show'));
  $$('.modal-wrap').forEach(m=>m.classList.remove('show'));
  $('#overlay').classList.remove('show');
  $('#sideMenu').classList.remove('show');
}
function bindDrawerClose(root=document){
  $$('[data-close]',root).forEach(b=>{ if(!b._b){ b._b=true; b.onclick=closeAll; } });
  $$('[data-close-modal]',root).forEach(b=>{ if(!b._b){ b._b=true; b.onclick=()=>$('#'+b.dataset.closeModal).classList.remove('show'); } });
}
window.closeAll = closeAll;

/* ============================================================
   PRODUCT MODAL
   ============================================================ */
function openProduct(id){
  const p = getP(id); if(!p) return;
  recent = [id, ...recent.filter(x=>x!==id)].slice(0,12); LS.set('aw_recent_v1', recent);
  const v = vertOf(p.v), c = settings.commerce;
  const revs = [...(myReviews[id]||[]), ...REVIEWS];
  const q = cart[id]||0;
  $('#productModalBox').innerHTML = `
    <div class="pm-img ${p.g}">${mediaHTML(p)}
      ${off(p)?`<span class="off" style="position:absolute;top:14px;left:14px;background:var(--primary);color:#fff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:99px;z-index:2">${off(p)}% OFF</span>`:''}
      <button class="icon-btn" style="position:absolute;top:12px;right:12px;z-index:2" onclick="document.getElementById('productModal').classList.remove('show')">✕</button></div>
    <div class="pm-info">
      <span class="card-store">${v?v.emoji+' '+vname(v):''} • ${esc(p.s||'')}</span>
      <h2>${esc(p.n)}</h2>
      <div class="card-meta">${c.showRatings?`<span class="rate">★ ${p.r}</span><span>${(p.rc||0).toLocaleString('en-IN')} ratings</span>`:''}</div>
      <div class="card-price" style="margin:10px 0"><b style="font-size:24px">${fmt(p.p)}</b>${c.showMrp&&p.m>p.p?`<s>${fmt(p.m)}</s><span class="off" style="color:var(--success);font-weight:800;font-size:13px">${off(p)}% off</span>`:''}</div>
      <p class="muted small" style="line-height:1.65">${esc(p.d||'')}</p>
      <div class="promo-strip" style="margin:12px 0">
        <span class="promo-chip">⏱️ ${esc(p.t||'Fast')}</span>
        ${p.u?`<span class="promo-chip">📦 ${esc(p.u)}</span>`:''}
        ${p.veg!==undefined?`<span class="promo-chip">${p.veg?'🟢 Veg':'🔴 Non-veg'}</span>`:''}
      </div>
      <div style="display:flex;gap:8px;margin:6px 0 14px">
        <div class="mini-qty" style="padding:6px 10px"><button data-pdec="${p.id}">−</button><span id="pmQty" data-id="${p.id}">${q}</span><button data-pinc="${p.id}">+</button></div>
        <button class="btn primary" style="flex:1" data-padd="${p.id}">🛒 ${t('pAddCart')}</button>
        <button class="icon-btn" data-pwish="${p.id}">${wishlist.has(p.id)?'❤️':'🤍'}</button>
      </div>
      <div class="pay-opt" style="padding:10px 14px">🚚 <span class="small">${t('pDeliverTo')} <b>${esc(location.n)} ${esc(location.pin)}</b> — ${esc(p.t||'soon')}</span></div>
      <h4 class="mt">⭐ ${t('pReviews')}</h4>
      <div id="revList">${revs.map(r=>`<div class="rev"><b>${esc(r.n)}</b> <span style="color:#f59e0b">${stars(r.r)}</span><p>${esc(r.t)}</p></div>`).join('')}</div>
      <div class="coupon-box"><input id="revInput" placeholder="${t('pWriteReview')}"/><button class="btn secondary sm" id="revAdd">${t('pPost')}</button></div>
    </div>`;
  openModal('productModal');
  const box = $('#productModalBox');
  $('[data-pinc]',box).onclick = ()=>setQty(p.id,(cart[p.id]||0)+1);
  $('[data-pdec]',box).onclick = ()=>setQty(p.id,(cart[p.id]||0)-1);
  $('[data-padd]',box).onclick = ()=>{ setQty(p.id,(cart[p.id]||0)+1); toast('Added to cart','🛒'); };
  $('[data-pwish]',box).onclick = e=>{ toggleWish(p.id); e.target.textContent = wishlist.has(p.id)?'❤️':'🤍'; };
  $('#revAdd').onclick = ()=>{
    const txt = $('#revInput').value.trim(); if(!txt) return;
    myReviews[id] = [{n:user?.name||'You',r:5,t:txt}, ...(myReviews[id]||[])];
    LS.set('aw_reviews_v1', myReviews); openProduct(id); toast('Review posted, thanks!','⭐');
  };
}

/* ============================================================
   CHECKOUT + UPI
   ============================================================ */
function openCheckout(){
  const tt = cartTotals();
  if(!tt.items.length){ toast('Cart is empty','🛒'); return; }
  coState = { step:0, addr:Object.assign({name:user?.name||'',phone:user?.phone||'',line:'',city:location.n,pin:location.pin}, coState.addr||{}),
    pay:coState.pay||'upi', upi:coState.upi&&coState.upi.id ? coState.upi : { id:'', verified:false, name:'', app:'GPay' } };
  renderCheckout(); closeAll(); openModal('checkoutModal');
}
function upiPanelHTML(total){
  const u = coState.upi;
  return `<div class="upi-box"><h4>⚡ ${t('upiTitle')} — ${fmt(total)}</h4>
    <div class="upi-apps">${UPI_APPS.map(a=>`<button class="upi-app ${u.app===a.id?'sel':''}" data-uapp="${a.id}"><span class="ua" style="background:${a.color}">${a.short}</span>${a.id}</button>`).join('')}</div>
    <div class="field" style="margin-bottom:0"><label>UPI ID</label>
      <div class="upi-row"><input id="upiId" placeholder="${t('upiIdPh')}" value="${esc(u.id)}"/><button class="btn primary sm" id="upiVerify">${u.verified?'✓':''} ${t('upiVerify')}</button></div>
      <span class="upi-msg ${u.verified?'ok':''}" id="upiMsg">${u.verified?'✓ '+esc(u.name):''}</span></div>
    <div class="upi-qr"><canvas id="upiQR" width="132" height="132"></canvas>
      <div><b>${t('upiScan')}</b><small>${t('upiScanSub')}<br/>${settings.storeName} • ${fmt(total)}</small></div></div>
    <div class="upi-note">🔔 ${t('upiNote')}</div>
  </div>`;
}
function renderCheckout(){
  const tt = cartTotals(), box = $('#checkoutBox');
  if(coState.step===0) box.innerHTML = `
    <div class="modal-head"><h3>🧾 ${HI()?'चेकआउट':'Checkout'} — ${t('coAddr')}</h3><button class="icon-btn" onclick="document.getElementById('checkoutModal').classList.remove('show')">✕</button></div>
    <div class="modal-body"><div class="co-steps"><div class="active">1. ${t('coAddr')}</div><div>2. ${t('coPay')}</div><div>3. ${t('coDone')}</div></div>
    <div class="addr-grid">
      <div class="field"><label>${t('coName')}</label><input type="text" id="coName" value="${esc(coState.addr.name)}" placeholder="${t('coName')}"/></div>
      <div class="field"><label>${t('coPhone')}</label><input type="text" id="coPhone" value="${esc(coState.addr.phone)}" placeholder="10-digit mobile"/></div>
    </div>
    <div class="field"><label>${t('coAddrLbl')}</label><input type="text" id="coLine" value="${esc(coState.addr.line)}" placeholder="Flat, street, landmark…"/></div>
    <div class="addr-grid">
      <div class="field"><label>${t('coCity')}</label><input type="text" id="coCity" value="${esc(coState.addr.city)}"/></div>
      <div class="field"><label>${t('coPin')}</label><input type="text" id="coPin" value="${esc(coState.addr.pin)}"/></div>
    </div>
    <div class="bill-row total"><span>${t('coPayable')}</span><span>${fmt(tt.total)}</span></div>
    <button class="btn primary full" id="coNext" style="margin-top:12px">${t('coContinue')}</button></div>`;
  else if(coState.step===1) box.innerHTML = `
    <div class="modal-head"><h3>💳 ${HI()?'चेकआउट':'Checkout'} — ${t('coPay')}</h3><button class="icon-btn" onclick="document.getElementById('checkoutModal').classList.remove('show')">✕</button></div>
    <div class="modal-body"><div class="co-steps"><div>1. ${t('coAddr')}</div><div class="active">2. ${t('coPay')}</div><div>3. ${t('coDone')}</div></div>
    ${[['upi','📱',t('payUpi')],['card','💳',t('payCard')],['cod','💵',t('payCod')],['wallet','👛',t('payWallet')]].map(([v,e,l])=>
      `<div class="pay-opt ${coState.pay===v?'sel':''}" data-pay="${v}"><span class="pe">${e}</span>${l}</div>`).join('')}
    ${coState.pay==='upi' ? upiPanelHTML(tt.total) : ''}
    <div class="bill-row"><span>${t('coItems')} (${tt.count})</span><span>${fmt(tt.sub)}</span></div>
    ${tt.discount?`<div class="bill-row"><span>${t('coCoupon')}</span><span class="off">− ${fmt(tt.discount)}</span></div>`:''}
    <div class="bill-row"><span>${t('coDelTax')}</span><span>${fmt(tt.del+tt.tax)}</span></div>
    <div class="bill-row total"><span>${t('coTotal')}</span><span>${fmt(tt.total)}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn secondary" id="coBack">${t('coBack')}</button>
    <button class="btn primary" style="flex:1" id="coPlace">${t('coPlace')} • ${fmt(tt.total)}</button></div></div>`;
  if(coState.step===0){
    $('#coNext').onclick = ()=>{
      coState.addr = { name:$('#coName').value.trim(), phone:$('#coPhone').value.trim(), line:$('#coLine').value.trim(), city:$('#coCity').value.trim(), pin:$('#coPin').value.trim() };
      if(!coState.addr.name || !coState.addr.phone || !coState.addr.line){ toast('Please fill name, phone & address','⚠️'); return; }
      coState.step=1; renderCheckout();
    };
  } else if(coState.step===1){
    $$('[data-pay]',box).forEach(b=>b.onclick=()=>{ coState.pay=b.dataset.pay; renderCheckout(); });
    $$('[data-uapp]',box).forEach(b=>b.onclick=()=>{ coState.upi.app=b.dataset.uapp; renderCheckout(); });
    const qc = $('#upiQR'); if(qc) drawUPIQR(qc, `aw-${Math.round(tt.total)}-${coState.upi.app}`);
    const ui = $('#upiId');
    if(ui){
      ui.oninput = ()=>{ coState.upi.id = ui.value.trim(); coState.upi.verified = false; $('#upiMsg').textContent=''; $('#upiMsg').className='upi-msg'; };
      $('#upiVerify').onclick = ()=>{
        const v = ui.value.trim(), msg = $('#upiMsg');
        if(!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v)){ msg.textContent = '⚠️ '+t('upiInvalid'); msg.className='upi-msg err'; return; }
        msg.textContent = '⏳ '+t('upiVerifying'); msg.className='upi-msg';
        $('#upiVerify').disabled = true;
        setTimeout(()=>{
          const nm = v.split('@')[0].replace(/[._\-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
          coState.upi = { id:v, verified:true, name:nm||'UPI User', app:coState.upi.app };
          renderCheckout(); toast(`UPI verified: ${coState.upi.name} ✓`,'⚡');
        }, 1100);
      };
    }
    $('#coBack').onclick = ()=>{ coState.step=0; renderCheckout(); };
    $('#coPlace').onclick = ()=>{
      if(coState.pay==='upi' && !coState.upi.verified){ toast(HI()?'पहले अपनी UPI ID वेरिफाई करें':'Please verify your UPI ID first','⚠️'); return; }
      const btn = $('#coPlace'); btn.disabled = true;
      const payLabel = coState.pay==='upi' ? `UPI (${coState.upi.app})` : coState.pay.toUpperCase();
      btn.textContent = coState.pay==='upi' ? `⏳ ${t('upiWait')} ${coState.upi.app}…` : t('coPlacing');
      setTimeout(()=>{
        const o = { id:uid('AW').toUpperCase(), items:tt.items.map(i=>({id:i.p.id,qty:i.qty,price:i.p.p})),
          total:Math.round(tt.total), sub:Math.round(tt.sub), discount:Math.round(tt.discount),
          status:0, date:new Date().toLocaleString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),
          addr:coState.addr, pay:payLabel, upi:coState.pay==='upi'?coState.upi.id:'', placedAt:Date.now() };
        orders.push(o); saveOrders();
        cart={}; activeCoupon=null; saveCart(); LS.del('aw_coupon_v1'); updateBadges();
        const soon = HI() ? `${esc(o.addr.city)} में जल्द आ रहा है` : `arriving soon at ${esc(o.addr.city)}`;
        box.innerHTML = `<div class="modal-body"><div class="success-box"><div class="big">🎉</div>
          <h2>${t('coSuccess')}</h2><p class="muted">${HI()?'ऑर्डर':'Order'} <b>#${o.id}</b> • ${fmt(o.total)} • ${soon}</p>
          <div class="track-steps" style="margin:18px 0">${[0,1,2,3,4].map(i=>`<div class="tstep ${i===0?'done':''}"><div class="tdot">${i===0?'✓':i+1}</div>${statusName(i)}</div>`).join('')}</div>
          <div style="display:flex;gap:8px;justify-content:center"><button class="btn primary" id="okTrack">📍 ${t('coTrack')}</button>
          <button class="btn secondary" id="okShop">${t('coShop')}</button></div></div></div>`;
        $('#okTrack').onclick = ()=>{ $('#checkoutModal').classList.remove('show'); route.page='orders'; renderAll(); openTrack(o.id); };
        $('#okShop').onclick = ()=>{ $('#checkoutModal').classList.remove('show'); route.page='home'; renderAll(); };
      }, coState.pay==='upi' ? 1700 : 1200);
    };
  }
}
function openTrack(id){
  const o = orders.find(x=>x.id===id); if(!o) return;
  const items = o.items.map(i=>{const p=getP(i.id);return p?`${p.e} ${p.n} × ${i.qty}`:'•';});
  const riderTxt = o.status>=4 ? (HI()?'डिलीवर हो गया। आनंद लें!':'Delivered. Enjoy!')
    : (HI()?'राइडर रास्ते में है — जल्द पहुंचेगा':'Arriving soon — rider is '+['being assigned','packing your items','on the way','nearby'][Math.min(o.status,3)]+'…');
  $('#trackBox').innerHTML = `<div class="modal-head"><h3>📍 #${o.id}</h3><button class="icon-btn" onclick="document.getElementById('trackModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    <div class="track-steps" style="margin:8px 0 18px">${[0,1,2,3,4].map(i=>`<div class="tstep ${i<=o.status?'done':''}"><div class="tdot">${i<=o.status?'✓':i+1}</div>${statusName(i)}</div>`).join('')}</div>
    <div class="rev"><b>🛵 Rider: Arjun • ★ 4.9</b><p>${riderTxt}</p></div>
    <div class="rev"><b>🧾 ${t('coItems')}</b><p>${items.map(esc).join('<br/>')}</p></div>
    <div class="rev"><b>📍 ${t('pDeliverTo')}</b><p>${esc(o.addr.name)} • ${esc(o.addr.line)}, ${esc(o.addr.city)} ${esc(o.addr.pin)}</p></div>
    <div class="bill-row total"><span>${HI()?'भुगतान':'Paid via'} ${esc(o.pay)}</span><span>${fmt(o.total)}</span></div>
    ${o.status<4?`<button class="btn secondary full" id="simNext" style="margin-top:12px">🔄 ${HI()?'स्टेटस रिफ्रेश करें':'Refresh live status'}</button>`:''}
  </div>`;
  openModal('trackModal');
  const sn = $('#simNext'); if(sn) sn.onclick = ()=>{ o.status=Math.min(4,o.status+1); saveOrders(); openTrack(id); if(route.page==='orders')renderPage(); toast('Status: '+statusName(o.status),'📦'); };
}
setInterval(()=>{
  let moved = false;
  orders.forEach(o=>{ if(o.status<4 && Math.random()<.25){ o.status++; moved=true; } });
  if(moved){ saveOrders(); if(route.page==='orders') renderPage(); }
}, 25000);

/* ============================================================
   LOCATION + AUTH + SEARCH
   ============================================================ */
function renderCities(f=''){
  const q = f.toLowerCase();
  const list = CITIES.filter(c=>(c.n+c.pin).toLowerCase().includes(q));
  $('#cityGrid').innerHTML = list.map(c=>`<div class="city" data-pick="${c.n}"><span class="ce">${c.e}</span><b>${c.n}</b><small>${c.pin}</small></div>`).join('') || `<span class="muted small">${t('noMatch')}</span>`;
  $$('#cityGrid [data-pick]').forEach(b=>b.onclick=()=>{
    location = CITIES.find(x=>x.n===b.dataset.pick); LS.set('aw_loc_v1',location);
    renderNav(); $('#locationModal').classList.remove('show'); renderPage(); toast(`Delivering to ${location.n} 📍`,'📍');
  });
}
function openAuth(mode='login'){
  const render = ()=>{
    $('#tabLogin').classList.toggle('active', mode==='login');
    $('#tabSignup').classList.toggle('active', mode==='signup');
    $('#authForm').innerHTML = user
      ? `<div class="center" style="padding:10px 0"><div style="font-size:56px">👋</div><h3 style="margin:8px 0">${t('auHi')}, ${esc(user.name)}!</h3><p class="muted small">${esc(user.email)}</p>
         <button class="btn secondary full" id="btnLogout">${t('auLogout')}</button></div>`
      : `${mode==='signup'?`<div class="field"><label>${t('auName')}</label><input type="text" id="auName" placeholder="${t('auName')}"/></div>`:''}
        <div class="field"><label>${t('auEmail')}</label><input type="text" id="auEmail" placeholder="you@email.com"/></div>
        <div class="field"><label>${t('auPhone')}</label><input type="text" id="auPhone" placeholder="10-digit mobile"/></div>
        <button class="btn primary full" id="auGo">${mode==='login'?t('auLoginBtn'):t('auCreateBtn')}</button>`;
    if(user){ const lo=$('#btnLogout'); if(lo) lo.onclick=()=>{ user=null; LS.del('aw_user_v1'); toast('Logged out','👋'); render(); }; return; }
    $('#auGo').onclick = ()=>{
      const email = $('#auEmail').value.trim(), phone = $('#auPhone').value.trim();
      const name = mode==='signup' ? $('#auName').value.trim() : (email.split('@')[0]||'Friend');
      if(!email || !phone){ toast('Enter email & phone','⚠️'); return; }
      user = { name: name||'Friend', email, phone }; LS.set('aw_user_v1', user);
      $('#authModal').classList.remove('show'); render(); toast(`Welcome, ${user.name}!`,'🎉');
    };
  };
  $('#tabLogin').onclick = ()=>{ mode='login'; render(); };
  $('#tabSignup').onclick = ()=>{ mode='signup'; render(); };
  render(); openModal('authModal');
}
function bindSearch(inputEl){
  const sug = $('#searchSuggest');
  const go = q => { route={page:'shop',vertical:'all',category:'all',query:q,sort:'pop'}; filters={cats:new Set(),maxPrice:100000,minRating:0,vegOnly:false}; sug.classList.remove('show'); renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  inputEl.addEventListener('input', ()=>{
    const q = inputEl.value.trim().toLowerCase();
    if(q.length<2){ sug.classList.remove('show'); return; }
    const hits = getProducts().filter(p=>(p.n+' '+p.c+' '+p.s).toLowerCase().includes(q)).slice(0,6);
    sug.innerHTML = hits.map(p=>`<div class="sug-item" data-s="${p.id}"><span class="em ${p.g}">${p.e}</span><div><b>${esc(p.n)}</b><small>${esc(p.c)} • ${fmt(p.p)}</small></div></div>`).join('')
      || `<div class="sug-item"><div><b>${t('noMatch')}</b><small>Try "pizza", "milk", "watch"…</small></div></div>`;
    sug.classList.add('show');
    $$('[data-s]',sug).forEach(b=>b.onclick=()=>{ inputEl.value=''; sug.classList.remove('show'); openProduct(b.dataset.s); });
  });
  inputEl.addEventListener('keydown', e=>{ if(e.key==='Enter' && inputEl.value.trim()) go(inputEl.value.trim()); });
  document.addEventListener('click', e=>{ if(!e.target.closest('.search-wrap')) sug.classList.remove('show'); });
  return go;
}

/* ============================================================
   CUSTOMIZER
   ============================================================ */
const CUSTOM_TABS = [['store','🏪 Store'],['theme','🎨 Theme'],['home','🏠 Homepage'],['commerce','💰 Commerce'],['products','📦 Products'],['data','💾 Data']];
function renderCustomizer(tab='store'){
  $('#customTabs').innerHTML = CUSTOM_TABS.map(([id,l])=>`<button class="${id===tab?'active':''}" data-ct="${id}">${l}</button>`).join('');
  $$('#customTabs button').forEach(b=>b.onclick=()=>renderCustomizer(b.dataset.ct));
  const B = $('#customBody'), S = settings;
  if(tab==='store') B.innerHTML = `
    <div class="c-group"><h4>🌐 Language / भाषा</h4><div class="seg" id="cLang">
      <button data-l="en" class="${S.lang==='en'?'active':''}">English</button>
      <button data-l="hi" class="${S.lang==='hi'?'active':''}">हिंदी</button></div></div>
    <div class="c-group"><h4>Brand</h4>
      <div class="field"><label>Logo emoji</label><input type="text" id="cLogo" value="${esc(S.logoEmoji)}"/></div>
      <div class="field"><label>Logo image (optional — overrides emoji)</label>
        <div class="file-row"><input type="file" id="cLogoFile" accept="image/*"/><button class="btn ghost sm" id="cLogoRm">✕</button></div>
        ${S.logoImg?`<div class="center" style="margin-top:8px"><img src="${S.logoImg}" style="width:56px;height:56px;border-radius:14px;object-fit:cover" alt="logo"/></div>`:''}</div>
      <div class="field"><label>Store name (line 1)</label><input type="text" id="cName1" value="${esc(S.storeName)}"/></div>
      <div class="field"><label>Store name (line 2 — gradient)</label><input type="text" id="cName2" value="${esc(S.storeName2)}"/></div>
      <div class="field"><label>Tagline</label><input type="text" id="cTag" value="${esc(S.tagline)}"/></div></div>
    <div class="c-group"><h4>Announcement bar</h4>
      <div class="toggle-row"><span>Show bar</span><label class="switch"><input type="checkbox" id="cAnnShow" ${S.showAnnounce?'checked':''}/><span class="slider"></span></label></div>
      <div class="field"><label>Message</label><input type="text" id="cAnn" value="${esc(S.announce)}"/></div></div>
    <div class="c-group"><h4>Hero section</h4>
      <div class="field"><label>Badge</label><input type="text" id="cHB" value="${esc(S.heroBadge)}"/></div>
      <div class="field"><label>Headline</label><input type="text" id="cHT" value="${esc(S.heroTitle)}"/></div>
      <div class="field"><label>Subtext</label><textarea id="cHS" rows="2">${esc(S.heroSub)}</textarea></div>
      <div class="field"><label>Button 1 / Button 2</label><div style="display:flex;gap:8px"><input type="text" id="cHC1" value="${esc(S.heroCta1)}"/><input type="text" id="cHC2" value="${esc(S.heroCta2)}"/></div></div></div>`;
  if(tab==='theme'){
    const T = S.theme;
    B.innerHTML = `
    <div class="c-group"><h4>Mode</h4><div class="seg" id="cMode">
      ${['light','dark','auto'].map(m=>`<button data-m="${m}" class="${T.mode===m?'active':''}">${m==='light'?'☀️ Light':m==='dark'?'🌙 Dark':'✨ Auto'}</button>`).join('')}</div></div>
    <div class="c-group"><h4>Brand colors</h4><div class="swatch-row">
      ${THEME_PRESETS.map(x=>`<div class="swatch ${T.primary===x.p?'active':''}" data-p="${x.p}" data-s="${x.s}" title="${x.n}" style="background:linear-gradient(135deg,${x.p},${x.s})"></div>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:10px"><div class="colorpick"><input type="color" id="cP1" value="${T.primary}"/><small class="muted">Primary</small></div>
      <div class="colorpick"><input type="color" id="cP2" value="${T.secondary}"/><small class="muted">Secondary</small></div></div></div>
    <div class="c-group"><h4>Typography</h4><div class="field"><select id="cFont">${FONT_OPTIONS.map(f=>`<option value="${esc(f.v)}" ${T.font===f.v?'selected':''}>${f.n}</option>`).join('')}</select></div></div>
    <div class="c-group"><h4>Corner radius: <b id="cRv">${T.radius}px</b></h4><input type="range" class="f-range" id="cR" min="4" max="28" value="${T.radius}"/></div>
    <div class="c-group"><h4>Card style</h4><div class="seg" id="cCard">
      <button data-c="modern" class="${T.cardStyle==='modern'?'active':''}">✨ Modern</button>
      <button data-c="flat" class="${T.cardStyle==='flat'?'active':''}">🧱 Flat</button></div></div>`;
  }
  if(tab==='home'){
    const defs = [['hero','🎯 Hero banner'],['verticals','🧭 Category grid'],['promos','🎁 Promo banners'],['flash','⚡ Flash deals'],['best','🔥 Bestsellers'],['collections','🗂️ Collections'],['services','🛠️ Services'],['cities','🌍 Cities strip'],['testimonials','💬 Testimonials'],['recent','🕘 Recently viewed'],['footer','🦶 Footer']];
    B.innerHTML = `<div class="c-group"><h4>Homepage sections</h4>
      ${defs.map(([k,l])=>`<div class="toggle-row"><span>${l}</span><label class="switch"><input type="checkbox" data-sec="${k}" ${S.sections[k]?'checked':''}/><span class="slider"></span></label></div>`).join('')}</div>
      <p class="muted small">Toggle sections on/off — the homepage rebuilds instantly.</p>`;
  }
  if(tab==='commerce'){
    const C = S.commerce;
    B.innerHTML = `<div class="c-group"><h4>Money</h4>
      <div class="field"><label>Currency symbol</label><input type="text" id="cCur" value="${esc(C.currency)}"/></div>
      <div class="field"><label>Delivery fee</label><input type="number" id="cDel" value="${C.deliveryFee}"/></div>
      <div class="field"><label>Free delivery above</label><input type="number" id="cFree" value="${C.freeAbove}"/></div>
      <div class="field"><label>Tax %</label><input type="number" id="cTax" value="${C.taxPct}"/></div></div>
    <div class="c-group"><h4>Product cards</h4>
      ${[['showRatings','⭐ Show ratings'],['showVeg','🟢 Show veg / non-veg'],['showMrp','💰 Show MRP strike-through'],['showTime','⏱️ Show delivery time']].map(([k,l])=>`<div class="toggle-row"><span>${l}</span><label class="switch"><input type="checkbox" data-cm="${k}" ${C[k]?'checked':''}/><span class="slider"></span></label></div>`).join('')}</div>`;
  }
  if(tab==='products'){
    const all = getProducts();
    B.innerHTML = `<button class="btn primary full" id="cAddP">＋ Add new product</button>
      <p class="muted small center">${all.length} products live in your store</p>
      <div class="field"><input type="text" id="cPSearch" placeholder="🔍 Search products…"/></div>
      <div id="cPList">${all.slice(0,30).map(pmRow).join('')}</div>`;
    $('#cAddP').onclick = ()=>openPM(null);
    $('#cPSearch').oninput = e=>{
      const q = e.target.value.toLowerCase();
      const hits = getProducts().filter(p=>(p.n+p.c+p.v).toLowerCase().includes(q)).slice(0,40);
      $('#cPList').innerHTML = hits.map(pmRow).join(''); bindPmRows();
    };
    bindPmRows();
  }
  if(tab==='data') B.innerHTML = `
    <div class="c-group"><h4>Backup & restore</h4>
      <p class="muted small">Export your theme, store content & product catalog as JSON. Import it on any device.</p>
      <div style="display:flex;gap:8px"><button class="btn secondary full" id="dExp">⬇ Export JSON</button><button class="btn secondary full" id="dImp">⬆ Import JSON</button></div></div>
    <div class="c-group"><h4>Demo data</h4>
      <div class="toggle-row"><span>Sample orders</span><button class="btn ghost sm" id="dSeed">Add sample</button></div>
      <div class="toggle-row"><span>Reset everything</span><button class="btn danger-ghost sm" id="dReset">Reset</button></div></div>
    <div class="c-group"><h4>About</h4><p class="muted small">${getProducts().length} products • ${VERTICALS.length} verticals • ${orders.length} orders<br/>All data lives in your browser (localStorage).</p></div>`;
  bindCustomizer(tab);
}
function pmRow(p){
  return `<div class="pm-row"><span class="pe ${p.g}">${mediaHTML(p)}</span><div class="pi"><b>${esc(p.n)}</b><small>${esc(p.v)} • ${fmt(p.p)}${p.img?' • 🖼️':''}</small></div>
  <button class="btn secondary sm" data-pedit="${p.id}">Edit</button><button class="btn danger-ghost sm" data-pdel="${p.id}">✕</button></div>`;
}
function bindPmRows(){
  $$('#cPList [data-pedit]').forEach(b=>b.onclick=()=>openPM(b.dataset.pedit));
  $$('#cPList [data-pdel]').forEach(b=>b.onclick=()=>{
    const p = getP(b.dataset.pdel);
    if(!confirm(`Delete "${p.n}"?`)) return;
    extraProducts = extraProducts.filter(x=>x.id!==p.id); LS.set('aw_products_extra_v1', extraProducts);
    if(SEED_PRODUCTS.find(x=>x.id===p.id)){ deletedIds.push(p.id); LS.set('aw_products_deleted_v1', deletedIds); }
    delete editedProducts[p.id]; LS.set('aw_products_edited_v1', editedProducts);
    delete cart[p.id]; saveCart(); updateBadges();
    renderCustomizer('products'); renderPage(); toast('Product deleted','🗑️');
  });
}
function bindCustomizer(tab){
  const live = ()=>{ saveSettings(); applySettings(); applyChromeI18n(); renderNav(); renderPage(); };
  if(tab==='store'){
    $$('#cLang button').forEach(b=>b.onclick=()=>{ settings.lang=b.dataset.l; saveSettings(); renderAll(); renderCustomizer('store'); });
    $('#cLogo').oninput = e=>{ settings.logoEmoji=e.target.value; live(); };
    $('#cLogoFile').onchange = async e=>{
      const f = e.target.files[0]; if(!f) return;
      try{ settings.logoImg = await fileToDataURL(f, 256, .85); live(); renderCustomizer('store'); toast('Logo updated','🖼️'); }
      catch{ toast('Could not read that image','⚠️'); }
    };
    $('#cLogoRm').onclick = ()=>{ settings.logoImg=''; live(); renderCustomizer('store'); };
    $('#cName1').oninput = e=>{ settings.storeName=e.target.value; live(); };
    $('#cName2').oninput = e=>{ settings.storeName2=e.target.value; live(); };
    $('#cTag').oninput = e=>{ settings.tagline=e.target.value; live(); };
    $('#cAnnShow').onchange = e=>{ settings.showAnnounce=e.target.checked; live(); };
    $('#cAnn').oninput = e=>{ settings.announce=e.target.value; live(); };
    $('#cHB').oninput = e=>{ settings.heroBadge=e.target.value; live(); };
    $('#cHT').oninput = e=>{ settings.heroTitle=e.target.value; live(); };
    $('#cHS').oninput = e=>{ settings.heroSub=e.target.value; live(); };
    $('#cHC1').oninput = e=>{ settings.heroCta1=e.target.value; live(); };
    $('#cHC2').oninput = e=>{ settings.heroCta2=e.target.value; live(); };
  }
  if(tab==='theme'){
    $$('#cMode button').forEach(b=>b.onclick=()=>{ settings.theme.mode=b.dataset.m; live(); renderCustomizer('theme'); });
    $$('#customBody .swatch[data-p]').forEach(s=>s.onclick=()=>{ settings.theme.primary=s.dataset.p; settings.theme.secondary=s.dataset.s; live(); renderCustomizer('theme'); });
    $('#cP1').oninput = e=>{ settings.theme.primary=e.target.value; live(); };
    $('#cP2').oninput = e=>{ settings.theme.secondary=e.target.value; live(); };
    $('#cFont').onchange = e=>{ settings.theme.font=e.target.value; live(); };
    $('#cR').oninput = e=>{ settings.theme.radius=+e.target.value; $('#cRv').textContent=e.target.value+'px'; live(); };
    $$('#cCard button').forEach(b=>b.onclick=()=>{ settings.theme.cardStyle=b.dataset.c; live(); renderCustomizer('theme'); });
  }
  if(tab==='home') $$('[data-sec]').forEach(x=>x.onchange=()=>{ settings.sections[x.dataset.sec]=x.checked; live(); });
  if(tab==='commerce'){
    $('#cCur').oninput = e=>{ settings.commerce.currency=e.target.value||'₹'; live(); renderCart(); };
    $('#cDel').oninput = e=>{ settings.commerce.deliveryFee=+e.target.value||0; live(); renderCart(); };
    $('#cFree').oninput = e=>{ settings.commerce.freeAbove=+e.target.value||0; live(); renderCart(); };
    $('#cTax').oninput = e=>{ settings.commerce.taxPct=+e.target.value||0; live(); renderCart(); };
    $$('[data-cm]').forEach(x=>x.onchange=()=>{ settings.commerce[x.dataset.cm]=x.checked; live(); });
  }
  if(tab==='data'){
    $('#dExp').onclick = exportData; $('#dImp').onclick = ()=>$('#importFile').click();
    $('#dSeed').onclick = ()=>{ seedSampleOrders(); toast('Sample orders added','📦'); };
    $('#dReset').onclick = resetAll;
  }
}
function exportData(){
  const data = { settings, extraProducts, deletedIds, editedProducts, exportedAt:new Date().toISOString() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download = 'anywhere-anything-backup.json'; a.click();
  toast('Backup downloaded','💾');
}
function resetAll(){
  if(!confirm('Reset store, theme, cart & orders to defaults?')) return;
  Object.keys(localStorage).filter(k=>k.startsWith('aw_')).forEach(k=>localStorage.removeItem(k));
  location.reload();
}

/* ---------- Product Manager (add/edit + real images) ---------- */
function openPM(id){
  const p = id ? getP(id) : { n:'',v:'food',c:'Pizza',p:199,m:299,r:4.5,rc:10,e:'📦',g:'g1',d:'',s:'My Store',u:'1 pc',t:'2 days',veg:true,badge:'',img:'' };
  const grads = ['g1','g2','g3','g4','g5','g6','g7','g8'];
  let g = p.g, imgVal = p.img || '';
  $('#pmBox').innerHTML = `<div class="modal-head"><h3>${id?'✏️ Edit product':'＋ Add product'}</h3>
    <button class="icon-btn" onclick="document.getElementById('pmModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:6px">
      <span id="pmPrev" class="pm-img-prev ${p.g}">${mediaHTML(p)}</span>
      <div style="flex:1">
        <div class="field"><label>Emoji icon (fallback)</label><input type="text" id="pmE" value="${esc(p.e)}"/></div>
        <div class="field"><label>Tile gradient</label><div class="swatch-row">${grads.map(x=>`<div class="swatch ${x} ${p.g===x?'active':''}" data-g="${x}" style="border-radius:10px"></div>`).join('')}</div></div>
      </div>
    </div>
    <div class="field"><label>🖼️ Real photo — paste image URL</label><input type="text" id="pmImg" value="${imgVal.startsWith('data:')?'':esc(imgVal)}" placeholder="https://…"/></div>
    <div class="img-or">— OR —</div>
    <div class="field"><div class="file-row"><input type="file" id="pmFile" accept="image/*"/><button class="btn ghost sm" id="pmImgRm">Remove photo</button></div>
      <small class="muted">Upload from your device — auto-compressed & saved in your browser.</small></div>
    <div class="field"><label>Product name</label><input type="text" id="pmN" value="${esc(p.n)}"/></div>
    <div class="addr-grid">
      <div class="field"><label>Vertical</label><select id="pmV">${VERTICALS.map(v=>`<option value="${v.id}" ${p.v===v.id?'selected':''}>${v.emoji} ${v.name}</option>`).join('')}</select></div>
      <div class="field"><label>Category</label><select id="pmC"></select></div>
      <div class="field"><label>Price</label><input type="number" id="pmP" value="${p.p}"/></div>
      <div class="field"><label>MRP</label><input type="number" id="pmM" value="${p.m}"/></div>
      <div class="field"><label>Store / restaurant</label><input type="text" id="pmS" value="${esc(p.s||'')}"/></div>
      <div class="field"><label>Unit (e.g. 1 kg, 1 pc)</label><input type="text" id="pmU" value="${esc(p.u||'')}"/></div>
      <div class="field"><label>Delivery time</label><input type="text" id="pmT" value="${esc(p.t||'')}"/></div>
      <div class="field"><label>Badge (optional)</label><input type="text" id="pmB" value="${esc(p.badge||'')}"/></div>
    </div>
    <div class="field"><label>Description</label><textarea id="pmD" rows="2">${esc(p.d||'')}</textarea></div>
    <label class="f-check"><input type="checkbox" id="pmVeg" ${p.veg?'checked':''}/> 🌱 Vegetarian product</label>
    <button class="btn primary full" id="pmSave" style="margin-top:14px">${id?'Save changes':'Add to store'}</button>
  </div>`;
  openModal('pmModal');
  const refreshPrev = ()=>{ $('#pmPrev').className = `pm-img-prev ${g}`; $('#pmPrev').innerHTML = mediaHTML({ e:$('#pmE').value||'📦', img:imgVal }); };
  const fillCats = ()=>{ const vv = $('#pmV').value; $('#pmC').innerHTML = (CATEGORIES[vv]||['General']).map(c=>`<option ${c===p.c?'selected':''}>${c}</option>`).join(''); };
  fillCats(); $('#pmV').onchange = fillCats;
  $$('#pmBox [data-g]').forEach(s=>s.onclick=()=>{ g=s.dataset.g; $$('#pmBox [data-g]').forEach(x=>x.classList.remove('active')); s.classList.add('active'); refreshPrev(); });
  $('#pmE').oninput = refreshPrev;
  $('#pmImg').oninput = e=>{ imgVal = e.target.value.trim(); refreshPrev(); };
  $('#pmImgRm').onclick = ()=>{ imgVal=''; $('#pmImg').value=''; $('#pmFile').value=''; refreshPrev(); };
  $('#pmFile').onchange = async e=>{
    const f = e.target.files[0]; if(!f) return;
    try{
      imgVal = await fileToDataURL(f, 800, .82);
      if(imgVal.length > 1400000) toast('Large photo — saved, but keep uploads small','⚠️');
      $('#pmImg').value=''; refreshPrev(); toast('Photo added 📸','🖼️');
    }catch{ toast('Could not read that image','⚠️'); }
  };
  $('#pmSave').onclick = ()=>{
    const obj = { id:id||uid('c'), n:$('#pmN').value.trim()||'Untitled', v:$('#pmV').value, c:$('#pmC').value,
      p:+$('#pmP').value||0, m:+$('#pmM').value||0, r:p.r||4.5, rc:p.rc||10, e:$('#pmE').value||'📦', g,
      d:$('#pmD').value, s:$('#pmS').value, u:$('#pmU').value, t:$('#pmT').value, badge:$('#pmB').value, veg:$('#pmVeg').checked, img:imgVal };
    if(id){ const ix = extraProducts.findIndex(x=>x.id===id);
      if(ix>-1) extraProducts[ix]=obj; else editedProducts[id]=obj;
    } else extraProducts.push(obj);
    const ok1 = LS.set('aw_products_extra_v1',extraProducts), ok2 = LS.set('aw_products_edited_v1',editedProducts);
    if(!ok1 || !ok2) toast('Storage full — photo too large, try a smaller image','⚠️');
    $('#pmModal').classList.remove('show'); renderCustomizer('products'); renderPage();
    toast(id?'Product updated':'Product added to store','📦');
  };
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', ()=>{
  renderAll(); renderCart(); renderWish(); renderCities();
  bindDrawerClose();
  $('#overlay').onclick = closeAll;
  $('#btnCart').onclick = ()=>{ renderCart(); openDrawer('cartDrawer'); };
  $('#btnWishlist').onclick = ()=>{ renderWish(); openDrawer('wishDrawer'); };
  $('#btnCustomize').onclick = ()=>{ openDrawer('customDrawer'); renderCustomizer('store'); };
  $('#btnCustomize2').onclick = ()=>{ openDrawer('customDrawer'); renderCustomizer('store'); };
  $('#btnMenu').onclick = ()=>{ $('#sideMenu').classList.add('show'); $('#overlay').classList.add('show'); };
  $('#btnCloseMenu').onclick = closeAll;
  $('#btnUser').onclick = ()=>openAuth('login');
  $('#btnLogin2').onclick = ()=>{ closeAll(); openAuth('login'); };
  $('#btnOffers').onclick = ()=>{ route.page='offers'; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  $('#btnLang').onclick = ()=>{
    settings.lang = HI() ? 'en' : 'hi'; saveSettings(); renderAll();
    toast(HI()?'भाषा: हिंदी 🌐':'Language: English 🌐','🌐');
  };
  $('#logoHome').onclick = e=>{ e.preventDefault(); route={page:'home',vertical:'all',category:'all',query:'',sort:'pop'}; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  $('#btnLocation').onclick = ()=>{ renderCities(); openModal('locationModal'); };
  $('#btnLocation2').onclick = ()=>{ closeAll(); renderCities(); openModal('locationModal'); };
  $('#locSearch').oninput = e=>renderCities(e.target.value);
  $('#btnDetect').onclick = ()=>{ const c = CITIES[Math.floor(Math.random()*CITIES.length)]; location=c; LS.set('aw_loc_v1',c); renderNav(); $('#locationModal').classList.remove('show'); renderPage(); toast(`Location detected: ${c.n} 🎯`,'🎯'); };
  $('#btnTheme').onclick = ()=>{
    const cur = document.documentElement.dataset.theme;
    settings.theme.mode = cur==='dark'?'light':'dark'; saveSettings(); applySettings();
  };
  const goDesk = bindSearch($('#searchInput'));
  $('#btnSearch').onclick = ()=>{ const q=$('#searchInput').value.trim(); if(q) goDesk(q); };
  $('#searchInputM').addEventListener('keydown', e=>{ if(e.key==='Enter'&&e.target.value.trim()) goDesk(e.target.value.trim()); });
  $('#btnExport').onclick = exportData;
  $('#btnImport').onclick = ()=>$('#importFile').click();
  $('#btnResetCustom').onclick = resetAll;
  $('#importFile').onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ try{
      const d = JSON.parse(rd.result);
      if(d.settings){ settings = Object.assign({}, DEFAULT_SETTINGS, d.settings); saveSettings(); }
      if(d.extraProducts){ extraProducts=d.extraProducts; LS.set('aw_products_extra_v1',extraProducts); }
      if(d.deletedIds){ deletedIds=d.deletedIds; LS.set('aw_products_deleted_v1',deletedIds); }
      if(d.editedProducts){ editedProducts=d.editedProducts; LS.set('aw_products_edited_v1',editedProducts); }
      renderAll(); renderCustomizer('store'); toast('Backup restored!','💾');
    }catch{ toast('Invalid backup file','⚠️'); } };
    rd.readAsText(f); e.target.value='';
  };
  $$('.modal-wrap').forEach(m=>m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('show'); }));
  setTimeout(()=>toast(`Welcome to ${settings.storeName} ${settings.storeName2}! 🎉`,'👋'), 600);
});
