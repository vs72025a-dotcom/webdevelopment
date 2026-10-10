/* ============================================================
   AnyWhere Anything — App Engine
   State • Rendering • Cart • Checkout • Customizer
   ============================================================ */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const LS = {
  get:(k,f)=>{ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):f; }catch{ return f; } },
  set:(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },
  del:(k)=>{ try{ localStorage.removeItem(k); }catch{} },
};
const uid = (p='') => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- State ---------------- */
let settings = Object.assign({}, DEFAULT_SETTINGS, LS.get('aw_settings_v1', {}));
settings.sections = Object.assign({}, DEFAULT_SETTINGS.sections, (LS.get('aw_settings_v1', {}).sections||{}));
settings.theme = Object.assign({}, DEFAULT_SETTINGS.theme, (LS.get('aw_settings_v1', {}).theme||{}));
settings.commerce = Object.assign({}, DEFAULT_SETTINGS.commerce, (LS.get('aw_settings_v1', {}).commerce||{}));

let cart = LS.get('aw_cart_v1', {});                 // {id: qty}
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
let coState = { step:0, addr:{}, pay:'upi' };

const saveSettings = () => LS.set('aw_settings_v1', settings);
const saveCart = () => LS.set('aw_cart_v1', cart);
const saveWish = () => LS.set('aw_wish_v1', [...wishlist]);
const saveOrders = () => LS.set('aw_orders_v1', orders);

/* ---------------- Helpers ---------------- */
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
function toast(msg, emoji='✅'){
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `<span>${emoji}</span><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; setTimeout(()=>el.remove(), 300); }, 2600);
}
function stars(r){ const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5-f); }

/* ============================================================
   APPLY SETTINGS → theme + texts
   ============================================================ */
function applySettings(){
  const t = settings.theme, r = document.documentElement;
  r.dataset.theme = t.mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t.mode;
  r.style.setProperty('--primary', t.primary);
  r.style.setProperty('--primary-2', t.secondary);
  r.style.setProperty('--font', t.font);
  r.style.setProperty('--radius', t.radius + 'px');
  r.style.setProperty('--radius-sm', Math.max(6, t.radius-6) + 'px');
  document.body.classList.toggle('flat-cards', t.cardStyle === 'flat');
  $('#logoMark').textContent = settings.logoEmoji || '🌍';
  $('#storeName').textContent = settings.storeName || 'AnyWhere';
  $('#storeName2').textContent = settings.storeName2 || 'Anything';
  $('#storeTagline').textContent = settings.tagline || '';
  $('#sideLogo').textContent = `${settings.logoEmoji||'🌍'} ${settings.storeName||''} ${settings.storeName2||''}`;
  const an = $('#announce');
  an.textContent = settings.announce || '';
  an.classList.toggle('show', !!settings.showAnnounce && !!settings.announce);
  $('#btnTheme').textContent = r.dataset.theme === 'dark' ? '☀️' : '🌙';
  document.title = `${settings.storeName} ${settings.storeName2} — Food, Grocery, Shopping & More`;
}

/* ============================================================
   HEADER / NAV
   ============================================================ */
function renderNav(){
  const nav = $('#catNav');
  const pills = [{id:'all',name:'All',emoji:'🌍'}, ...VERTICALS];
  nav.innerHTML = pills.map(v =>
    `<button class="cat-pill ${route.vertical===v.id && route.page!=='offers' && route.page!=='orders' ? 'active':''}" data-vert="${v.id}">${v.emoji} ${esc(v.name)}</button>`
  ).join('');
  $$('#catNav .cat-pill').forEach(b => b.onclick = () => {
    route = { page:'shop', vertical:b.dataset.vert, category:'all', query:'', sort:'pop' };
    filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
    renderAll(); window.scrollTo({top:0, behavior:'smooth'});
  });
  const links = [
    ['🏠','Home','home'], ['🧭','Explore All','shop'], ['🏷️','Offers & Coupons','offers'],
    ['📦','My Orders','orders'], ['❤️','Wishlist','wish'], ['🎨','Customize Store','custom'],
    ...VERTICALS.map(v => [v.emoji, v.name, 'v:'+v.id]),
  ];
  $('#sideLinks').innerHTML = links.map(([e,n,a]) => `<button data-go="${a}">${e} ${esc(n)}</button>`).join('');
  $$('#sideLinks button').forEach(b => b.onclick = () => {
    closeAll(); const a = b.dataset.go;
    if(a==='home'){ route.page='home'; }
    else if(a==='shop'){ route={page:'shop',vertical:'all',category:'all',query:'',sort:'pop'}; }
    else if(a==='offers'){ route.page='offers'; }
    else if(a==='orders'){ route.page='orders'; }
    else if(a==='wish'){ openDrawer('wishDrawer'); renderWish(); return; }
    else if(a==='custom'){ openDrawer('customDrawer'); renderCustomizer('store'); return; }
    else if(a.startsWith('v:')){ route={page:'shop',vertical:a.slice(2),category:'all',query:'',sort:'pop'}; }
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
      <span>${p.e||'📦'}</span>
      ${off(p)?`<span class="off">${off(p)}% OFF</span>`:''}
      ${c.showVeg && p.v!==undefined && (p.veg!==undefined) ? `<span class="veg ${p.veg?'':'nonveg'}">${p.veg?'🟢':'🔴'}</span>`:''}
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
        ${q===0 ? `<button class="add-btn" data-add="${p.id}">ADD +</button>`
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
        <div><b>10M+</b><small>Happy customers</small></div>
        <div><b>500+</b><small>Cities served</small></div>
        <div><b>4.8★</b><small>Average rating</small></div>
      </div>
    </div>
    <div class="hero-art"><div class="hero-float-wrap">
      <div class="float-card"><span class="fe">🍕</span><b>Food</b><small>30-min delivery</small></div>
      <div class="float-card"><span class="fe">🥦</span><b>Grocery</b><small>Farm fresh</small></div>
      <div class="float-card"><span class="fe">🎧</span><b>Electronics</b><small>Top brands</small></div>
      <div class="float-card"><span class="fe">🧹</span><b>Services</b><small>At doorstep</small></div>
    </div></div>
  </section>`;

  if(S.verticals) h += `<section class="section"><div class="sec-head"><div><h2>Shop by category</h2><p>Every vertical, one cart — jump right in</p></div></div>
    <div class="vert-grid">${VERTICALS.map(v=>`<div class="vert-card" data-vert-go="${v.id}"><span class="ve">${v.emoji}</span><b>${v.name}</b><small>${v.tag}</small></div>`).join('')}</div></section>`;

  if(S.promos) h += `<section class="section"><div class="banner-row">${BANNERS.map((b,i)=>
    `<button class="banner" style="background:${b.bg}" data-banner="${i}"><span class="be">${b.e}</span><b>${b.t}</b><small>${b.s}</small><span class="go">GRAB WITH ${b.code} →</span></button>`).join('')}</div></section>`;

  if(S.flash) h += `<section class="section"><div class="flash"><div class="flash-head"><h2>⚡ Flash Deals — ends in</h2>
    <div class="timer"><span id="tH">00</span>:<span id="tM">00</span>:<span id="tS">00</span></div>
    <button class="link" data-vert-go="all" style="margin-left:auto;color:#fff">View all →</button></div>
    <div class="flash-grid">${flash.map(cardHTML).join('')}</div></div></section>`;

  if(S.best) h += `<section class="section"><div class="sec-head"><div><h2>🔥 Bestsellers near you</h2><p>Most loved this week in ${esc(location.n)}</p></div><button class="link" data-vert-go="all">View all →</button></div>
    <div class="prod-grid">${best.map(cardHTML).join('')}</div></section>`;

  if(S.collections) h += `<section class="section"><div class="sec-head"><div><h2>Curated collections</h2><p>Handpicked shelves for every mood</p></div></div>
    <div class="coll-grid">
      <button class="coll" data-vert-go="food" style="background:linear-gradient(135deg,#f97316,#b91c1c)"><span class="ce">🍔</span><b>Cravings Fix</b><small>30-min delivery • 500+ dishes</small><span class="go">Order now →</span></button>
      <button class="coll" data-vert-go="grocery" style="background:linear-gradient(135deg,#16a34a,#14532d)"><span class="ce">🥬</span><b>Fresh Mandi</b><small>Farm to door in 2 hrs</small><span class="go">Shop fresh →</span></button>
      <button class="coll" data-vert-go="electronics" style="background:linear-gradient(135deg,#4f46e5,#1e1b4b)"><span class="ce">🎧</span><b>Gadget Fest</b><small>Up to 60% off + EMI</small><span class="go">Grab deals →</span></button>
    </div></section>`;

  h += `<section class="section"><div class="sec-head"><div><h2>🍕 Order food in a tap</h2><p>Top rated restaurants near ${esc(location.n)}</p></div><button class="link" data-vert-go="food">View all →</button></div>
    <div class="prod-grid">${food.map(cardHTML).join('')}</div></section>`;

  if(S.services){
    const svcs = prods.filter(p=>p.v==='services').slice(0,3);
    h += `<section class="section"><div class="sec-head"><div><h2>🛠️ Home services</h2><p>Verified pros at your doorstep</p></div><button class="link" data-vert-go="services">View all →</button></div>
    <div class="svc-grid">${svcs.map(p=>`<div class="svc" data-open="${p.id}"><span class="se ${p.g}">${p.e}</span><div><b>${esc(p.n)}</b><p>${esc(p.d.slice(0,70))}…</p><span class="rate">★ ${p.r}</span> <b>${fmt(p.p)}</b> <s class="muted small">${fmt(p.m)}</s></div></div>`).join('')}</div></section>`;
  }

  h += `<section class="section"><div class="sec-head"><div><h2>⚡ Trending in electronics</h2><p>Genuine products with warranty</p></div><button class="link" data-vert-go="electronics">View all →</button></div>
    <div class="prod-grid">${elec.map(cardHTML).join('')}</div></section>`;

  if(S.recent && recent.length) h += `<section class="section"><div class="sec-head"><div><h2>🕘 Recently viewed</h2></div></div>
    <div class="recent-row">${recent.map(id=>{const p=getP(id); return p?`<div class="recent-item" data-open="${p.id}"><div class="re ${p.g}">${p.e}</div><b>${esc(p.n)}</b></div>`:'';}).join('')}</div></section>`;

  if(S.cities) h += `<section class="section"><div class="sec-head"><div><h2>🌍 We deliver Anywhere</h2><p>500+ cities and counting</p></div></div>
    <div class="city-strip">${CITIES.slice(0,6).map(c=>`<div class="city" data-city="${c.n}"><span class="ce">${c.e}</span><b>${c.n}</b><small>${c.pin}</small></div>`).join('')}</div></section>`;

  if(S.testimonials) h += `<section class="section"><div class="sec-head"><div><h2>💬 Loved by millions</h2><p>4.8 average across 2M+ reviews</p></div></div>
    <div class="testi-grid">${TESTIMONIALS.map(t=>`<div class="testi"><div class="stars">${'★'.repeat(t.s)}${'☆'.repeat(5-t.s)}</div><p>"${t.t}"</p><div class="who"><span class="ava">${t.e}</span><div><b>${t.n}</b><small>${t.c} • Verified buyer</small></div></div></div>`).join('')}</div></section>`;

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
  return `<div class="sec-head" style="margin-top:6px"><div>
      <h2>${route.query?`Results for "${esc(route.query)}"`: v?`${v.emoji} ${v.name}`:'🧭 Explore everything'}</h2>
      <p>${list.length} items ${route.vertical!=='all'?'• '+v.tag:''} • delivering to ${esc(location.n)}</p></div></div>
  <div class="chip-row">
    <button class="chip ${route.vertical==='all'?'active':''}" data-fvert="all">🌍 All</button>
    ${VERTICALS.map(x=>`<button class="chip ${route.vertical===x.id?'active':''}" data-fvert="${x.id}">${x.emoji} ${x.name}</button>`).join('')}
  </div>
  <div class="shop-layout">
    <aside class="filters">
      <h3>Filters</h3><span class="small muted">${list.length} results</span>
      <div class="f-group"><h4>Category</h4>${cats.map(c=>`<label class="f-check"><input type="checkbox" data-fcat="${esc(c)}" ${filters.cats.has(c)?'checked':''}/> ${esc(c)}</label>`).join('')||'<span class="small muted">No categories</span>'}</div>
      <div class="f-group"><h4>Max price: <b id="priceLbl">${fmt(filters.maxPrice>99999?100000:filters.maxPrice)}</b></h4>
        <input type="range" class="f-range" id="priceRange" min="100" max="60000" step="100" value="${Math.min(filters.maxPrice,60000)}" /></div>
      <div class="f-group"><h4>Rating</h4>
        ${[0,3,4,4.5].map(r=>`<label class="f-check"><input type="radio" name="frate" value="${r}" ${filters.minRating==r?'checked':''}/> ${r===0?'Any rating':`★ ${r} & above`}</label>`).join('')}</div>
      <div class="f-group"><label class="f-check"><input type="checkbox" id="vegOnly" ${filters.vegOnly?'checked':''}/> 🌱 Veg only</label></div>
      <div class="f-group"><button class="btn secondary full sm" id="clearFilters">Clear all filters</button></div>
    </aside>
    <div>
      <div class="toolbar"><span class="res">${list.length} items found</span>
        <select id="sortSel">
          <option value="pop" ${route.sort==='pop'?'selected':''}>Sort: Popularity</option>
          <option value="plh" ${route.sort==='plh'?'selected':''}>Price: Low → High</option>
          <option value="phl" ${route.sort==='phl'?'selected':''}>Price: High → Low</option>
          <option value="rate" ${route.sort==='rate'?'selected':''}>Rating</option>
          <option value="off" ${route.sort==='off'?'selected':''}>Discount</option>
        </select></div>
      ${list.length?`<div class="prod-grid cols-4">${list.map(cardHTML).join('')}</div>`
        :`<div class="empty"><div class="big">🔍</div><h3>No matches found</h3><p>Try a different search or clear filters.</p><button class="btn primary" id="emptyReset">Clear filters</button></div>`}
    </div>
  </div>`;
}

/* ============================================================
   OFFERS + ORDERS PAGES
   ============================================================ */
function offersHTML(){
  return `<div class="sec-head" style="margin-top:6px"><div><h2>🏷️ Offers & Coupons</h2><p>Stack savings — apply at checkout</p></div></div>
  <div class="promo-strip" style="margin-bottom:18px">${BANNERS.map((b,i)=>`<div class="promo-chip" data-banner="${i}"><span class="pc" style="background:${b.bg}">${b.e}</span><span>${b.t}<br/><small class="muted">${b.code}</small></span></div>`).join('')}</div>
  <div class="coupon-grid">${COUPONS.map(c=>`<div class="coupon"><span class="cc">${c.e}</span><b>${c.t}</b><p>${c.d}</p>
    <div class="code-row"><code>${c.code}</code><button class="btn secondary sm" data-copy="${c.code}">Copy</button><button class="btn primary sm" data-apply="${c.code}">${activeCoupon===c.code?'Applied ✓':'Apply'}</button></div></div>`).join('')}</div>`;
}
const STATUS = ['Placed','Preparing','Shipped','Out for delivery','Delivered'];
function ordersHTML(){
  if(!orders.length) return `<div class="empty" style="padding-top:80px"><div class="big">📦</div><h3>No orders yet</h3><p>Your delicious journey starts with the first cart.</p><button class="btn primary" data-vert-go="all">Start shopping</button></div>`;
  return `<div class="sec-head" style="margin-top:6px"><div><h2>📦 My Orders</h2><p>${orders.length} order(s) • live tracking</p></div></div>` +
  [...orders].reverse().map(o=>`<div class="order-card"><div class="order-top"><b>#${o.id}</b>
    <span class="status st-${['placed','preparing','shipped','out','delivered'][o.status]}">${STATUS[o.status]}</span></div>
    <div class="order-items">${o.items.map(i=>{const p=getP(i.id);return p?p.e:'📦';}).join('')}</div>
    <div class="order-meta"><span>🧾 ${o.items.reduce((a,i)=>a+i.qty,0)} items</span><span>💰 ${fmt(o.total)}</span><span>📅 ${o.date}</span><span>📍 ${esc(o.addr.city||location.n)}</span></div>
    <div class="track-steps">${STATUS.map((s,i)=>`<div class="tstep ${i<=o.status?'done':''}"><div class="tdot">${i<=o.status?'✓':i+1}</div>${s}</div>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn secondary sm" data-track="${o.id}">📍 Track order</button><button class="btn ghost sm" data-reorder="${o.id}">🔁 Reorder</button></div>
  </div>`).join('');
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
  bindCards(pg);
  // home bindings
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
  // shop bindings
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
  // offers bindings
  $$('[data-copy]', pg).forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy); toast(`Code ${b.dataset.copy} copied`,'📋'); });
  $$('[data-apply]', pg).forEach(b => b.onclick = () => applyCoupon(b.dataset.apply));
  // orders bindings
  $$('[data-track]', pg).forEach(b => b.onclick = () => openTrack(b.dataset.track));
  $$('[data-reorder]', pg).forEach(b => b.onclick = () => {
    const o = orders.find(x=>x.id===b.dataset.reorder);
    if(o){ o.items.forEach(i => { if(getP(i.id)) cart[i.id]=(cart[i.id]||0)+i.qty; }); saveCart(); updateBadges(); renderCart(); openDrawer('cartDrawer'); toast('Items added back to cart','🔁'); }
  });
  startFlashTimer();
  renderFooter();
}
function preserveRender(){ const y = window.scrollY; renderPage(); window.scrollTo(0, y); }
function renderFooter(){
  const f = $('#footer');
  if(!settings.sections.footer){ f.innerHTML=''; f.style.display='none'; return; }
  f.style.display='';
  f.innerHTML = `<div class="foot-inner">
    <div class="foot-brand"><a class="logo" href="#"><span class="logo-mark">${settings.logoEmoji}</span>
      <span class="logo-text"><b>${esc(settings.storeName)}</b><i>${esc(settings.storeName2)}</i></span></a>
      <p>${esc(settings.tagline)}.<br/>One app for food, grocery, fashion, electronics, pharmacy, home & services — delivered anywhere, in minutes.</p></div>
    <div><h4>Shop</h4>${VERTICALS.slice(0,5).map(v=>`<button data-fv="${v.id}">${v.emoji} ${v.name}</button>`).join('')}</div>
    <div><h4>Company</h4><a href="#">About us</a><a href="#">Careers</a><a href="#">Become a partner</a><a href="#">Gift cards</a><a href="#">Blog</a></div>
    <div><h4>Help</h4><a href="#">Help center</a><a href="#">Track order</a><a href="#">Returns</a><a href="#">Terms & privacy</a><button id="footCustom">🎨 Customize store</button></div>
  </div><div class="foot-bottom">© 2026 ${esc(settings.storeName)} ${esc(settings.storeName2)} • Crafted for anywhere delivery • Demo project — no real orders</div>`;
  $$('#footer [data-fv]').forEach(b => b.onclick = () => { route={page:'shop',vertical:b.dataset.fv,category:'all',query:'',sort:'pop'}; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); });
  const fc = $('#footCustom'); if(fc) fc.onclick = () => { openDrawer('customDrawer'); renderCustomizer('store'); };
}
function renderAll(){ applySettings(); renderNav(); renderPage(); updateBadges(); }

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
  const t = cartTotals();
  $('#cartCount').textContent = t.count;
  const w = $('#wishCount'); w.textContent = wishlist.size; w.classList.toggle('hidden', !wishlist.size);
  $('#cartHeadCount').textContent = t.count?`(${t.count})`:'';
}
function renderCart(){
  const t = cartTotals(), box = $('#cartItems'), foot = $('#cartFoot');
  const cm = settings.commerce;
  const pct = Math.min(100, ((t.sub-t.discount)/cm.freeAbove)*100);
  $('#cartFreeBar').innerHTML = !t.items.length ? '' :
    (t.del===0 ? `🎉 You've unlocked <b>FREE delivery!</b><div class="free-track"><div class="free-fill" style="width:100%"></div></div>`
    : `Add <b>${fmt(cm.freeAbove-(t.sub-t.discount))}</b> more for FREE delivery<div class="free-track"><div class="free-fill" style="width:${pct}%"></div></div>`);
  if(!t.items.length){
    box.innerHTML = `<div class="empty"><div class="big">🛒</div><h3>Cart is empty</h3><p>Add something delicious.</p></div>`;
    foot.innerHTML = `<button class="btn primary full" data-close="cartDrawer" onclick="closeAll()">Browse products</button>`;
    bindDrawerClose(foot); return;
  }
  box.innerHTML = t.items.map(({p,qty})=>`<div class="cart-item"><span class="ce ${p.g}">${p.e}</span>
    <div class="ci"><b>${esc(p.n)}</b><small>${esc(p.s||'')} • ${fmt(p.p)}</small>
    <div class="ci-row"><span class="mini-qty"><button data-cdec="${p.id}">−</button>${qty}<button data-cinc="${p.id}">+</button></span>
    <span class="ci-price">${fmt(p.p*qty)}</span></div></div></div>`).join('');
  $$('[data-cinc]',box).forEach(b=>b.onclick=()=>setQty(b.dataset.cinc,(cart[b.dataset.cinc]||0)+1));
  $$('[data-cdec]',box).forEach(b=>b.onclick=()=>setQty(b.dataset.cdec,(cart[b.dataset.cdec]||0)-1));
  foot.innerHTML = `
    <div class="coupon-box"><input id="couponInput" placeholder="Coupon code" value="${activeCoupon||''}"/><button class="btn secondary sm" id="couponApply">${activeCoupon?'Remove':'Apply'}</button></div>
    ${t.discount?`<div class="bill-row"><span>Coupon (${activeCoupon})</span><span class="off">− ${fmt(t.discount)}</span></div>`:''}
    <div class="bill-row"><span>Subtotal</span><span>${fmt(t.sub)}</span></div>
    <div class="bill-row"><span>Delivery</span><span>${t.del?fmt(t.del):'<b class="off">FREE</b>'}</span></div>
    <div class="bill-row"><span>Tax (${cm.taxPct}%)</span><span>${fmt(t.tax)}</span></div>
    <div class="bill-row"><span class="off">You save on MRP</span><span class="off">${fmt(t.mrp-t.sub)}</span></div>
    <div class="bill-row total"><span>Total</span><span>${fmt(t.total)}</span></div>
    <button class="btn primary full" id="btnCheckout" style="margin-top:12px">Proceed to checkout →</button>`;
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
  box.innerHTML = items.length ? items.map(p=>`<div class="cart-item"><span class="ce ${p.g}">${p.e}</span>
    <div class="ci"><b>${esc(p.n)}</b><small>${fmt(p.p)}</small>
    <div class="ci-row"><button class="btn primary sm" data-wadd="${p.id}">Move to cart</button>
    <button class="btn ghost sm" data-wdel="${p.id}">Remove</button></div></div></div>`).join('')
    : `<div class="empty"><div class="big">🤍</div><h3>Wishlist is empty</h3><p>Tap ♥ on anything to save it.</p></div>`;
  $$('[data-wadd]',box).forEach(b=>b.onclick=()=>{ setQty(b.dataset.wadd,(cart[b.dataset.wadd]||0)+1); wishlist.delete(b.dataset.wadd); saveWish(); updateBadges(); renderWish(); });
  $$('[data-wdel]',box).forEach(b=>b.onclick=()=>toggleWish(b.dataset.wdel));
}
function applyCoupon(code, silent){
  code = (code||'').toUpperCase();
  const cp = COUPONS.find(c=>c.code===code);
  if(!cp){ if(!silent) toast('Invalid coupon code','⚠️'); return false; }
  const t = cartTotals();
  const elig = cp.vert ? t.items.filter(i=>i.p.v===cp.vert).reduce((a,i)=>a+i.p.p*i.qty,0) : t.sub;
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
    <div class="pm-img ${p.g}"><span>${p.e}</span>
      ${off(p)?`<span class="off" style="position:absolute;top:14px;left:14px;background:var(--primary);color:#fff;font-size:12px;font-weight:800;padding:5px 12px;border-radius:99px">${off(p)}% OFF</span>`:''}
      <button class="icon-btn" style="position:absolute;top:12px;right:12px" onclick="document.getElementById('productModal').classList.remove('show')">✕</button></div>
    <div class="pm-info">
      <span class="card-store">${v?v.emoji+' '+v.name:''} • ${esc(p.s||'')}</span>
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
        <button class="btn primary" style="flex:1" data-padd="${p.id}">🛒 Add to cart</button>
        <button class="icon-btn" data-pwish="${p.id}">${wishlist.has(p.id)?'❤️':'🤍'}</button>
      </div>
      <div class="pay-opt" style="padding:10px 14px">🚚 <span class="small">Deliver to <b>${esc(location.n)} ${esc(location.pin)}</b> — ${esc(p.t||'soon')}</span></div>
      <h4 class="mt">⭐ Ratings & reviews</h4>
      <div id="revList">${revs.map(r=>`<div class="rev"><b>${esc(r.n)}</b> <span style="color:#f59e0b">${stars(r.r)}</span><p>${esc(r.t)}</p></div>`).join('')}</div>
      <div class="coupon-box"><input id="revInput" placeholder="Write a review…"/><button class="btn secondary sm" id="revAdd">Post</button></div>
    </div>`;
  openModal('productModal');
  const box = $('#productModalBox');
  $('[data-pinc]',box).onclick = ()=>setQty(p.id,(cart[p.id]||0)+1);
  $('[data-pdec]',box).onclick = ()=>setQty(p.id,(cart[p.id]||0)-1);
  $('[data-padd]',box).onclick = ()=>{ setQty(p.id,(cart[p.id]||0)+1); toast('Added to cart','🛒'); };
  $('[data-pwish]',box).onclick = e=>{ toggleWish(p.id); e.target.textContent = wishlist.has(p.id)?'❤️':'🤍'; };
  $('#revAdd').onclick = ()=>{
    const t = $('#revInput').value.trim(); if(!t) return;
    myReviews[id] = [{n:user?.name||'You',r:5,t}, ...(myReviews[id]||[])];
    LS.set('aw_reviews_v1', myReviews); openProduct(id); toast('Review posted, thanks!','⭐');
  };
}

/* ============================================================
   CHECKOUT
   ============================================================ */
function openCheckout(){
  const t = cartTotals();
  if(!t.items.length){ toast('Cart is empty','🛒'); return; }
  coState = { step:0, addr:Object.assign({name:user?.name||'',phone:user?.phone||'',line:'',city:location.n,pin:location.pin}, coState.addr||{}), pay:'upi' };
  renderCheckout(); closeAll(); openModal('checkoutModal');
}
function renderCheckout(){
  const t = cartTotals(), box = $('#checkoutBox');
  if(coState.step===0) box.innerHTML = `
    <div class="modal-head"><h3>🧾 Checkout — Address</h3><button class="icon-btn" onclick="document.getElementById('checkoutModal').classList.remove('show')">✕</button></div>
    <div class="modal-body"><div class="co-steps"><div class="active">1. Address</div><div>2. Payment</div><div>3. Done</div></div>
    <div class="addr-grid">
      <div class="field"><label>Full name</label><input type="text" id="coName" value="${esc(coState.addr.name)}" placeholder="Your name"/></div>
      <div class="field"><label>Phone</label><input type="text" id="coPhone" value="${esc(coState.addr.phone)}" placeholder="10-digit mobile"/></div>
    </div>
    <div class="field"><label>Address</label><input type="text" id="coLine" value="${esc(coState.addr.line)}" placeholder="Flat, street, landmark…"/></div>
    <div class="addr-grid">
      <div class="field"><label>City</label><input type="text" id="coCity" value="${esc(coState.addr.city)}"/></div>
      <div class="field"><label>Pincode</label><input type="text" id="coPin" value="${esc(coState.addr.pin)}"/></div>
    </div>
    <div class="bill-row total"><span>Payable</span><span>${fmt(t.total)}</span></div>
    <button class="btn primary full" id="coNext" style="margin-top:12px">Continue to payment →</button></div>`;
  else if(coState.step===1) box.innerHTML = `
    <div class="modal-head"><h3>💳 Checkout — Payment</h3><button class="icon-btn" onclick="document.getElementById('checkoutModal').classList.remove('show')">✕</button></div>
    <div class="modal-body"><div class="co-steps"><div>1. Address</div><div class="active">2. Payment</div><div>3. Done</div></div>
    ${[['upi','📱','UPI — instant & free'],['card','💳','Credit / Debit card'],['cod','💵','Cash on delivery'],['wallet','👛','Wallet']].map(([v,e,l])=>
      `<div class="pay-opt ${coState.pay===v?'sel':''}" data-pay="${v}"><span class="pe">${e}</span>${l}</div>`).join('')}
    <div class="bill-row"><span>Items (${t.count})</span><span>${fmt(t.sub)}</span></div>
    ${t.discount?`<div class="bill-row"><span>Coupon</span><span class="off">− ${fmt(t.discount)}</span></div>`:''}
    <div class="bill-row"><span>Delivery + Tax</span><span>${fmt(t.del+t.tax)}</span></div>
    <div class="bill-row total"><span>Total</span><span>${fmt(t.total)}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn secondary" id="coBack">← Back</button>
    <button class="btn primary" style="flex:1" id="coPlace">Place order • ${fmt(t.total)}</button></div></div>`;
  if(coState.step===0){
    $('#coNext').onclick = ()=>{
      coState.addr = { name:$('#coName').value.trim(), phone:$('#coPhone').value.trim(), line:$('#coLine').value.trim(), city:$('#coCity').value.trim(), pin:$('#coPin').value.trim() };
      if(!coState.addr.name || !coState.addr.phone || !coState.addr.line){ toast('Please fill name, phone & address','⚠️'); return; }
      coState.step=1; renderCheckout();
    };
  } else if(coState.step===1){
    $$('[data-pay]',box).forEach(b=>b.onclick=()=>{ coState.pay=b.dataset.pay; renderCheckout(); });
    $('#coBack').onclick = ()=>{ coState.step=0; renderCheckout(); };
    $('#coPlace').onclick = ()=>{
      const btn = $('#coPlace'); btn.disabled = true; btn.textContent = 'Placing order…';
      setTimeout(()=>{
        const o = { id:uid('AW').toUpperCase(), items:t.items.map(i=>({id:i.p.id,qty:i.qty,price:i.p.p})),
          total:Math.round(t.total), sub:Math.round(t.sub), discount:Math.round(t.discount),
          status:0, date:new Date().toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),
          addr:coState.addr, pay:coState.pay, placedAt:Date.now() };
        orders.push(o); saveOrders();
        cart={}; activeCoupon=null; saveCart(); LS.del('aw_coupon_v1'); updateBadges();
        box.innerHTML = `<div class="modal-body"><div class="success-box"><div class="big">🎉</div>
          <h2>Order placed!</h2><p class="muted">Order <b>#${o.id}</b> • ${fmt(o.total)} • arriving soon at ${esc(o.addr.city)}</p>
          <div class="track-steps" style="margin:18px 0">${STATUS.map((s,i)=>`<div class="tstep ${i===0?'done':''}"><div class="tdot">${i===0?'✓':i+1}</div>${s}</div>`).join('')}</div>
          <div style="display:flex;gap:8px;justify-content:center"><button class="btn primary" id="okTrack">📍 Track order</button>
          <button class="btn secondary" id="okShop">Continue shopping</button></div></div></div>`;
        $('#okTrack').onclick = ()=>{ $('#checkoutModal').classList.remove('show'); route.page='orders'; renderAll(); openTrack(o.id); };
        $('#okShop').onclick = ()=>{ $('#checkoutModal').classList.remove('show'); route.page='home'; renderAll(); };
      }, 1200);
    };
  }
}
function openTrack(id){
  const o = orders.find(x=>x.id===id); if(!o) return;
  const items = o.items.map(i=>{const p=getP(i.id);return p?`${p.e} ${p.n} × ${i.qty}`:'•';});
  $('#trackBox').innerHTML = `<div class="modal-head"><h3>📍 Order #${o.id}</h3><button class="icon-btn" onclick="document.getElementById('trackModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    <div class="track-steps" style="margin:8px 0 18px">${STATUS.map((s,i)=>`<div class="tstep ${i<=o.status?'done':''}"><div class="tdot">${i<=o.status?'✓':i+1}</div>${s}</div>`).join('')}</div>
    <div class="rev"><b>🛵 Rider: Arjun • ★ 4.9</b><p>${o.status>=4?'Delivered. Enjoy!':'Arriving soon — rider is '+['being assigned','packing your items','on the way','nearby'][Math.min(o.status,3)]+'…'}</p></div>
    <div class="rev"><b>🧾 Items</b><p>${items.map(esc).join('<br/>')}</p></div>
    <div class="rev"><b>📍 Delivering to</b><p>${esc(o.addr.name)} • ${esc(o.addr.line)}, ${esc(o.addr.city)} ${esc(o.addr.pin)}</p></div>
    <div class="bill-row total"><span>Paid via ${esc(o.pay.toUpperCase())}</span><span>${fmt(o.total)}</span></div>
    ${o.status<4?`<button class="btn secondary full" id="simNext" style="margin-top:12px">🔄 Refresh live status</button>`:''}
  </div>`;
  openModal('trackModal');
  const sn = $('#simNext'); if(sn) sn.onclick = ()=>{ o.status=Math.min(4,o.status+1); saveOrders(); openTrack(id); if(route.page==='orders')renderPage(); toast('Status: '+STATUS[o.status],'📦'); };
}
// auto-advance orders while app is open (demo live tracking)
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
  $('#cityGrid').innerHTML = list.map(c=>`<div class="city" data-pick="${c.n}"><span class="ce">${c.e}</span><b>${c.n}</b><small>${c.pin}</small></div>`).join('') || '<span class="muted small">No cities match.</span>';
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
      ? `<div class="center" style="padding:10px 0"><div style="font-size:56px">👋</div><h3 style="margin:8px 0">Hi, ${esc(user.name)}!</h3><p class="muted small">${esc(user.email)}</p>
         <button class="btn secondary full" id="btnLogout">Logout</button></div>`
      : `${mode==='signup'?`<div class="field"><label>Name</label><input type="text" id="auName" placeholder="Your name"/></div>`:''}
        <div class="field"><label>Email</label><input type="text" id="auEmail" placeholder="you@email.com"/></div>
        <div class="field"><label>Phone</label><input type="text" id="auPhone" placeholder="10-digit mobile"/></div>
        <button class="btn primary full" id="auGo">${mode==='login'?'Login':'Create account'}</button>`;
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
      || `<div class="sug-item"><div><b>No matches</b><small>Try "pizza", "milk", "watch"…</small></div></div>`;
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
    <div class="c-group"><h4>Brand</h4>
      <div class="field"><label>Logo emoji</label><input type="text" id="cLogo" value="${esc(S.logoEmoji)}"/></div>
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
      ${THEME_PRESETS.map(t=>`<div class="swatch ${T.primary===t.p?'active':''}" data-p="${t.p}" data-s="${t.s}" title="${t.n}" style="background:linear-gradient(135deg,${t.p},${t.s})"></div>`).join('')}</div>
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
  return `<div class="pm-row"><span class="pe ${p.g}">${p.e}</span><div class="pi"><b>${esc(p.n)}</b><small>${esc(p.v)} • ${fmt(p.p)}</small></div>
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
  const live = ()=>{ saveSettings(); applySettings(); renderPage(); };
  if(tab==='store'){
    $('#cLogo').oninput = e=>{ settings.logoEmoji=e.target.value; live(); };
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
    $$('.swatch').forEach(s=>s.onclick=()=>{ settings.theme.primary=s.dataset.p; settings.theme.secondary=s.dataset.s; live(); renderCustomizer('theme'); });
    $('#cP1').oninput = e=>{ settings.theme.primary=e.target.value; live(); };
    $('#cP2').oninput = e=>{ settings.theme.secondary=e.target.value; live(); };
    $('#cFont').onchange = e=>{ settings.theme.font=e.target.value; live(); };
    $('#cR').oninput = e=>{ settings.theme.radius=+e.target.value; $('#cRv').textContent=e.target.value+'px'; live(); };
    $$('#cCard button').forEach(b=>b.onclick=()=>{ settings.theme.cardStyle=b.dataset.c; live(); renderCustomizer('theme'); });
  }
  if(tab==='home') $$('[data-sec]').forEach(t=>t.onchange=()=>{ settings.sections[t.dataset.sec]=t.checked; live(); });
  if(tab==='commerce'){
    $('#cCur').oninput = e=>{ settings.commerce.currency=e.target.value||'₹'; live(); renderCart(); };
    $('#cDel').oninput = e=>{ settings.commerce.deliveryFee=+e.target.value||0; live(); renderCart(); };
    $('#cFree').oninput = e=>{ settings.commerce.freeAbove=+e.target.value||0; live(); renderCart(); };
    $('#cTax').oninput = e=>{ settings.commerce.taxPct=+e.target.value||0; live(); renderCart(); };
    $$('[data-cm]').forEach(t=>t.onchange=()=>{ settings.commerce[t.dataset.cm]=t.checked; live(); });
  }
  if(tab==='data'){
    $('#dExp').onclick = exportData; $('#dImp').onclick = ()=>$('#importFile').click();
    $('#dSeed').onclick = ()=>{
      const ps = getProducts();
      const mk = i => ({ id:uid('AW').toUpperCase(), items:[{id:ps[i*7].id,qty:2,price:ps[i*7].p},{id:ps[i*7+3].id,qty:1,price:ps[i*7+3].p}],
        total:ps[i*7].p*2+ps[i*7+3].p, sub:0, discount:0, status:Math.min(4,i+1),
        date:new Date(Date.now()-i*864e5).toLocaleString('en-IN',{day:'numeric',month:'short'}), addr:{name:user?.name||'Guest',line:'221 Baker Street',city:location.n,pin:location.pin}, pay:'upi', placedAt:Date.now() });
      orders.push(mk(0), mk(1)); saveOrders(); toast('Sample orders added','📦');
    };
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

/* ---------- Product Manager (add/edit) ---------- */
function openPM(id){
  const p = id ? getP(id) : { n:'',v:'food',c:'Pizza',p:199,m:299,r:4.5,rc:10,e:'📦',g:'g1',d:'',s:'My Store',u:'1 pc',t:'2 days',veg:true,badge:'' };
  const grads = ['g1','g2','g3','g4','g5','g6','g7','g8'];
  $('#pmBox').innerHTML = `<div class="modal-head"><h3>${id?'✏️ Edit product':'＋ Add product'}</h3>
    <button class="icon-btn" onclick="document.getElementById('pmModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><span id="pmPrev" class="${p.g}" style="font-size:52px;width:96px;height:96px;border-radius:18px;display:flex;align-items:center;justify-content:center">${p.e}</span>
    <div style="flex:1"><div class="field"><label>Emoji icon</label><input type="text" id="pmE" value="${esc(p.e)}"/></div>
    <div class="field"><label>Tile gradient</label><div class="swatch-row">${grads.map(g=>`<div class="swatch ${g} ${p.g===g?'active':''}" data-g="${g}" style="border-radius:10px"></div>`).join('')}</div></div></div></div>
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
  let g = p.g;
  const fillCats = ()=>{ const vv = $('#pmV').value; $('#pmC').innerHTML = (CATEGORIES[vv]||['General']).map(c=>`<option ${c===p.c?'selected':''}>${c}</option>`).join(''); };
  fillCats(); $('#pmV').onchange = fillCats;
  $$('#pmBox [data-g]').forEach(s=>s.onclick=()=>{ g=s.dataset.g; $$('#pmBox [data-g]').forEach(x=>x.classList.remove('active')); s.classList.add('active'); $('#pmPrev').className=g; });
  $('#pmE').oninput = e=>{ $('#pmPrev').textContent = e.target.value||'📦'; };
  $('#pmSave').onclick = ()=>{
    const obj = { id:id||uid('c'), n:$('#pmN').value.trim()||'Untitled', v:$('#pmV').value, c:$('#pmC').value,
      p:+$('#pmP').value||0, m:+$('#pmM').value||0, r:p.r||4.5, rc:p.rc||10, e:$('#pmE').value||'📦', g,
      d:$('#pmD').value, s:$('#pmS').value, u:$('#pmU').value, t:$('#pmT').value, badge:$('#pmB').value, veg:$('#pmVeg').checked };
    if(id){ const ix = extraProducts.findIndex(x=>x.id===id);
      if(ix>-1) extraProducts[ix]=obj; else editedProducts[id]=obj;
    } else extraProducts.push(obj);
    LS.set('aw_products_extra_v1',extraProducts); LS.set('aw_products_edited_v1',editedProducts);
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
