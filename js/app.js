/* ============================================================
   AnyWhere Anything — App Engine
   State • i18n • Slots • Gifts • Ratings • Cloud • UPI • Map
   Promos • Voice • Calendar • Razorpay
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
const setT = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
const setPH = (id, txt) => { const el = document.getElementById(id); if(el) el.placeholder = txt; };
const cloudUp = () => { try{ if(typeof Cloud !== 'undefined') Cloud.up(); }catch{} };
const cloudOn = () => { try{ return typeof Cloud !== 'undefined' && Cloud.on; }catch{ return false; } };

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
let addrs = LS.get('aw_addrs_v1', []);
let notifs = LS.get('aw_notifs_v1', []);
let pushOn = LS.get('aw_push_v1', false);
let gift = Object.assign({ on:false, msg:'', occasion:0, hide:false }, LS.get('aw_gift_v1', {}));
let riderRatings = LS.get('aw_rider_ratings_v1', {});
let customBanners = LS.get('aw_banners_v1', null);
let rzpKey = LS.get('aw_rzp_v1', '');

let route = { page:'home', vertical:'all', category:'all', query:'', sort:'pop' };
let filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
let coState = { step:0, addr:{}, pay:'upi', upi:{ id:'', verified:false, name:'', app:'GPay' },
  addrId:null, newAddr:false, redeem:false, split:{ on:false, map:{} },
  slot:{ food:'asap', speed:'standard', service:'', serviceDate:'', schedDay:'', schedWin:0, schedTs:0 } };
let ordView = 'list', calCursor = null, calDay = null;

const saveSettings = () => LS.set('aw_settings_v1', settings);
const saveCart = () => LS.set('aw_cart_v1', cart);
const saveWish = () => LS.set('aw_wish_v1', [...wishlist]);
const saveOrders = () => LS.set('aw_orders_v1', orders);
const saveAddrs = () => LS.set('aw_addrs_v1', addrs);
const saveNotifs = () => LS.set('aw_notifs_v1', notifs);
const saveGift = () => LS.set('aw_gift_v1', gift);
const saveBanners = () => LS.set('aw_banners_v1', customBanners);
let loyalty = Object.assign({ pts:0, hist:[], updatedAt:0 }, LS.get('aw_loyal_v1', {}));
const saveLoyalty = () => { loyalty.updatedAt = Date.now(); LS.set('aw_loyal_v1', loyalty); };
let subs = LS.get('aw_subs_v1', []);
const saveSubs = () => LS.set('aw_subs_v1', subs);
let myRef = LS.get('aw_ref_v1', null);
if(!myRef || !myRef.code){
  myRef = { code:'AW-' + Array.from({length:6},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join(''), used:null, count:0 };
  LS.set('aw_ref_v1', myRef);
}

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
const retStatusName = i => t('r'+Math.min(3,Math.max(0,i)));
const occName = i => { const o = GIFT_OCCASIONS[i] || GIFT_OCCASIONS[0]; return HI() ? o.hi : o.en; };
function riderFor(o){
  let s = 0; for(const ch of String(o.id||o)) s += ch.charCodeAt(0);
  return { name: RIDER_NAMES[s % RIDER_NAMES.length], rating: (4.7 + (s % 3) * 0.1).toFixed(1) };
}
function riderAvg(name){
  const r = riderRatings[name] || [];
  if(!r.length) return riderFor({ id:name }).rating;
  return (r.reduce((a,b)=>a+b,0) / r.length).toFixed(1);
}
function timeAgo(ts){
  const m = Math.max(0, Math.floor((Date.now()-ts)/60000));
  if(m < 1) return HI() ? 'अभी' : 'just now';
  if(m < 60) return HI() ? `${m} मि. पहले` : `${m}m ago`;
  const h = Math.floor(m/60);
  if(h < 24) return HI() ? `${h} घं. पहले` : `${h}h ago`;
  return HI() ? `${Math.floor(h/24)} दि. पहले` : `${Math.floor(h/24)}d ago`;
}
function toast(msg, emoji='✅'){
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `<span>${emoji}</span><span>${esc(msg)}</span>`;
  const box = $('#toasts'); if(!box) return;
  box.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; setTimeout(()=>el.remove(), 300); }, 2600);
}
function stars(r){ const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5-f); }
function mediaHTML(p){
  const em = `<span>${p.e||'📦'}</span>`;
  if(p.img) return `${em}<img class="pimg" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()"/>`;
  return em;
}
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
function drawUPIQR(canvas, seedStr){
  const ctx = canvas ? canvas.getContext('2d') : null;
  if(!ctx) return;
  const n = 25, s = canvas.width / n;
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

/* ---------------- Promo banners ---------------- */
const PROMO_GRADIENTS = [
  'linear-gradient(135deg,#f97316,#dc2626)',
  'linear-gradient(135deg,#16a34a,#065f46)',
  'linear-gradient(135deg,#4f46e5,#7c3aed)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#0284c7,#0c4a6e)',
  'linear-gradient(135deg,#b45309,#451a03)',
];
function getBanners(){
  if(customBanners) return customBanners;
  return BANNERS.map((b,i)=>Object.assign({ id:'d'+i, vert:'all' }, b));
}
function initCustomBanners(){
  if(!customBanners) customBanners = BANNERS.map((b,i)=>Object.assign({ id:'d'+i, vert:'all' }, JSON.parse(JSON.stringify(b))));
}
function bannerGo(i){
  const b = getBanners()[i]; if(!b) return;
  const goVert = () => {
    route = { page:'shop', vertical:b.vert, category:'all', query:'', sort:'pop' };
    filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
    renderAll(); window.scrollTo({top:0,behavior:'smooth'});
  };
  if(b.code && b.vert && b.vert !== 'all'){ applyCoupon(b.code, true); goVert(); }
  else if(b.code){ applyCoupon(b.code, false); }
  else if(b.vert && b.vert !== 'all'){ goVert(); }
  else toast(b.t, b.e || '🎁');
}

/* ---------------- Delivery slot builders ---------------- */
const DAY_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_HI = ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
function fmtHour(h){ const ap = h>=12?'PM':'AM'; return `${((h+11)%12)+1} ${ap}`; }
function foodSlots(){
  const out = [{ v:'asap', l:t('slotASAP') }];
  const h = new Date().getHours()+1;
  for(let i=0;i<4;i++){
    const l = `${t('slotToday')}, ${fmtHour((h+i)%24)}–${fmtHour((h+i+1)%24)}`;
    out.push({ v:l, l });
  }
  return out;
}
function serviceSlots(){
  const wins = [['10 AM','12 PM'],['2 PM','4 PM'],['5 PM','7 PM']];
  const out = [], now = new Date();
  for(let d=0; d<3; d++){
    const dt = new Date(now.getTime()+d*864e5);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const dn = (HI()?DAY_HI:DAY_EN)[dt.getDay()];
    const dayL = d===0 ? t('slotToday') : d===1 ? t('slotTomw') : dn;
    wins.forEach(w=>out.push({ v:`${dn}, ${w[0]}–${w[1]}`, l:`${dayL}, ${w[0]}–${w[1]}`, d:iso }));
  }
  return out;
}
function slotSummary(o){
  if(!o.slot) return '';
  const parts = [];
  if(o.slot.food && o.slot.food !== 'asap') parts.push('🍔 ' + o.slot.food);
  if(o.slot.service) parts.push('🛠️ ' + o.slot.service);
  if(o.slot.speed === 'express') parts.push('⚡ ' + t('slotExp'));
  return parts.join(' • ');
}

/* ---------------- v6: scheduling + loyalty + split ---------------- */
const SCHED_WINS = [['9 AM','11 AM'],['11 AM','1 PM'],['1 PM','3 PM'],['3 PM','5 PM'],['5 PM','7 PM'],['7 PM','9 PM']];
function schedDays(){
  const out = [], now = new Date();
  for(let d=0; d<3; d++){
    const dt = new Date(now.getTime()+d*864e5);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const dn = (HI()?DAY_HI:DAY_EN)[dt.getDay()];
    out.push({ d:iso, l:d===0?t('schedToday'):d===1?t('schedTomw'):dn });
  }
  return out;
}
function schedTsFor(dayISO, winIdx){
  const w = SCHED_WINS[winIdx] || SCHED_WINS[0];
  let h = parseInt(w[0]) % 12; if(/PM/i.test(w[0])) h += 12;
  const dt = new Date(dayISO+'T12:00:00'); dt.setHours(h, 0, 0, 0);
  return dt.getTime();
}
function schedLabel(ts){
  if(!ts) return '';
  const d = new Date(ts), iso = isoDay(ts);
  const dayL = iso===isoDay(Date.now()) ? t('schedToday') : iso===addDaysISO(Date.now(),1) ? t('schedTomw')
    : d.toLocaleDateString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short'});
  return `${dayL}, ${fmtHour(d.getHours())}–${fmtHour(d.getHours()+2)}`;
}
function schedCountdown(ts){
  const ms = (ts||0) - Date.now();
  if(ms <= 0) return '';
  const h = Math.floor(ms/36e5), m = Math.round((ms%36e5)/6e4);
  return h>0 ? `${t('schedSoon')} ${h}h ${m}m` : `${t('schedSoon')} ${m}m`;
}
function loyEarnFor(total){ return Math.floor(Math.max(0,total)/10); }
function loyRedeemable(total){
  if(!coState.redeem) return 0;
  return Math.min(loyalty.pts||0, Math.max(0, Math.round(total)));
}
function loyAdd(pts, label){
  loyalty.pts = Math.max(0, (loyalty.pts||0) + pts);
  loyalty.hist.unshift({ ts:Date.now(), pts, label:label||'' });
  loyalty.hist = loyalty.hist.slice(0, 50);
  saveLoyalty(); cloudUp();
}
function splitAddrs(){
  const list = addrs.map(a=>({ id:a.id, label:`${a.label==='home'?'🏠':a.label==='work'?'💼':'📍'} ${a.name} • ${a.city}` }));
  if(coState.newAddr || !addrs.length) list.push({ id:'__new', label:'📝 ' + t('splitNew') });
  return list;
}
function splitHTML(){
  if(!addrs.length) return '';
  const tt = cartTotals();
  if(!tt.items.length) return '';
  let h = `<div class="addr-head" style="margin-top:16px"><h4>📦 ${t('splitTitle')}</h4>
    <label class="switch"><input type="checkbox" id="splitOn" ${coState.split.on?'checked':''}/><span class="slider"></span></label></div>
    <p class="muted small" style="margin:-6px 0 10px">${t('splitSub')}</p>`;
  if(!coState.split.on) return h;
  const opts = splitAddrs();
  h += `<div class="split-list">` + tt.items.map(({p,qty})=>{
    const cur = coState.split.map[p.id] || opts[0].id;
    return `<div class="split-row"><span class="ce ${p.g}">${mediaHTML(p)}</span>
      <div style="flex:1"><b>${esc(p.n)} × ${qty}</b><br/><small class="muted">${fmt(p.p*qty)}</small></div>
      <div><small class="muted">${t('splitTo')}</small><br/><select data-splitfor="${p.id}">${opts.map(o=>`<option value="${o.id}" ${cur===o.id?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div></div>`;
  }).join('') + `</div>`;
  return h;
}
function openWallet(){
  const box = $('#walletBox'); if(!box) return;
  box.innerHTML = `<div class="modal-head"><h3>⭐ ${t('loyTitle')}</h3><button class="icon-btn" onclick="document.getElementById('walletModal').classList.remove('show')">✕</button></div>
  <div class="modal-body"><div class="loy-hero"><small>${t('loyBal')}</small><b>⭐ ${loyalty.pts||0}</b><span>${t('loyRule')}</span></div>
  <div class="ref-box"><span>🎁 <b>${t('refTitle')}</b><br/><small class="muted">${t('refRule')}</small></span>
  <div class="coupon-box"><input id="refCodeOut" readonly value="${myRef.code}"/><button class="btn secondary sm" id="refShare">${t('refShare')}</button></div>
  <div class="coupon-box"><input id="refCodeIn" placeholder="${t('refApply')}" ${myRef.used?`value="${esc(myRef.used)}" disabled`:''}/><button class="btn primary sm" id="refGo" ${myRef.used?'disabled':''}>${t('refGo')}</button></div></div>
  ${leaderboardHTML()}
  <div class="addr-head"><h4>🧾 ${t('loyHist')}</h4></div>
  ${(loyalty.hist||[]).length ? (loyalty.hist||[]).map(h=>`<div class="loy-row"><span class="lr-e">${h.pts>0?'🪙':'💸'}</span><div style="flex:1"><b>${h.pts>0?'+':''}${h.pts} ${t('loyPts')}</b><br/><small class="muted">${esc(h.label||'')}</small></div><small class="muted">${timeAgo(h.ts)}</small></div>`).join('') : `<p class="muted center">${t('loyEmpty')}</p>`}</div>`;
  openModal('walletModal');
  const rs = $('#refShare'); if(rs) rs.onclick = shareReferral;
  const rg = $('#refGo'); if(rg) rg.onclick = ()=>applyReferral(($('#refCodeIn')||{value:''}).value);
  const rd = $('#refDemo'); if(rd) rd.onclick = demoFriendJoin;
}

/* ---------------- v7: subscriptions + referrals + split tracking ---------------- */
function subFreqName(d){ return d===7 ? t('subWeek') : d===14 ? t('sub2Week') : t('subMonth'); }
function addSub(pid, qty, freq){
  const p = getP(pid); if(!p) return null;
  const ex = subs.find(s=>s.pid===pid && s.active!==false);
  if(ex){ ex.qty = qty||ex.qty; ex.freq = freq||ex.freq; ex.nextTs = Date.now()+ex.freq*864e5; saveSubs(); cloudUp(); return ex; }
  const s = { id:uid('SB'), pid, qty:qty||1, freq:freq||7, nextTs:Date.now()+(freq||7)*864e5, active:true, createdAt:Date.now() };
  subs.push(s); saveSubs(); cloudUp();
  notify('🔁 '+t('subBtn'), `${p.e} ${p.n} • ${t('subEvery')} ${subFreqName(s.freq)}`, '🔁');
  return s;
}
function fulfillSubs(){
  let made = [];
  subs.forEach(s=>{
    if(!s || s.active===false || (s.nextTs||0) > Date.now()) return;
    const lines = subItems(s).map(i=>({ p:getP(i.pid), qty:i.qty })).filter(x=>x.p);
    if(!lines.length) return;
    const addr = addrs[0] ? { name:addrs[0].name, phone:addrs[0].phone, line:addrs[0].line, city:addrs[0].city, pin:addrs[0].pin }
      : { name:(user&&user.name)||'Subscriber', phone:(user&&user.phone)||'', line:'', city:location.n, pin:location.pin };
    const sub = lines.reduce((a,x)=>a+x.p.p*x.qty,0), disc = Math.round(sub*SUB_SAVE_PCT/100);
    const cm = settings.commerce;
    const del = (sub-disc) >= cm.freeAbove ? 0 : cm.deliveryFee;
    const tax = Math.max(0,sub-disc)*cm.taxPct/100;
    const total = Math.max(0, Math.round(sub-disc+del+tax));
    const o = { id:uid('AW').toUpperCase(), items:lines.map(x=>({id:x.p.id,qty:x.qty,price:x.p.p})), total, sub, discount:disc,
      status:0, date:new Date().toLocaleString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),
      addr, pay:'Subscription 🔁', upi:'', placedAt:Date.now(), slot:{}, gift:null, rating:null, subId:s.id };
    orders.push(o); made.push(o);
    s.nextTs = Date.now()+s.freq*864e5;
    const earn = loyEarnFor(total);
    if(earn>0) loyAdd(earn, `🔁 ${HI()?'सब्सक्रिप्शन':'Subscription'} #${o.id}`);
  });
  if(made.length){
    saveSubs(); saveOrders(); cloudUp();
    made.forEach(o=>notify('🔁 '+t('subDone'), `#${o.id} • ${fmt(o.total)}`, '🔁'));
  }
  return made.length;
}
function openSubs(){
  const box = $('#subBox'); if(!box) return;
  const rows = subs.map(s=>{
    const nm = subName(s);
    const paused = s.active===false;
    return `<div class="split-row"><div style="flex:1"><b>${esc(nm)}${s.boxId?'':` × ${s.qty}`}</b><br/>
      <small class="muted">${t('subEvery')} ${subFreqName(s.freq)} • ${t('subNext')}: ${new Date(s.nextTs).toLocaleDateString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short'})}</small><br/>
      <span class="status ${paused?'st-placed':'st-delivered'}" style="font-size:11px">${paused?t('subPaused'):t('subActive')}</span></div>
      <div class="sub-btns"><button class="btn ghost sm" data-subskip="${s.id}">⏭ ${t('subSkip')}</button>
      <button class="btn secondary sm" data-subpause="${s.id}">${paused?'▶ '+t('subResume'):t('subPause')}</button>
      <button class="btn danger-ghost sm" data-subdel="${s.id}">✕</button></div></div>`;
  }).join('');
  const boxes = SUB_BOXES.map(b=>{ const on = subs.some(s=>s.boxId===b.id && s.active!==false);
    return `<div class="box-card"><span class="box-e">${b.e}</span><div style="flex:1"><b>${esc(boxName(b))}</b><br/>
    <small class="muted">${b.items.map(i=>{const q=getP(i.pid);return (q?q.e:'📦')+'×'+i.qty;}).join(' ')}</small><br/>
    <small><b>${fmt(boxTotal(b))}</b> • ${t('subEvery')} ${subFreqName(b.freq)}</small></div>
    <button class="btn ${on?'ghost':'primary'} sm" data-boxsub="${b.id}" ${on?'disabled':''}>${on?'✓':t('boxGo')}</button></div>`; }).join('');
  box.innerHTML = `<div class="modal-head"><h3>🔁 ${t('subTitle')}</h3><button class="icon-btn" onclick="document.getElementById('subModal').classList.remove('show')">✕</button></div>
  <div class="modal-body"><div class="addr-head"><h4>📦 ${t('boxTitle')}</h4></div>
  <p class="muted small" style="margin:-6px 0 10px">${t('boxSub')}</p>
  <div class="split-list" style="margin-bottom:14px">${boxes}</div>
  ${subs.length?`<div class="addr-head"><h4>🔁 ${t('subTitle')}</h4></div><div class="split-list">${rows}</div>`:`<div class="empty"><div class="big">🔁</div><p>${t('subEmpty')}</p></div>`}</div>`;
  openModal('subModal');
  $$('[data-boxsub]',box).forEach(b=>b.onclick=()=>{ addBox(b.dataset.boxsub); openSubs(); });
  $$('[data-subskip]',box).forEach(b=>b.onclick=()=>{ const s=subs.find(x=>x.id===b.dataset.subskip); if(s){ s.nextTs=Date.now()+s.freq*864e5; saveSubs(); cloudUp(); openSubs(); toast(t('subNext')+': '+new Date(s.nextTs).toLocaleDateString(),'⏭'); } });
  $$('[data-subpause]',box).forEach(b=>b.onclick=()=>{ const s=subs.find(x=>x.id===b.dataset.subpause); if(s){ s.active=s.active===false?true:false; saveSubs(); cloudUp(); openSubs(); } });
  $$('[data-subdel]',box).forEach(b=>b.onclick=()=>{ subs=subs.filter(x=>x.id!==b.dataset.subdel); saveSubs(); cloudUp(); openSubs(); });
}
function applyReferral(code){
  code = String(code||'').trim().toUpperCase().replace(/^AW-/,'');
  if(!/^[A-Z0-9]{6}$/.test(code) || ('AW-'+code)===myRef.code || myRef.used){ toast(t('refBad'),'⚠️'); return false; }
  myRef.used = 'AW-'+code; LS.set('aw_ref_v1', myRef);
  loyAdd(REF_PTS, `🎁 ${t('refTitle')} — AW-${code}`);
  notify(`🎁 ${t('refOk')}`, `${t('loyBal')}: ${loyalty.pts}`, '🎁');
  openWallet();
  return true;
}
function shareReferral(){
  const txt = HI() ? `मेरे साथ ${settings.storeName} पर शॉप करो! कोड ${myRef.code} लगाओ — हम दोनों को +50 पॉइंट 🎁` : `Shop with me on ${settings.storeName}! Use code ${myRef.code} — we both get +50 pts 🎁`;
  const done = ()=>toast(t('refCopied'),'📋');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(done);
    else done();
  }catch{ done(); }
}
function splitSibs(o){
  if(!o || !o.splitId) return [];
  return orders.filter(x=>x.splitId===o.splitId).sort((a,b)=>(a.splitIdx||0)-(b.splitIdx||0));
}
function splitTrackHTML(o){
  const sibs = splitSibs(o);
  if(sibs.length < 2) return '';
  return `<div class="rev"><b>📦 ${t('trkSplit')}</b><div class="split-list" style="margin-top:10px">${sibs.map(s=>`<div class="split-row"><div style="flex:1"><b>${s.splitIdx} ${t('splitOf')} ${s.splitCount} • #${s.id}</b><br/><small class="muted">📍 ${esc(s.addr.city||'')} • ${statusName(s.status)}</small></div>${s.id===o.id?`<span class="status st-${['placed','preparing','shipped','out','delivered'][s.status]}">${statusName(s.status)}</span>`:`<button class="btn secondary sm" data-sibgo="${s.id}">📍 ${t('trkOpen')}</button>`}</div>`).join('')}</div></div>`;
}
function subEvTitle(o){
  const s = (subs||[]).find(x=>x.id===(o&&o.id));
  if(s && s.boxId) return `<b>${esc(subName(s))}</b>`;
  const it=((o&&o.items)||[])[0]||{}; const p=getP(it.id); return `<b>${p?esc(p.n):'🔁'} × ${it.qty||1}</b>`;
}
/* ---------------- v8: boxes + leaderboard + proof ---------------- */
function boxName(b){ return HI()?b.hi:b.en; }
function boxTotal(b){ return (b.items||[]).reduce((a,i)=>{ const p=getP(i.pid); return a+(p?p.p*i.qty:0); },0); }
function subItems(s){
  if(s && s.box && Array.isArray(s.box.items)) return s.box.items;
  if(!s) return [];
  return [{ pid:s.pid, qty:s.qty||1 }];
}
function subName(s){
  if(s && s.boxId){ const b = SUB_BOXES.find(x=>x.id===s.boxId); if(b) return `${b.e} ${boxName(b)}`; }
  const p = s ? getP(s.pid) : null; return p ? `${p.e} ${p.n}` : (s&&s.pid)||'';
}
function addBox(bid){
  const b = SUB_BOXES.find(x=>x.id===bid); if(!b) return null;
  const ex = subs.find(s=>s.boxId===bid && s.active!==false);
  if(ex){ ex.nextTs = Date.now()+ex.freq*864e5; saveSubs(); cloudUp(); return ex; }
  const s = { id:uid('SB'), pid:(b.items[0]||{}).pid, qty:1, freq:b.freq, nextTs:Date.now()+b.freq*864e5, active:true, createdAt:Date.now(), boxId:bid, box:{ items:b.items.map(i=>({pid:i.pid,qty:i.qty})) } };
  subs.push(s); saveSubs(); cloudUp();
  notify('📦 '+t('boxActive'), `${b.e} ${boxName(b)} • ${t('subEvery')} ${subFreqName(s.freq)}`, '📦');
  return s;
}
function myRefScore(){ return ((myRef.used)?REF_PTS:0) + ((myRef.count||0)*REF_PTS); }
function leaderboardHTML(){
  const rows = REF_BOARD.map(r=>({ n:r.n, pts:r.pts, you:false }));
  rows.push({ n:t('lbYou'), pts:myRefScore(), you:true });
  rows.sort((a,b)=>b.pts-a.pts);
  const medals = ['🥇','🥈','🥉'];
  return `<div class="addr-head"><h4>🏆 ${t('lbTitle')}</h4></div>
  <div class="lb-list">${rows.map((r,i)=>`<div class="lb-row${r.you?' you':''}"><span>${medals[i]||`${i+1}.`}</span><b style="flex:1">${esc(r.n)}${r.you?` <small class="muted">${esc(myRef.code)}</small>`:''}</b><span>${r.pts} ${t('lbPts')}</span></div>`).join('')}</div>
  <p class="muted small center">${t('lbRank')}: <b>#${rows.findIndex(r=>r.you)+1}</b></p>
  <button class="btn ghost sm full" id="refDemo">🧪 ${t('lbDemo')}</button>`;
}
function demoFriendJoin(){
  myRef.count = (myRef.count||0)+1; LS.set('aw_ref_v1', myRef);
  loyAdd(REF_PTS, `🎁 ${t('lbDemo')}`);
  notify(`🎁 ${t('refOk')}`, `${t('loyBal')}: ${loyalty.pts}`, '🎁');
  openWallet();
}
function snapProof(o){
  try{
    if(!o || o.proof) return !!(o&&o.proof);
    if(typeof document==='undefined') return false;
    const c = document.createElement('canvas'); c.width=320; c.height=200;
    const ctx = c.getContext ? c.getContext('2d') : null;
    if(!ctx || !ctx.fillRect) return false;
    const em = (o.items||[]).map(i=>{const p=getP(i.id);return p?p.e:'';}).filter(Boolean).slice(0,3).join(' ')||'📦';
    const g = ctx.createLinearGradient(0,0,320,200);
    g.addColorStop(0,'#0ea5e9'); g.addColorStop(1,'#6366f1');
    ctx.fillStyle=g; ctx.fillRect(0,0,320,200);
    ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(0,150,320,50);
    ctx.font='64px serif'; ctx.textAlign='center'; ctx.fillText(em,160,105);
    ctx.font='bold 20px sans-serif'; ctx.fillStyle='#fff';
    ctx.fillText('✓ '+(HI()?'डिलीवर हुआ':'DELIVERED'),160,140);
    ctx.font='13px sans-serif'; ctx.fillStyle='#e0f2fe';
    ctx.fillText('#'+o.id+' • '+new Date().toLocaleString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),160,175);
    o.proof = c.toDataURL('image/jpeg', .8);
    saveOrders(); cloudUp();
    return true;
  }catch{ return false; }
}
function proofHTML(o){
  if(!o || o.status!==4) return '';
  if(o.proof) return `<div class="rev"><b>📸 ${t('proofTitle')}</b><img class="proof-img" src="${o.proof}" alt="proof"/><p class="muted small">✓ ${t('proofBy')}</p></div>`;
  return `<div class="rev"><b>📸 ${t('proofTitle')}</b><p class="muted small">${t('proofNone')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn secondary sm" id="proofSnap">📸 ${t('proofSnap')}</button>
    <label class="btn ghost sm" style="cursor:pointer">⬆ ${t('proofUpload')}<input type="file" id="proofFile" accept="image/*" hidden/></label></div></div>`;
}
function bindProof(o){
  const sn = $('#proofSnap');
  if(sn) sn.onclick = ()=>{ if(snapProof(o)){ saveOrders(); cloudUp(); openTrack(o.id); if(route.page==='orders')renderPage(); toast('📸 '+t('proofTitle'),'📸'); } else toast(t('proofNone'),'⚠️'); };
  const pf = $('#proofFile');
  if(pf) pf.onchange = ()=>{
    const f = pf.files && pf.files[0]; if(!f) return;
    fileToDataURL(f, 640, .75).then(url=>{ o.proof=url; saveOrders(); cloudUp(); openTrack(o.id); if(route.page==='orders')renderPage(); toast('📸 '+t('proofTitle'),'📸'); }).catch(()=>toast(t('proofNone'),'⚠️'));
  };
}

/* ---------------- Calendar helpers ---------------- */
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const addDaysISO = (ts, n) => isoDay(new Date(ts).getTime()+n*864e5);
function expectedDelivery(o){
  if(o.scheduledFor) return isoDay(o.scheduledFor);
  if(o.slot && o.slot.serviceDate) return o.slot.serviceDate;
  const hasShip = o.items.some(i=>{ const p = getP(i.id); return p && !['food','services'].includes(p.v); });
  const onlyFood = o.items.every(i=>{ const p = getP(i.id); return p && p.v==='food'; });
  if(onlyFood) return isoDay(o.placedAt||Date.now());
  if(o.slot && o.slot.speed==='express') return addDaysISO(o.placedAt||Date.now(), 1);
  if(hasShip) return addDaysISO(o.placedAt||Date.now(), 3);
  return isoDay(o.placedAt||Date.now());
}
function orderEvents(){
  const evs = [];
  try{
    (subs||[]).forEach(s=>{
      if(!s || s.active===false) return;
      for(let k=0;k<2;k++) evs.push({ d:isoDay((s.nextTs||Date.now())+k*(s.freq||30)*864e5), type:'sub', o:{ id:s.id, total:0, items:subItems(s).map(i=>({id:i.pid,qty:i.qty})), addr:{city:''} } });
    });
  }catch{}
  orders.forEach(o=>{
    evs.push({ d:isoDay(o.placedAt||Date.now()), type:'placed', o });
    const svc = !!(o.slot && o.slot.serviceDate);
    evs.push({ d:expectedDelivery(o), type:svc?'service':'delivery', o });
  });
  return evs;
}

/* ---------------- Notifications ---------------- */
function notify(title, body, e='🔔'){
  notifs.unshift({ id:uid('n'), title, body, e, ts:Date.now(), read:false });
  notifs = notifs.slice(0, 40); saveNotifs(); updateBadges();
  const dr = $('#notifDrawer');
  if(dr && dr.classList.contains('show')) renderNotifs();
  if(pushOn && 'Notification' in window && Notification.permission === 'granted'){
    try{ new Notification(title, { body }); }catch{}
  }
}
function renderNotifs(){
  const box = $('#notifBody'); if(!box) return;
  const granted = 'Notification' in window && Notification.permission === 'granted';
  box.innerHTML = `
    <div class="push-row"><span style="font-size:24px">${pushOn&&granted?'🔔':'🔕'}</span>
      <span>${pushOn&&granted ? t('notifOn') : t('notifEnable')}<small>${HI()?'ऑर्डर अपडेट तुरंत पाएं':'Get order updates instantly'}</small></span>
      ${pushOn&&granted ? '' : `<button class="btn primary sm" id="btnPush">${t('notifEnable')}</button>`}
    </div>
    ${notifs.length ? `<div class="addr-head"><h4>🔔 ${t('notifTitle')}</h4><button class="btn ghost sm" id="btnClearN">${t('notifClear')}</button></div>` : ''}
    ${notifs.length ? notifs.map(n=>`<div class="notif-item ${n.read?'':'unread'}"><span class="ne">${n.e}</span>
      <div><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${timeAgo(n.ts)}</small></div></div>`).join('')
    : `<div class="empty"><div class="big">🔔</div><h3>${t('notifEmpty')}</h3><p>${t('notifEmptySub')}</p></div>`}`;
  const bp = $('#btnPush');
  if(bp) bp.onclick = async ()=>{
    if(!('Notification' in window)){ toast('Push not supported here','⚠️'); return; }
    const gr = await Notification.requestPermission();
    if(gr === 'granted'){ pushOn = true; LS.set('aw_push_v1', true); renderNotifs(); notify(HI()?'पुश अलर्ट चालू 🎉':'Push alerts ON 🎉', HI()?'अब हर ऑर्डर अपडेट मिलेगा':'You will now get every order update', '🔔'); }
    else toast('Permission denied','⚠️');
  };
  const bc = $('#btnClearN');
  if(bc) bc.onclick = ()=>{ notifs = []; saveNotifs(); updateBadges(); renderNotifs(); };
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
  if(lm){ if(settings.logoImg) lm.innerHTML = `<img src="${settings.logoImg}" alt="logo"/>`; else lm.textContent = settings.logoEmoji || '🌍'; }
  setT('storeName', settings.storeName || 'AnyWhere');
  setT('storeName2', settings.storeName2 || 'Anything');
  setT('storeTagline', settings.tagline || '');
  setT('sideLogo', `${settings.logoImg?'🏪':(settings.logoEmoji||'🌍')} ${settings.storeName||''} ${settings.storeName2||''}`);
  const an = $('#announce');
  if(an){ an.textContent = settings.announce || ''; an.classList.toggle('show', !!settings.showAnnounce && !!settings.announce); }
  const bt = $('#btnTheme'); if(bt) bt.textContent = r.dataset.theme === 'dark' ? '☀️' : '🌙';
  document.title = `${settings.storeName} ${settings.storeName2} — Food, Grocery, Shopping & More`;
}
function applyChromeI18n(){
  setPH('searchInput', t('searchPh'));
  setPH('searchInputM', t('searchPhM'));
  setT('btnSearch', t('search'));
  setT('btnLang', HI() ? 'हिं' : 'EN');
  document.documentElement.lang = HI() ? 'hi' : 'en';
  const cs = $('.cart-btn span'); if(cs) cs.textContent = t('cart');
  const lt = $('.loc-text small'); if(lt) lt.textContent = t('deliverTo');
  setT('cartTitle', t('cartTitle'));
  setT('wishTitle', '❤️ ' + t('wishTitle'));
  setT('notifTitle', '🔔 ' + t('notifTitle'));
  const bb = $('#btnBell'); if(bb) bb.title = t('notifTitle');
  setT('locTitle', '📍 ' + t('locTitle'));
  setT('locSearchLabel', t('locSearchPh'));
  setPH('locSearch', t('locHint'));
  setT('btnDetect', '🎯 ' + t('locDetect'));
  setT('locPop', t('locPop'));
  setT('authTitle', '👋 ' + t('auWelcome'));
  setT('tabLogin', t('auLogin'));
  setT('tabSignup', t('auSignup'));
  setT('authNote', t('auDemo'));
  setT('btnCustomize2', '🎨 ' + t('sideCustom'));
  setT('btnLogin2', '👤 ' + t('sideLogin'));
  const m = { home:'bHome', shop:'bExplore', offers:'bOffers', orders:'bOrders', cart:'bCart' };
  $$('.bottom-nav button').forEach(b => { const s = b.querySelector('small'); if(s) s.textContent = t(m[b.dataset.nav]); });
}

/* ============================================================
   HEADER / NAV
   ============================================================ */
function renderNav(){
  const nav = $('#catNav');
  if(nav){
    nav.innerHTML = `<button class="cat-pill ${route.vertical==='all'?'active':''}" data-vert="all">🌍 ${t('all')}</button>` +
      VERTICALS.map(v => `<button class="cat-pill ${route.vertical===v.id?'active':''}" data-vert="${v.id}">${v.emoji} ${esc(vname(v))}</button>`).join('');
    $$('#catNav .cat-pill').forEach(b => b.onclick = () => {
      route = { page:'shop', vertical:b.dataset.vert, category:'all', query:'', sort:'pop' };
      filters = { cats:new Set(), maxPrice:100000, minRating:0, vegOnly:false };
      renderAll(); window.scrollTo({top:0, behavior:'smooth'});
    });
  }
  const links = [
    ['🏠', t('sideHome'), 'home'], ['🧭', t('sideExplore'), 'shop'], ['🏷️', t('sideOffers'), 'offers'],
    ['📦', t('sideOrders'), 'orders'], ['❤️', t('sideWish'), 'wish'], ['⭐', `${t('loyTitle')} (${loyalty.pts||0})`, 'wallet'], ['🔁', `${t('subTitle')} (${subs.filter(s=>s.active!==false).length})`, 'subs'], ['💼', t('sideSeller'), 'seller'],
    ['🎨', t('sideCustom'), 'custom'],
    ...VERTICALS.map(v => [v.emoji, vname(v), 'v:'+v.id]),
  ];
  const sl = $('#sideLinks');
  if(sl){
    sl.innerHTML = links.map(([e,n,a]) => `<button data-go="${a}">${e} ${esc(n)}</button>`).join('');
    $$('#sideLinks button').forEach(b => b.onclick = () => {
      closeAll(); const a = b.dataset.go;
      if(a==='home') route.page='home';
      else if(a==='shop') route={page:'shop',vertical:'all',category:'all',query:'',sort:'pop'};
      else if(a==='offers') route.page='offers';
      else if(a==='orders') route.page='orders';
      else if(a==='seller') route.page='seller';
      else if(a==='wish'){ openDrawer('wishDrawer'); renderWish(); return; }
      else if(a==='wallet'){ openWallet(); return; }
      else if(a==='subs'){ openSubs(); return; }
      else if(a==='custom'){ openDrawer('customDrawer'); renderCustomizer('store'); return; }
      else if(a.startsWith('v:')) route={page:'shop',vertical:a.slice(2),category:'all',query:'',sort:'pop'};
      renderAll(); window.scrollTo({top:0,behavior:'smooth'});
    });
  }
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
  setT('locLabel', `${location.n} ${location.pin}`);
  setT('locLabel2', `${location.n} ${location.pin}`);
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

  if(S.promos && getBanners().length) h += `<section class="section"><div class="banner-row">${getBanners().map((b,i)=>
    `<button class="banner" style="background:${b.bg}" data-banner="${i}"><span class="be">${b.e}</span><b>${esc(b.t)}</b><small>${esc(b.s)}</small><span class="go">${b.code?('🎟️ '+b.code+' →'):t('viewAll')}</span></button>`).join('')}</div></section>`;

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
    <div class="testi-grid">${TESTIMONIALS.map(x=>`<div class="testi"><div class="stars">${'★'.repeat(x.s)}${'☆'.repeat(5-x.s)}</div><p>"${x.t}"</p><div class="who"><span class="ava">${x.e}</span><div><b>${x.n}</b><small>${x.c} • Verified buyer</small></div></div></div>`).join('')}</div></section>`;

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
  <div class="promo-strip" style="margin-bottom:18px">${getBanners().map((b,i)=>`<div class="promo-chip" data-banner="${i}"><span class="pc" style="background:${b.bg}">${b.e}</span><span>${esc(b.t)}<br/><small class="muted">${b.code||''}</small></span></div>`).join('')}</div>
  <div class="coupon-grid">${COUPONS.map(c=>`<div class="coupon"><span class="cc">${c.e}</span><b>${c.t}</b><p>${c.d}</p>
    <div class="code-row"><code>${c.code}</code><button class="btn secondary sm" data-copy="${c.code}">${t('copyBtn')}</button><button class="btn primary sm" data-apply="${c.code}">${activeCoupon===c.code?t('appliedBtn'):t('applyBtn')}</button></div></div>`).join('')}</div>`;
}
function orderCardHTML(o){
  const sum = slotSummary(o);
  return `<div class="order-card"><div class="order-top"><b>#${o.id}</b>
    <span class="status st-${['placed','preparing','shipped','out','delivered'][o.status]}">${statusName(o.status)}</span></div>
    <div class="order-items">${o.items.map(i=>{const p=getP(i.id);return p?p.e:'📦';}).join('')}${o.gift?'🎁':''}</div>
    <div class="order-meta"><span>🧾 ${o.items.reduce((a,i)=>a+i.qty,0)} ${t('ordItems')}</span><span>💰 ${fmt(o.total)}</span><span>📅 ${o.date}</span><span>📍 ${esc(o.addr.city||location.n)}</span>
    ${sum?`<span>🕐 ${esc(sum)}</span>`:''}${o.gift?`<span>🎁 ${esc(occName(o.gift.occasion))}</span>`:''}
    ${o.scheduledFor?`<span>⏰ ${esc(schedLabel(o.scheduledFor))}${schedCountdown(o.scheduledFor)?` • ${esc(schedCountdown(o.scheduledFor))}`:''}</span>`:''}
    ${o.splitCount?`<span>📦 ${o.splitIdx} ${t('splitOf')} ${o.splitCount} ${t('splitShip')}</span>`:''}
    ${o.subId?`<span>🔁 ${t('subBtn')}</span>`:''}
    ${o.proof?`<span>📸 ${t('proofTitle')}</span>`:''}
    ${o.rating?`<span style="color:#f59e0b">★ ${o.rating.stars}</span>`:''}</div>
    <div class="track-steps">${[0,1,2,3,4].map(i=>`<div class="tstep ${i<=o.status?'done':''}"><div class="tdot">${i<=o.status?'✓':i+1}</div>${statusName(i)}</div>`).join('')}</div>
    ${o.return?`<div class="refund-line">↩ ${t('retStatus')}: <b>${retStatusName(o.return.status)}</b> • ${fmt(o.return.amt||o.total)} ${t('retTo')} ${esc(o.pay)}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn secondary sm" data-track="${o.id}">📍 ${t('ordTrack')}</button><button class="btn ghost sm" data-reorder="${o.id}">🔁 ${t('ordReorder')}</button>
    ${o.status===4 && !o.rating ? `<button class="btn secondary sm" data-rate="${o.id}">⭐ ${t('rateBtn')}</button>` : ''}
    ${o.status===4 && !o.return ? `<button class="btn danger-ghost sm" data-return="${o.id}">↩ ${t('retTitle')}</button>` : ''}</div>
  </div>`;
}
function calendarHTML(){
  const now = new Date();
  if(!calCursor) calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  if(!calDay) calDay = isoDay(now.getTime());
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  const monthName = calCursor.toLocaleDateString(HI()?'hi-IN':'en-IN',{ month:'long', year:'numeric' });
  const first = new Date(y, m, 1).getDay();
  const dim = new Date(y, m+1, 0).getDate();
  const byDay = {};
  orderEvents().forEach(e=>{ (byDay[e.d] = byDay[e.d] || []).push(e); });
  const todayISO = isoDay(now.getTime());
  let cells = '';
  for(let i=0;i<first;i++) cells += `<button class="cal-day" disabled></button>`;
  for(let d=1; d<=dim; d++){
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const list = (byDay[iso]||[]).slice(0,3);
    cells += `<button class="cal-day ${iso===todayISO?'today':''} ${iso===calDay?'sel':''}" data-calday="${iso}">${d}<span class="cal-dots">${list.map(e=>`<i class="dot-${e.type}"></i>`).join('')}</span></button>`;
  }
  const dows = HI() ? DAY_HI : DAY_EN;
  const dayEvs = byDay[calDay] || [];
  const dayLabel = new Date(calDay+'T12:00:00').toLocaleDateString(HI()?'hi-IN':'en-IN',{ weekday:'long', day:'numeric', month:'short' });
  return `<div class="cal-wrap"><div class="cal-card">
    <div class="cal-nav"><b>${monthName}</b><div class="cn-btns">
      <button class="btn ghost sm" data-calnav="-1">←</button>
      <button class="btn ghost sm" data-calnav="today">${t('calToday')}</button>
      <button class="btn ghost sm" data-calnav="1">→</button></div></div>
    <div class="cal-grid">${dows.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div></div>
  <div class="cal-events"><h3>📅 ${dayLabel}</h3>
    ${dayEvs.length ? dayEvs.map(e=>{ const o = e.o; return `<div class="cal-ev"><span class="ce-ico">${e.type==='sub'?'🔁':e.type==='service'?'🛠️':e.type==='delivery'?'📬':'🧾'}</span>
      <div style="flex:1">${e.type==='sub'?subEvTitle(o):`<b>#${o.id} • ${fmt(o.total)}</b>`}<small>${o.items.map(i=>{const p=getP(i.id);return p?p.e:'📦';}).join(' ')} ${esc(o.addr.city||'')}</small></div>
      <span class="ev-pill ev-${e.type}">${e.type==='sub'?t('calSub'):e.type==='service'?t('calService'):e.type==='delivery'?t('calDelivery'):t('calPlaced')}</span>
      ${e.type==='sub'?`<button class="btn secondary sm" onclick="openSubs()">🔁</button>`:`<button class="btn secondary sm" data-track="${o.id}">📍</button>`}</div>`; }).join('')
    : `<div class="empty"><div class="big">🗓️</div><p>${t('calNone')}</p></div>`}
  </div></div>`;
}
function ordersHTML(){
  if(!orders.length) return `<div class="empty" style="padding-top:80px"><div class="big">📦</div><h3>${t('ordEmpty')}</h3><p>${t('ordEmptySub')}</p><button class="btn primary" data-vert-go="all">${t('ordStart')}</button></div>`;
  const sub = HI() ? `${orders.length} ऑर्डर • लाइव ट्रैकिंग` : `${orders.length} order(s) • live tracking`;
  return `<div class="sec-head" style="margin-top:6px"><div><h2>📦 ${t('ordTitle')}</h2><p>${sub}</p></div>
    <div class="view-toggle"><button class="${ordView==='list'?'active':''}" data-ordview="list">📋 ${t('calList')}</button><button class="${ordView==='calendar'?'active':''}" data-ordview="calendar">🗓️ ${t('calCal')}</button></div></div>` +
    (ordView === 'calendar' ? calendarHTML() : [...orders].reverse().map(orderCardHTML).join(''));
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
  orders.push(mk(0), mk(1), mk(2)); saveOrders(); cloudUp();
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
    <div class="seller-actions"><button class="btn ghost sm" id="sCloud">${cloudOn()?'☁️ '+t('cloudOn'):'📴 '+t('cloudLocal')}</button><button class="btn secondary sm" id="sView">🏪 ${t('selView')}</button><button class="btn primary sm" id="sAdd">＋ ${t('selAdd')}</button></div></div>
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
      ${recentOrders.length ? recentOrders.map(o=>`<div class="sord"><span class="so">📦</span><div class="si"><b>#${o.id}</b><small>${o.items.reduce((a,i)=>a+i.qty,0)} ${t('ordItems')} • ${fmt(o.total)} • ${o.date}${slotSummary(o)?' • 🕐 '+esc(slotSummary(o)):''}${o.gift?' • 🎁':''}</small></div>
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
  const pg = $('#page'); if(!pg) return;
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
  $$('[data-banner]', pg).forEach(b => b.onclick = () => bannerGo(+b.dataset.banner));
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
    filters.maxPrice = +pr.value; const pl = $('#priceLbl'); if(pl) pl.textContent = fmt(+pr.value);
    clearTimeout(pr._t); pr._t = setTimeout(preserveRender, 350);
  };
  $$('input[name=frate]', pg).forEach(r => r.onchange = () => { filters.minRating = +r.value; preserveRender(); });
  const vo = $('#vegOnly'); if(vo) vo.onchange = () => { filters.vegOnly = vo.checked; preserveRender(); };
  const ss = $('#sortSel'); if(ss) ss.onchange = () => { route.sort = ss.value; preserveRender(); };
  const cf = $('#clearFilters'); if(cf) cf.onclick = () => { filters={cats:new Set(),maxPrice:100000,minRating:0,vegOnly:false}; renderAll(); };
  const er = $('#emptyReset'); if(er) er.onclick = () => { filters={cats:new Set(),maxPrice:100000,minRating:0,vegOnly:false}; route.query=''; renderAll(); };
  $$('[data-copy]', pg).forEach(b => b.onclick = () => { try{navigator.clipboard?.writeText(b.dataset.copy);}catch{} toast(`Code ${b.dataset.copy} copied`,'📋'); });
  $$('[data-apply]', pg).forEach(b => b.onclick = () => applyCoupon(b.dataset.apply));
  $$('[data-track]', pg).forEach(b => b.onclick = () => openTrack(b.dataset.track));
  $$('[data-return]', pg).forEach(b => b.onclick = () => openReturn(b.dataset.return));
  $$('[data-rate]', pg).forEach(b => b.onclick = () => openRate(b.dataset.rate));
  $$('[data-reorder]', pg).forEach(b => b.onclick = () => {
    const o = orders.find(x=>x.id===b.dataset.reorder);
    if(o){ o.items.forEach(i => { if(getP(i.id)) cart[i.id]=(cart[i.id]||0)+i.qty; }); saveCart(); updateBadges(); renderCart(); openDrawer('cartDrawer'); toast('Items added back to cart','🔁'); }
  });
  $$('[data-ordview]', pg).forEach(b => b.onclick = () => { ordView = b.dataset.ordview; renderPage(); });
  $$('[data-calnav]', pg).forEach(b => b.onclick = () => {
    const v = b.dataset.calnav, now = new Date();
    if(v === 'today') calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    else calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+ +v, 1);
    renderPage();
  });
  $$('[data-calday]', pg).forEach(b => b.onclick = () => { calDay = b.dataset.calday; renderPage(); });
  const sAdd = $('#sAdd'); if(sAdd) sAdd.onclick = ()=>openPM(null);
  const sView = $('#sView'); if(sView) sView.onclick = ()=>{ route.page='home'; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  const sCloud = $('#sCloud'); if(sCloud) sCloud.onclick = ()=>{ openDrawer('customDrawer'); renderCustomizer('data'); };
  const sSeed = $('#sSeed'); if(sSeed) sSeed.onclick = ()=>{ seedSampleOrders(); renderPage(); toast('Sample orders added','📦'); };
  $$('[data-sadv]', pg).forEach(b => b.onclick = () => {
    const o = orders.find(x=>x.id===b.dataset.sadv);
    if(o){ o.status=Math.min(4,o.status+1); saveOrders(); renderPage(); cloudUp();
      notify(HI()?'ऑर्डर अपडेट':'Order update', `#${o.id}: ${statusName(o.status)}`, '📦');
      toast('Status: '+statusName(o.status),'📦'); }
  });
  $$('[data-sedit]', pg).forEach(b => b.onclick = ()=>openPM(b.dataset.sedit));
  startFlashTimer();
  renderFooter();
}
function preserveRender(){ const y = window.scrollY; renderPage(); window.scrollTo(0, y); }
function renderFooter(){
  const f = $('#footer'); if(!f) return;
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
   CART + WISHLIST + GIFT
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
  const hasShip = items.some(i=>!['food','services'].includes(i.p.v));
  const expFee = (coState.slot.speed==='express' && hasShip && items.length) ? EXPRESS_FEE : 0;
  const giftFee = (gift.on && items.length) ? GIFT_FEE : 0;
  const tax = Math.max(0,(sub-discount)) * cm.taxPct/100;
  const preRedeem = Math.max(0, sub-discount+del+expFee+giftFee+tax);
  const redeem = loyRedeemable(preRedeem);
  return { items, mrp, sub, discount, del, expFee, giftFee, tax, redeem,
    total: Math.max(0, preRedeem-redeem), count: items.reduce((a,i)=>a+i.qty,0) };
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
  const cc = $('#cartCount'); if(cc) cc.textContent = tmp.count;
  const w = $('#wishCount'); if(w){ w.textContent = wishlist.size; w.classList.toggle('hidden', !wishlist.size); }
  const hc = $('#cartHeadCount'); if(hc) hc.textContent = tmp.count?`(${tmp.count})`:'';
  const unread = notifs.filter(n=>!n.read).length;
  const bc = $('#bellCount'); if(bc){ bc.textContent = unread; bc.classList.toggle('hidden', !unread); }
}
function giftBoxHTML(){
  return `<div class="gift-box">
    <div class="toggle-row" style="border:none;padding:0"><span>🎁 ${t('giftWrap')} <b>+ ${fmt(GIFT_FEE)}</b></span><label class="switch"><input type="checkbox" id="giftOn" ${gift.on?'checked':''}/><span class="slider"></span></label></div>
    ${gift.on?`<div class="gift-row"><select id="giftOcc">${GIFT_OCCASIONS.map((o,i)=>`<option value="${i}" ${gift.occasion==i?'selected':''}>${HI()?o.hi:o.en}</option>`).join('')}</select></div>
    <textarea id="giftMsg" maxlength="140" placeholder="${t('giftMsgPh')}">${esc(gift.msg)}</textarea>
    <label class="f-check"><input type="checkbox" id="giftHide" ${gift.hide?'checked':''}/> ${t('giftHide')}</label>`:''}
  </div>`;
}
function renderCart(){
  const tt = cartTotals(), box = $('#cartItems'), foot = $('#cartFoot');
  if(!box || !foot) return;
  const cm = settings.commerce;
  const pct = Math.min(100, ((tt.sub-tt.discount)/cm.freeAbove)*100);
  const need = fmt(cm.freeAbove-(tt.sub-tt.discount));
  const fb = $('#cartFreeBar');
  if(fb) fb.innerHTML = !tt.items.length ? '' :
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
    <span class="ci-price">${fmt(p.p*qty)}</span></div></div></div>`).join('')
    + giftBoxHTML();
  $$('[data-cinc]',box).forEach(b=>b.onclick=()=>setQty(b.dataset.cinc,(cart[b.dataset.cinc]||0)+1));
  $$('[data-cdec]',box).forEach(b=>b.onclick=()=>setQty(b.dataset.cdec,(cart[b.dataset.cdec]||0)-1));
  const gOn = $('#giftOn',box);
  if(gOn) gOn.onchange = ()=>{ gift.on = gOn.checked; saveGift(); renderCart(); };
  const gOcc = $('#giftOcc',box);
  if(gOcc) gOcc.onchange = ()=>{ gift.occasion = +gOcc.value; saveGift(); };
  const gMsg = $('#giftMsg',box);
  if(gMsg) gMsg.oninput = ()=>{ gift.msg = gMsg.value; saveGift(); };
  const gHide = $('#giftHide',box);
  if(gHide) gHide.onchange = ()=>{ gift.hide = gHide.checked; saveGift(); };
  foot.innerHTML = `
    <div class="coupon-box"><input id="couponInput" placeholder="${t('couponPh')}" value="${activeCoupon||''}"/><button class="btn secondary sm" id="couponApply">${activeCoupon?t('remove'):t('apply')}</button></div>
    ${tt.discount?`<div class="bill-row"><span>${t('couponLbl')} (${activeCoupon})</span><span class="off">− ${fmt(tt.discount)}</span></div>`:''}
    <div class="bill-row"><span>${t('subtotal')}</span><span>${fmt(tt.sub)}</span></div>
    <div class="bill-row"><span>${t('delivery')}</span><span>${tt.del?fmt(tt.del):`<b class="off">${t('free')}</b>`}</span></div>
    ${tt.expFee?`<div class="bill-row"><span>⚡ ${t('expFee')}</span><span>${fmt(tt.expFee)}</span></div>`:''}
    ${tt.giftFee?`<div class="bill-row"><span>🎁 ${t('giftFee')}</span><span>${fmt(tt.giftFee)}</span></div>`:''}
    <div class="bill-row"><span>${t('tax')} (${cm.taxPct}%)</span><span>${fmt(tt.tax)}</span></div>
    <div class="bill-row"><span class="off">${t('saveMrp')}</span><span class="off">${fmt(tt.mrp-tt.sub)}</span></div>
    <div class="bill-row total"><span>${t('total')}</span><span>${fmt(tt.total)}</span></div>
    <div class="bill-row"><span>⭐ ${t('loyEarn')}</span><span class="off">+${loyEarnFor(tt.total)} ${t('loyPts')}</span></div>
    <button class="btn primary full" id="btnCheckout" style="margin-top:12px">${t('checkoutBtn')}</button>`;
  const ca = $('#couponApply');
  if(ca) ca.onclick = () => {
    if(activeCoupon){ activeCoupon=null; LS.del('aw_coupon_v1'); }
    else { const v = $('#couponInput').value.trim().toUpperCase(); if(!applyCoupon(v)) return; }
    renderCart();
  };
  const bc2 = $('#btnCheckout'); if(bc2) bc2.onclick = openCheckout;
}
function renderWish(){
  const box = $('#wishItems'); if(!box) return;
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
  if(!silent) toast(`Coupon ${code} applied!`,'🎉'); else toast(`Coupon ${code} applied!`,'🎉');
  renderCart();
  if(route.page==='offers') renderPage();
  return true;
}

/* ============================================================
   DRAWERS + MODALS plumbing
   ============================================================ */
function openDrawer(id){ closeAll(); const d = document.getElementById(id); if(d) d.classList.add('show'); const o = $('#overlay'); if(o) o.classList.add('show'); }
function openModal(id){ const m = document.getElementById(id); if(m) m.classList.add('show'); }
function closeAll(){
  $$('.drawer').forEach(d=>d.classList.remove('show'));
  $$('.modal-wrap').forEach(m=>m.classList.remove('show'));
  const o = $('#overlay'); if(o) o.classList.remove('show');
  const sm = $('#sideMenu'); if(sm) sm.classList.remove('show');
}
function bindDrawerClose(root=document){
  $$('[data-close]',root).forEach(b=>{ if(!b._b){ b._b=true; b.onclick=closeAll; } });
  $$('[data-close-modal]',root).forEach(b=>{ if(!b._b){ b._b=true; b.onclick=()=>{ const m = document.getElementById(b.dataset.closeModal); if(m) m.classList.remove('show'); }; } });
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
  const box = $('#productModalBox'); if(!box) return;
  box.innerHTML = `
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
      ${p.v==='grocery'?`<div class="sub-pick"><span>🔁 <b>${t('subSave')}</b></span><span style="display:flex;gap:6px;align-items:center"><select id="subFreq">${SUB_FREQS.map(f=>`<option value="${f}">${t('subEvery')} ${subFreqName(f)}</option>`).join('')}</select><button class="btn secondary sm" id="subGo">${t('subBtn')}</button></span></div>`:''}
      <div class="pay-opt" style="padding:10px 14px">🚚 <span class="small">${t('pDeliverTo')} <b>${esc(location.n)} ${esc(location.pin)}</b> — ${esc(p.t||'soon')}</span></div>
      <h4 class="mt">⭐ ${t('pReviews')}</h4>
      <div id="revList">${revs.map(r=>`<div class="rev"><b>${esc(r.n)}</b> <span style="color:#f59e0b">${stars(r.r)}</span><p>${esc(r.t)}</p></div>`).join('')}</div>
      <div class="coupon-box"><input id="revInput" placeholder="${t('pWriteReview')}"/><button class="btn secondary sm" id="revAdd">${t('pPost')}</button></div>
    </div>`;
  openModal('productModal');
  $('[data-pinc]',box).onclick = ()=>setQty(p.id,(cart[p.id]||0)+1);
  $('[data-pdec]',box).onclick = ()=>setQty(p.id,(cart[p.id]||0)-1);
  $('[data-padd]',box).onclick = ()=>{ setQty(p.id,(cart[p.id]||0)+1); toast('Added to cart','🛒'); };
  $('[data-pwish]',box).onclick = e=>{ toggleWish(p.id); e.target.textContent = wishlist.has(p.id)?'❤️':'🤍'; };
  const sg = $('#subGo');
  if(sg) sg.onclick = ()=>{ const f = +($('#subFreq')||{value:7}).value; addSub(p.id, Math.max(1,cart[p.id]||1), f); openSubs(); };
  const ra = $('#revAdd');
  if(ra) ra.onclick = ()=>{
    const txt = $('#revInput').value.trim(); if(!txt) return;
    myReviews[id] = [{n:user?.name||'You',r:5,t:txt}, ...(myReviews[id]||[])];
    LS.set('aw_reviews_v1', myReviews); openProduct(id); toast('Review posted, thanks!','⭐');
  };
}

/* ============================================================
   ADDRESS BOOK
   ============================================================ */
function addrCardHTML(a, sel){
  const lab = a.label==='home'?t('addrHome'):a.label==='work'?t('addrWork'):t('addrOther');
  return `<div class="addr-card ${sel?'sel':''}" data-addrsel="${a.id}"><span class="alab">${a.label==='home'?'🏠':a.label==='work'?'💼':'📍'} ${lab}</span><br/>
    <b>${esc(a.name)}</b><p>${esc(a.line)}, ${esc(a.city)} ${esc(a.pin)}<br/>📞 ${esc(a.phone)}</p></div>`;
}
function addrFormHTML(prefix){
  return `<div class="addr-grid">
      <div class="field"><label>${t('coName')}</label><input type="text" id="${prefix}Name" value="${esc(user?.name||'')}" placeholder="${t('coName')}"/></div>
      <div class="field"><label>${t('coPhone')}</label><input type="text" id="${prefix}Phone" value="${esc(user?.phone||'')}" placeholder="10-digit mobile"/></div>
    </div>
    <div class="field"><label>${t('coAddrLbl')}</label><input type="text" id="${prefix}Line" placeholder="Flat, street, landmark…"/></div>
    <div class="addr-grid">
      <div class="field"><label>${t('coCity')}</label><input type="text" id="${prefix}City" value="${esc(location.n)}"/></div>
      <div class="field"><label>${t('coPin')}</label><input type="text" id="${prefix}Pin" value="${esc(location.pin)}"/></div>
    </div>
    <div class="field"><label>${t('addrLabel')}</label><select id="${prefix}Label">
      <option value="home">🏠 ${t('addrHome')}</option><option value="work">💼 ${t('addrWork')}</option><option value="other">📍 ${t('addrOther')}</option>
    </select></div>`;
}
function readAddrForm(prefix){
  return { id:uid('a'), label:($('#'+prefix+'Label')||{}).value||'home',
    name:($('#'+prefix+'Name')||{value:''}).value.trim(), phone:($('#'+prefix+'Phone')||{value:''}).value.trim(),
    line:($('#'+prefix+'Line')||{value:''}).value.trim(), city:($('#'+prefix+'City')||{value:''}).value.trim(),
    pin:($('#'+prefix+'Pin')||{value:''}).value.trim() };
}

/* ============================================================
   CHECKOUT + SLOTS + UPI + RAZORPAY
   ============================================================ */
function openCheckout(){
  const tt = cartTotals();
  if(!tt.items.length){ toast('Cart is empty','🛒'); return; }
  const svc = serviceSlots();
  coState = { step:0, addr:coState.addr||{}, pay:(coState.pay==='razorpay'&&!rzpKey)?'upi':(coState.pay||'upi'),
    upi:coState.upi&&coState.upi.id ? coState.upi : { id:'', verified:false, name:'', app:'GPay' },
    addrId:addrs.length?addrs[0].id:null, newAddr:!addrs.length, redeem:false,
    split:{ on:false, map:{} },
    slot:{ food:'asap', speed:coState.slot?coState.slot.speed:'standard', service:svc.length?svc[0].v:'', serviceDate:svc.length?svc[0].d:'', schedDay:'', schedWin:0, schedTs:0 } };
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
      <div><b>${t('upiScan')}</b><small>${t('upiScanSub')}<br/>${esc(settings.storeName)} • ${fmt(total)}</small></div></div>
    <div class="upi-note">🔔 ${t('upiNote')}</div>
  </div>`;
}
function checkoutAddrHTML(){
  const showSaved = addrs.length && !coState.newAddr;
  if(showSaved){
    return `<div class="addr-head"><h4>📍 ${t('addrSaved')}</h4><button class="btn ghost sm" id="coNew">＋ ${t('addrAdd')}</button></div>
    ${addrs.map(a=>addrCardHTML(a, a.id===coState.addrId)).join('')}`;
  }
  return `${addrs.length?`<button class="btn ghost sm" id="coBackSaved" style="margin-bottom:12px">← ${t('addrSaved')}</button>`:''}
    ${addrFormHTML('co')}
    <label class="f-check"><input type="checkbox" id="coSaveBook" checked/> 💾 ${t('addrSaveBook')}</label>`;
}
function slotHTML(){
  const tt = cartTotals();
  const hasFood = tt.items.some(i=>i.p.v==='food');
  const hasSvc = tt.items.some(i=>i.p.v==='services');
  const hasShip = tt.items.some(i=>!['food','services'].includes(i.p.v));
  if(!hasFood && !hasSvc && !hasShip) return '';
  let h = `<div class="addr-head" style="margin-top:16px"><h4>🕐 ${t('slotTitle')}</h4></div>`;
  if(hasFood) h += `<div class="slot-sec"><h4>🍔 ${t('slotFood')}</h4><div class="slot-pills">${foodSlots().map(s=>`<button class="slot-pill ${coState.slot.food===s.v?'sel':''}" data-slotf="${esc(s.v)}">${esc(s.l)}</button>`).join('')}</div></div>`;
  if(hasSvc) h += `<div class="slot-sec"><h4>🛠️ ${t('slotSvc')}</h4><div class="slot-pills">${serviceSlots().map(s=>`<button class="slot-pill ${coState.slot.service===s.v?'sel':''}" data-slots="${esc(s.v)}" data-slotd="${s.d}">${esc(s.l)}</button>`).join('')}</div></div>`;
  if(hasShip) h += `<div class="slot-sec"><h4>📦 ${t('slotSpeed')}</h4><div class="slot-pills">
    <button class="slot-pill ${coState.slot.speed==='standard'?'sel':''}" data-slotspeed="standard">${t('slotStd')}<small>${t('delivery')}: ${fmt(settings.commerce.deliveryFee)}</small></button>
    <button class="slot-pill ${coState.slot.speed==='express'?'sel':''}" data-slotspeed="express">⚡ ${t('slotExp')}<small>+ ${fmt(EXPRESS_FEE)}</small></button></div></div>`;
  const hasSched = tt.items.some(i=>['food','grocery'].includes(i.p.v));
  if(hasSched){
    const days = schedDays();
    if(!coState.slot.schedDay) coState.slot.schedDay = days[0].d;
    h += `<div class="slot-sec"><h4>⏰ ${t('schedTitle')}</h4><div class="slot-pills">
      <button class="slot-pill ${!coState.slot.schedTs?'sel':''}" data-schedmode="now">⚡ ${t('schedNow')}</button>
      <button class="slot-pill ${coState.slot.schedTs?'sel':''}" data-schedmode="later">🗓️ ${t('schedLater')}</button></div>
      ${coState.slot.schedTs?`<div class="slot-sub">${t('schedDay')}</div><div class="slot-pills">${days.map(d=>`<button class="slot-pill ${coState.slot.schedDay===d.d?'sel':''}" data-schedday="${d.d}">${esc(d.l)}</button>`).join('')}</div>
      <div class="slot-sub">${t('schedTime')}</div><div class="slot-pills">${SCHED_WINS.map((w,i)=>`<button class="slot-pill ${+coState.slot.schedWin===i?'sel':''}" data-schedwin="${i}">${w[0]}–${w[1]}</button>`).join('')}</div>`:''}</div>`;
  }
  return h;
}
function payMethods(){
  const m = [['upi','📱',t('payUpi')],['card','💳',t('payCard')],['cod','💵',t('payCod')],['wallet','👛',t('payWallet')]];
  if(rzpKey) m.push(['razorpay','💠',t('rzpPay')]);
  return m;
}
function doPlaceOrder(tt, box, payLabel, extra){
  const schedTs = (coState.slot.schedTs||0) > Date.now() ? coState.slot.schedTs : 0;
  let groups = null;
  if(coState.split.on && addrs.length){
    const opts = splitAddrs();
    groups = {};
    tt.items.forEach(({p,qty})=>{
      let aid = coState.split.map[p.id];
      if(!opts.some(o=>o.id===aid)) aid = opts[0].id;
      (groups[aid] = groups[aid] || []).push({p, qty});
    });
    if(Object.keys(groups).length < 2) groups = null;
  }
  const cm = settings.commerce;
  const mkAddr = aid => {
    if(aid === '__new' || !aid) return Object.assign({}, coState.addr);
    const a = addrs.find(x=>x.id===aid);
    return a ? { name:a.name, phone:a.phone, line:a.line, city:a.city, pin:a.pin } : Object.assign({}, coState.addr);
  };
  const dateStr = new Date().toLocaleString(HI()?'hi-IN':'en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
  const mkOne = (items, addr, first, alloc) => Object.assign({
    id:uid('AW').toUpperCase(), items:items.map(i=>({id:i.p.id,qty:i.qty,price:i.p.p})),
    total:alloc.total, sub:alloc.sub, discount:alloc.disc,
    status:0, date:dateStr, addr, pay:payLabel, upi:'', placedAt:Date.now(),
    slot:Object.assign({}, coState.slot), gift:(gift.on&&first)?Object.assign({}, gift):null, rating:null,
    scheduledFor:schedTs, reminded:false,
  }, extra||{});
  const made = [];
  if(groups){
    const keys = Object.keys(groups), spId = uid('SP').toUpperCase();
    let accDisc = 0;
    keys.forEach((k,idx)=>{
      const items = groups[k];
      const sub = items.reduce((a,i)=>a+i.p.p*i.qty,0);
      const first = idx===0;
      const disc = (idx<keys.length-1 && tt.sub>0) ? Math.round(tt.discount*sub/tt.sub) : Math.max(0, tt.discount-accDisc);
      accDisc += disc;
      const del = first ? tt.del : 0, exp = first ? tt.expFee : 0, gf = first ? tt.giftFee : 0;
      const red = first ? tt.redeem : 0;
      const tax = Math.max(0, sub-disc) * cm.taxPct/100;
      const total = Math.max(0, Math.round(sub-disc+del+exp+gf+tax-red));
      const o = mkOne(items, mkAddr(k), first, { sub:Math.round(sub), disc, total });
      o.splitId = spId; o.splitIdx = idx+1; o.splitCount = keys.length;
      orders.push(o); made.push(o);
    });
  } else {
    made.push(mkOne(tt.items, Object.assign({}, coState.addr), true, { sub:Math.round(tt.sub), disc:Math.round(tt.discount), total:Math.round(tt.total) }));
    orders.push(made[0]);
  }
  saveOrders(); cloudUp();
  if(tt.redeem > 0) loyAdd(-tt.redeem, `${HI()?'रिडीम':'Redeemed'} — #${made[0].id}`);
  const earned = made.reduce((a,o)=>a+loyEarnFor(o.total),0);
  if(earned > 0) loyAdd(earned, `${HI()?'ऑर्डर':'Order'} #${made[0].id}`);
  cart={}; activeCoupon=null; saveCart(); LS.del('aw_coupon_v1'); updateBadges();
  notify(HI()?'ऑर्डर कन्फर्म 🎉':'Order confirmed 🎉',
    made.length>1 ? `${made.length} shipments • ${fmt(made.reduce((a,o)=>a+o.total,0))}` : `#${made[0].id} • ${fmt(made[0].total)}`, '🎉');
  if(earned > 0) notify(`⭐ +${earned} ${t('loyPts')} ${t('loyGot')}`, `${t('loyBal')}: ${loyalty.pts}`, '⭐');
  const rows = made.map(o=>`<div class="split-row"><span style="font-size:26px">📦</span><div style="flex:1"><b>#${o.id}</b>${o.splitCount?` <small class="muted">${o.splitIdx} ${t('splitOf')} ${o.splitCount} ${t('splitShip')}</small>`:''}<br/><small class="muted">📍 ${esc(o.addr.city||'')} • ${fmt(o.total)}${o.scheduledFor?` • ⏰ ${esc(schedLabel(o.scheduledFor))}`:''}</small></div><button class="btn secondary sm" data-oktrack="${o.id}">📍 ${t('coTrack')}</button></div>`).join('');
  box.innerHTML = `<div class="modal-body"><div class="success-box"><div class="big">🎉</div>
    <h2>${t('coSuccess')}</h2><p class="muted">${HI()?'कुल':'Total'} <b>${fmt(made.reduce((a,o)=>a+o.total,0))}</b>${earned?` • ⭐ +${earned}`:''}</p>
    ${slotSummary(made[0])?`<p class="muted small">🕐 ${esc(slotSummary(made[0]))}</p>`:''}
    <div class="split-list" style="text-align:left;margin:14px 0">${rows}</div>
    <button class="btn secondary" id="okShop">${t('coShop')}</button></div></div>`;
  $$('[data-oktrack]',box).forEach(b=>b.onclick=()=>{ const cm2=$('#checkoutModal'); if(cm2) cm2.classList.remove('show'); route.page='orders'; renderAll(); openTrack(b.dataset.oktrack); });
  const os = $('#okShop'); if(os) os.onclick = ()=>{ const cm2=$('#checkoutModal'); if(cm2) cm2.classList.remove('show'); route.page='home'; renderAll(); };
}

let rzpLoading = null;
function loadRazorpay(){
  if(window.Razorpay) return Promise.resolve(true);
  if(rzpLoading) return rzpLoading;
  rzpLoading = new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = ()=>res(true);
    s.onerror = ()=>rej(new Error('load'));
    setTimeout(()=>rej(new Error('timeout')), 15000);
    document.head.appendChild(s);
  }).catch(e=>{ rzpLoading = null; throw e; });
  return rzpLoading;
}
async function rzpFlow(tt, box){
  const pl = $('#coPlace');
  const resetBtn = ()=>{ const b=$('#coPlace'); if(b){ b.disabled=false; b.textContent=`${t('coPlace')} • ${fmt(tt.total)}`; } };
  try{
    if(pl){ pl.disabled = true; pl.textContent = '⏳ ' + t('rzpLoad'); }
    await loadRazorpay();
    toast(t('rzpWin'),'💠');
    const rz = new window.Razorpay({
      key: rzpKey,
      amount: Math.round(tt.total*100),
      currency: 'INR',
      name: `${settings.storeName} ${settings.storeName2}`,
      description: `${tt.count} item(s)`,
      prefill: { name:coState.addr.name||'', contact:coState.addr.phone||'', email:(user&&user.email)||'' },
      theme: { color:settings.theme.primary },
      modal: { ondismiss:resetBtn },
      handler:(auth)=>{ doPlaceOrder(tt, box, 'Razorpay', { razorpay:{ payment_id:auth.razorpay_payment_id||'', signature:auth.razorpay_signature||'' } }); },
    });
    rz.on('payment.failed', ()=>{ toast(t('rzpFail'),'⚠️'); resetBtn(); });
    rz.open();
  }catch{ toast(t('rzpFail'),'⚠️'); resetBtn(); }
}
function renderCheckout(){
  const tt = cartTotals(), box = $('#checkoutBox'); if(!box) return;
  if(coState.step===0) box.innerHTML = `
    <div class="modal-head"><h3>🧾 ${HI()?'चेकआउट':'Checkout'} — ${t('coAddr')}</h3><button class="icon-btn" onclick="document.getElementById('checkoutModal').classList.remove('show')">✕</button></div>
    <div class="modal-body"><div class="co-steps"><div class="active">1. ${t('coAddr')}</div><div>2. ${t('coPay')}</div><div>3. ${t('coDone')}</div></div>
    ${checkoutAddrHTML()}
    ${slotHTML()}
    ${splitHTML()}
    <div class="bill-row total"><span>${t('coPayable')}</span><span>${fmt(tt.total)}</span></div>
    <button class="btn primary full" id="coNext" style="margin-top:12px">${t('coContinue')}</button></div>`;
  else if(coState.step===1) box.innerHTML = `
    <div class="modal-head"><h3>💳 ${HI()?'चेकआउट':'Checkout'} — ${t('coPay')}</h3><button class="icon-btn" onclick="document.getElementById('checkoutModal').classList.remove('show')">✕</button></div>
    <div class="modal-body"><div class="co-steps"><div>1. ${t('coAddr')}</div><div class="active">2. ${t('coPay')}</div><div>3. ${t('coDone')}</div></div>
    ${payMethods().map(([v,e,l])=>`<div class="pay-opt ${coState.pay===v?'sel':''}" data-pay="${v}"><span class="pe">${e}</span>${l}</div>`).join('')}
    ${coState.pay==='upi' ? upiPanelHTML(tt.total) : ''}
    <div class="loy-box"><div class="toggle-row" style="border:none;padding:0"><span>⭐ ${t('loyUse')} <b>(${(loyalty.pts||0)} ${t('loyPts')})</b></span><label class="switch"><input type="checkbox" id="loyRedeem" ${(loyalty.pts||0)>0&&coState.redeem?'checked':''} ${(loyalty.pts||0)>0?'':'disabled'}/><span class="slider"></span></label></div>
    <small class="muted">${t('loyRule')} • ${t('loyEarn')} <b>+${loyEarnFor(tt.total)} ⭐</b></small></div>
    <div class="bill-row"><span>${t('coItems')} (${tt.count})</span><span>${fmt(tt.sub)}</span></div>
    ${tt.discount?`<div class="bill-row"><span>${t('coCoupon')}</span><span class="off">− ${fmt(tt.discount)}</span></div>`:''}
    ${tt.redeem?`<div class="bill-row"><span>⭐ ${t('loyApplied')}</span><span class="off">− ${fmt(tt.redeem)}</span></div>`:''}
    <div class="bill-row"><span>${t('coDelTax')}</span><span>${fmt(tt.del+tt.tax)}</span></div>
    ${tt.expFee?`<div class="bill-row"><span>⚡ ${t('expFee')}</span><span>${fmt(tt.expFee)}</span></div>`:''}
    ${tt.giftFee?`<div class="bill-row"><span>🎁 ${t('giftFee')}</span><span>${fmt(tt.giftFee)}</span></div>`:''}
    <div class="bill-row total"><span>${t('coTotal')}</span><span>${fmt(tt.total)}</span></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn secondary" id="coBack">${t('coBack')}</button>
    <button class="btn primary" style="flex:1" id="coPlace">${t('coPlace')} • ${fmt(tt.total)}</button></div></div>`;
  if(coState.step===0){
    $$('[data-addrsel]',box).forEach(el=>el.onclick=()=>{ coState.addrId=el.dataset.addrsel; renderCheckout(); });
    $$('[data-slotf]',box).forEach(el=>el.onclick=()=>{ coState.slot.food=el.dataset.slotf; renderCheckout(); });
    $$('[data-slots]',box).forEach(el=>el.onclick=()=>{ coState.slot.service=el.dataset.slots; coState.slot.serviceDate=el.dataset.slotd||''; renderCheckout(); });
    $$('[data-slotspeed]',box).forEach(el=>el.onclick=()=>{ coState.slot.speed=el.dataset.slotspeed; renderCheckout(); });
    $$('[data-schedmode]',box).forEach(el=>el.onclick=()=>{
      if(el.dataset.schedmode==='now'){ coState.slot.schedTs = 0; }
      else { const d = schedDays(); if(!coState.slot.schedDay) coState.slot.schedDay = d[0].d; coState.slot.schedTs = schedTsFor(coState.slot.schedDay, +coState.slot.schedWin||0); }
      renderCheckout();
    });
    $$('[data-schedday]',box).forEach(el=>el.onclick=()=>{ coState.slot.schedDay = el.dataset.schedday; coState.slot.schedTs = schedTsFor(coState.slot.schedDay, +coState.slot.schedWin||0); renderCheckout(); });
    $$('[data-schedwin]',box).forEach(el=>el.onclick=()=>{ coState.slot.schedWin = +el.dataset.schedwin; coState.slot.schedTs = schedTsFor(coState.slot.schedDay||schedDays()[0].d, +coState.slot.schedWin); renderCheckout(); });
    const spOn = $('#splitOn');
    if(spOn) spOn.onchange = ()=>{ coState.split.on = spOn.checked; renderCheckout(); };
    $$('[data-splitfor]',box).forEach(sel=>sel.onchange=()=>{ coState.split.map[sel.dataset.splitfor]=sel.value; });
    const nb = $('#coNew'); if(nb) nb.onclick = ()=>{ coState.newAddr=true; renderCheckout(); };
    const bs = $('#coBackSaved'); if(bs) bs.onclick = ()=>{ coState.newAddr=false; renderCheckout(); };
    const cn = $('#coNext');
    if(cn) cn.onclick = ()=>{
      if(addrs.length && !coState.newAddr){
        const a = addrs.find(x=>x.id===coState.addrId) || addrs[0];
        coState.addr = { name:a.name, phone:a.phone, line:a.line, city:a.city, pin:a.pin };
      } else {
        const a = readAddrForm('co');
        if(!a.name || !a.phone || !a.line){ toast('Please fill name, phone & address','⚠️'); return; }
        coState.addr = a;
        const sb = $('#coSaveBook');
        if(sb && sb.checked){ addrs.unshift(a); saveAddrs(); cloudUp(); }
      }
      coState.step=1; renderCheckout();
    };
  } else if(coState.step===1){
    $$('[data-pay]',box).forEach(b=>b.onclick=()=>{ coState.pay=b.dataset.pay; renderCheckout(); });
    $$('[data-uapp]',box).forEach(b=>b.onclick=()=>{ coState.upi.app=b.dataset.uapp; renderCheckout(); });
    const qc = $('#upiQR'); if(qc) drawUPIQR(qc, `aw-${Math.round(tt.total)}-${coState.upi.app}`);
    const ui = $('#upiId');
    if(ui){
      ui.oninput = ()=>{ coState.upi.id = ui.value.trim(); coState.upi.verified = false; const m0=$('#upiMsg'); if(m0){ m0.textContent=''; m0.className='upi-msg'; } };
      const uv = $('#upiVerify');
      if(uv) uv.onclick = ()=>{
        const v = ui.value.trim(), msg = $('#upiMsg');
        if(!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v)){ if(msg){ msg.textContent = '⚠️ '+t('upiInvalid'); msg.className='upi-msg err'; } return; }
        if(msg){ msg.textContent = '⏳ '+t('upiVerifying'); msg.className='upi-msg'; }
        uv.disabled = true;
        setTimeout(()=>{
          const nm = v.split('@')[0].replace(/[._\-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
          coState.upi = { id:v, verified:true, name:nm||'UPI User', app:coState.upi.app };
          renderCheckout(); toast(`UPI verified: ${coState.upi.name} ✓`,'⚡');
        }, 1100);
      };
    }
    const lr = $('#loyRedeem');
    if(lr) lr.onchange = ()=>{ coState.redeem = lr.checked; renderCheckout(); };
    const bk = $('#coBack'); if(bk) bk.onclick = ()=>{ coState.step=0; renderCheckout(); };
    const pl = $('#coPlace');
    if(pl) pl.onclick = ()=>{
      if(coState.pay==='upi' && !coState.upi.verified){ toast(HI()?'पहले अपनी UPI ID वेरिफाई करें':'Please verify your UPI ID first','⚠️'); return; }
      if(coState.pay==='razorpay'){ rzpFlow(tt, box); return; }
      pl.disabled = true;
      const payLabel = coState.pay==='upi' ? `UPI (${coState.upi.app})` : coState.pay.toUpperCase();
      pl.textContent = coState.pay==='upi' ? `⏳ ${t('upiWait')} ${coState.upi.app}…` : t('coPlacing');
      setTimeout(()=>doPlaceOrder(tt, box, payLabel, { upi:coState.pay==='upi'?coState.upi.id:'' }), coState.pay==='upi'?1700:1200);
    };
  }
}

/* ============================================================
   LIVE TRACKER MAP + ORDER TRACKING
   ============================================================ */
let trackToken = 0;
function trackerMapHTML(o){
  const rider = riderFor(o);
  const etas = HI() ? ['35–45 मि.','25–35 मि.','12–20 मि.','3–8 मि.', statusName(4)] : ['35–45 min','25–35 min','12–20 min','3–8 min', statusName(4)];
  return `<div class="map-wrap">
    <svg viewBox="0 0 640 250">
      <rect x="0" y="0" width="640" height="250" rx="14" style="fill:var(--surface-2)"/>
      <rect x="30" y="30" width="150" height="80" rx="10" style="fill:var(--surface-3)"/>
      <rect x="230" y="20" width="120" height="70" rx="10" style="fill:var(--surface-3)"/>
      <rect x="400" y="30" width="200" height="80" rx="10" style="fill:var(--surface-3)"/>
      <rect x="40" y="150" width="200" height="70" rx="10" style="fill:var(--surface-3)"/>
      <rect x="300" y="160" width="130" height="60" rx="10" style="fill:var(--surface-3)"/>
      <rect x="470" y="150" width="140" height="70" rx="10" style="fill:var(--surface-3)"/>
      <line x1="0" y1="125" x2="640" y2="125" style="stroke:var(--surface)" stroke-width="20"/>
      <line x1="0" y1="235" x2="640" y2="235" style="stroke:var(--surface)" stroke-width="16"/>
      <line x1="0" y1="8" x2="640" y2="8" style="stroke:var(--surface)" stroke-width="14"/>
      <line x1="205" y1="0" x2="205" y2="250" style="stroke:var(--surface)" stroke-width="18"/>
      <line x1="445" y1="0" x2="445" y2="250" style="stroke:var(--surface)" stroke-width="18"/>
      <line x1="0" y1="125" x2="640" y2="125" style="stroke:var(--border)" stroke-width="2" stroke-dasharray="12 10"/>
      <rect x="480" y="165" width="110" height="44" rx="10" fill="#bbf7d0" opacity=".8"/>
      <text x="535" y="193" text-anchor="middle" font-size="22">🌳</text>
      <ellipse cx="110" cy="185" rx="52" ry="20" fill="#bae6fd" opacity=".8"/>
      <path id="routePath" d="M 70,205 C 190,205 170,120 290,120 S 450,150 565,60" fill="none" style="stroke:var(--primary)" stroke-width="5" stroke-dasharray="11 9" stroke-linecap="round"/>
      <circle cx="70" cy="205" r="18" fill="#fff" stroke="var(--border)" stroke-width="2"/>
      <text x="70" y="213" text-anchor="middle" font-size="20">🏪</text>
      <circle cx="565" cy="60" r="17" fill="var(--primary)" opacity=".25"><animate attributeName="r" values="14;26" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="1.8s" repeatCount="indefinite"/></circle>
      <circle cx="565" cy="60" r="18" fill="#fff" stroke="var(--success)" stroke-width="3"/>
      <text x="565" y="68" text-anchor="middle" font-size="20">🏠</text>
      <text x="70" y="235" text-anchor="middle" font-size="11" font-weight="800" style="fill:var(--muted)">${t('mapStore')}</text>
      <text x="565" y="30" text-anchor="middle" font-size="11" font-weight="800" style="fill:var(--muted)">${t('mapHome')}</text>
      <g id="riderMark">
        <circle r="17" cx="0" cy="0" fill="#fff" style="stroke:var(--primary)" stroke-width="3.5"/>
        <text x="0" y="8" text-anchor="middle" font-size="20">🛵</text>
      </g>
    </svg>
    <div class="map-top">
      <span class="map-eta">⏱️ ${t('mapEta')} <b>${etas[Math.min(4,o.status)]}</b></span>
      <span class="rider-chip">🛵 ${rider.name} • ★ ${riderAvg(rider.name)}</span>
    </div>
  </div>`;
}
function animateRider(o, token){
  const path = document.getElementById('routePath');
  const mark = document.getElementById('riderMark');
  if(!path || !mark || !path.getTotalLength) return;
  let len = 0;
  try{ len = path.getTotalLength(); }catch{ return; }
  let cur = 0;
  const target = o.status >= 4 ? 1 : Math.min(0.95, (o.status + 0.55) / 4);
  const step = () => {
    if(token !== trackToken) return;
    const tm = document.getElementById('trackModal');
    if(!tm || !tm.classList.contains('show')) return;
    if(!document.body.contains(mark)) return;
    cur += (target - cur) * 0.045;
    if(Math.abs(target - cur) < 0.002) cur = target;
    try{
      const pt = path.getPointAtLength(len * cur);
      mark.setAttribute('transform', `translate(${pt.x},${pt.y})`);
    }catch{}
    if(cur !== target) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function openTrack(id){
  const o = orders.find(x=>x.id===id); if(!o) return;
  const box = $('#trackBox'); if(!box) return;
  const items = o.items.map(i=>{const p=getP(i.id);return p?`${p.e} ${p.n} × ${i.qty}`:'•';});
  const rider = riderFor(o);
  const riderTxt = o.status>=4 ? (HI()?'डिलीवर हो गया। आनंद लें!':'Delivered. Enjoy!')
    : (HI()?`${rider.name} रास्ते में है — जल्द पहुंचेगा`:`${rider.name} is ${['being assigned','packing your items','on the way','nearby'][Math.min(o.status,3)]} — arriving soon…`);
  const sum = slotSummary(o);
  box.innerHTML = `<div class="modal-head"><h3>📍 #${o.id}</h3><button class="icon-btn" onclick="document.getElementById('trackModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    ${trackerMapHTML(o)}
    <div class="track-steps" style="margin:8px 0 14px">${[0,1,2,3,4].map(i=>`<div class="tstep ${i<=o.status?'done':''}"><div class="tdot">${i<=o.status?'✓':i+1}</div>${statusName(i)}</div>`).join('')}</div>
    <div class="rev"><b>🛵 ${t('mapRider')}: ${rider.name} • ★ ${riderAvg(rider.name)}</b><p>${riderTxt}</p></div>
    ${sum?`<div class="rev"><b>🕐 ${t('slotTitle')}</b><p>${esc(sum)}</p></div>`:''}
    ${o.gift?`<div class="rev"><b>🎁 ${t('giftTitle')} — ${esc(occName(o.gift.occasion))}</b><p>"${esc(o.gift.msg||'—')}"</p></div>`:''}
    ${o.return?`<div class="rev"><b>↩ ${t('retStatus')}: ${retStatusName(o.return.status)}</b>
      <div class="track-steps" style="margin-top:10px">${[0,1,2,3].map(i=>`<div class="tstep ${i<=o.return.status?'done':''}"><div class="tdot">${i<=o.return.status?'✓':i+1}</div>${retStatusName(i)}</div>`).join('')}</div>
      <p>${fmt(o.return.amt||o.total)} ${t('retTo')} ${esc(o.pay)}</p></div>`:''}
    ${o.status===4 ? (o.rating
      ? `<div class="rev"><b>⭐ ${t('rateBtn')}</b><p style="color:#f59e0b;font-size:16px">${stars(o.rating.stars)}</p></div>`
      : `<button class="btn secondary full" id="trackRate" style="margin-bottom:10px">⭐ ${t('rateBtn')} — ${rider.name}</button>`) : ''}
    ${splitTrackHTML(o)}
    ${proofHTML(o)}
    <div class="rev"><b>🧾 ${t('coItems')}</b><p>${items.map(esc).join('<br/>')}</p></div>
    <div class="rev"><b>📍 ${t('pDeliverTo')}</b><p>${esc(o.addr.name)} • ${esc(o.addr.line)}, ${esc(o.addr.city)} ${esc(o.addr.pin)}</p></div>
    <div class="bill-row total"><span>${HI()?'भुगतान':'Paid via'} ${esc(o.pay)}${o.razorpay&&o.razorpay.payment_id?' • …'+esc(o.razorpay.payment_id.slice(-6)):''}</span><span>${fmt(o.total)}</span></div>
    ${o.status<4?`<button class="btn secondary full" id="simNext" style="margin-top:12px">🔄 ${HI()?'स्टेटस रिफ्रेश करें':'Refresh live status'}</button>`:''}
  </div>`;
  openModal('trackModal');
  trackToken++;
  $$('[data-sibgo]',box).forEach(b=>b.onclick=()=>openTrack(b.dataset.sibgo));
  bindProof(o);
  animateRider(o, trackToken);
  const tr = $('#trackRate');
  if(tr) tr.onclick = ()=>openRate(id);
  const sn = $('#simNext');
  if(sn) sn.onclick = ()=>{
    o.status=Math.min(4,o.status+1); if(o.status===4) snapProof(o); saveOrders(); cloudUp();
    notify(HI()?'ऑर्डर अपडेट':'Order update', `#${o.id}: ${statusName(o.status)}`, o.status===4?'✅':'📦');
    openTrack(id); if(route.page==='orders')renderPage(); toast('Status: '+statusName(o.status),'📦');
  };
}

/* ============================================================
   RIDER RATINGS
   ============================================================ */
let rateSel = { stars:5, tags:new Set() };
function openRate(id){
  const o = orders.find(x=>x.id===id); if(!o || o.rating) return;
  const box = $('#rateBox'); if(!box) return;
  const rider = riderFor(o);
  rateSel = { stars:5, tags:new Set() };
  box.innerHTML = `<div class="modal-head"><h3>⭐ ${t('rateTitle')}</h3>
    <button class="icon-btn" onclick="document.getElementById('rateModal').classList.remove('show')">✕</button></div>
  <div class="modal-body"><div class="center"><div style="font-size:52px">🛵</div>
    <h3 style="margin:6px 0">${rider.name} • ★ ${riderAvg(rider.name)}</h3>
    <p class="muted small">${t('rateHow')}</p></div>
    <div class="star-row">${[1,2,3,4,5].map(i=>`<button class="star-btn lit" data-star="${i}">★</button>`).join('')}</div>
    <div class="tag-pills">${RATING_TAGS.map((tg,i)=>`<button class="tag-pill" data-tag="${i}">${HI()?tg.hi:tg.en}</button>`).join('')}</div>
    <button class="btn primary full" id="rateGo" style="margin-top:12px">${t('rateSubmit')}</button>
  </div>`;
  openModal('rateModal');
  $$('[data-star]',box).forEach(b=>b.onclick=()=>{ rateSel.stars=+b.dataset.star; $$('[data-star]',box).forEach(x=>x.classList.toggle('lit',+x.dataset.star<=rateSel.stars)); });
  $$('[data-tag]',box).forEach(b=>b.onclick=()=>{ const i=+b.dataset.tag; rateSel.tags.has(i)?rateSel.tags.delete(i):rateSel.tags.add(i); b.classList.toggle('sel'); });
  const go = $('#rateGo');
  if(go) go.onclick = ()=>{
    o.rating = { stars:rateSel.stars, tags:[...rateSel.tags], ts:Date.now() };
    saveOrders(); cloudUp();
    const rr = riderRatings[rider.name] || []; rr.push(rateSel.stars);
    riderRatings[rider.name] = rr; LS.set('aw_rider_ratings_v1', riderRatings);
    const rm = $('#rateModal'); if(rm) rm.classList.remove('show');
    if(route.page==='orders') renderPage();
    const tm = $('#trackModal'); if(tm && tm.classList.contains('show')) openTrack(id);
    toast(t('rateThanks'),'⭐');
  };
}

/* ============================================================
   RETURNS & REFUNDS
   ============================================================ */
function openReturn(id){
  const o = orders.find(x=>x.id===id); if(!o || o.return) return;
  const box = $('#returnBox'); if(!box) return;
  box.innerHTML = `<div class="modal-head"><h3>↩ ${t('retTitle')} — #${o.id}</h3>
    <button class="icon-btn" onclick="document.getElementById('returnModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    <div class="rev"><b>💰 ${fmt(o.total)}</b><p>${t('retTo')} <b>${esc(o.pay)}</b> ${HI()?'में 3–5 दिन में':'within 3–5 days'}</p></div>
    <h4 class="mt">${t('retReason')}</h4>
    ${RETURN_REASONS.map((r,i)=>`<label class="reason-row ${i===0?'sel':''}"><input type="radio" name="rreason" value="${i}" ${i===0?'checked':''}/> ${HI()?r.hi:r.en}</label>`).join('')}
    <div class="field" style="margin-top:10px"><label>${t('retDetail')}</label><textarea id="retDetail" rows="2" placeholder="${t('retDetail')}"></textarea></div>
    <button class="btn primary full" id="retGo">${t('retConfirm')}</button>
  </div>`;
  openModal('returnModal');
  $$('input[name=rreason]',box).forEach(r=>r.onchange=()=>{ $$('.reason-row',box).forEach(x=>x.classList.remove('sel')); r.closest('.reason-row').classList.add('sel'); });
  const go = $('#retGo');
  if(go) go.onclick = ()=>{
    const sel = ($('input[name=rreason]:checked',box)||{value:0}).value;
    o.return = { reason:+sel, detail:($('#retDetail')||{value:''}).value.trim(), status:0, ts:Date.now(), amt:o.total };
    saveOrders(); cloudUp();
    const m = $('#returnModal'); if(m) m.classList.remove('show');
    notify(HI()?'रिटर्न रिक्वेस्ट ↩':'Return requested ↩', `#${o.id} • ${retStatusName(0)}`, '↩');
    if(route.page==='orders') renderPage();
    toast(HI()?'रिटर्न रिक्वेस्ट हो गई':'Return requested','↩');
  };
}
/* demo live simulation: orders + refunds advance over time */
function tickSim(){
  let moved = false;
  orders.forEach(o=>{
    if(o.scheduledFor && o.scheduledFor > Date.now()){
      if(!o.reminded && o.scheduledFor - Date.now() < 30*60*1000){
        o.reminded = true; moved = true;
        notify(`⏰ ${t('schedRemind')}`, `#${o.id} • ${t('schedRemindSub')} (${schedLabel(o.scheduledFor)})`, '⏰');
      }
      return;
    }
    if(o.status<4 && Math.random()<.25){
      o.status++; moved=true;
      if(o.status===4) snapProof(o);
      notify(HI()?'ऑर्डर अपडेट':'Order update', `#${o.id}: ${statusName(o.status)}`, o.status===4?'✅':'📦');
    } else if(o.return && o.return.status<3 && Math.random()<.22){
      o.return.status++; moved=true;
      const done = o.return.status===3;
      notify(HI()?'रिफंड अपडेट':'Refund update',
        done ? `${fmt(o.return.amt||o.total)} → ${o.pay} ✓` : `#${o.id}: ${retStatusName(o.return.status)}`,
        done?'💰':'↩');
    }
  });
  const madeSubs = fulfillSubs();
  if(moved || madeSubs){ saveOrders(); cloudUp(); if(route.page==='orders') renderPage(); }
}
setInterval(tickSim, 25000);

/* ============================================================
   LOCATION + AUTH (+ address manager) + SEARCH + VOICE
   ============================================================ */
function renderCities(f=''){
  const q = f.toLowerCase();
  const list = CITIES.filter(c=>(c.n+c.pin).toLowerCase().includes(q));
  const grid = $('#cityGrid'); if(!grid) return;
  grid.innerHTML = list.map(c=>`<div class="city" data-pick="${c.n}"><span class="ce">${c.e}</span><b>${c.n}</b><small>${c.pin}</small></div>`).join('') || `<span class="muted small">${t('noMatch')}</span>`;
  $$('#cityGrid [data-pick]').forEach(b=>b.onclick=()=>{
    location = CITIES.find(x=>x.n===b.dataset.pick); LS.set('aw_loc_v1',location);
    renderNav(); const lm=$('#locationModal'); if(lm) lm.classList.remove('show'); renderPage(); toast(`Delivering to ${location.n} 📍`,'📍');
  });
}
function openAuth(mode='login'){
  const render = ()=>{
    const tl = $('#tabLogin'), ts = $('#tabSignup');
    if(tl) tl.classList.toggle('active', mode==='login');
    if(ts) ts.classList.toggle('active', mode==='signup');
    const form = $('#authForm'); if(!form) return;
    if(user){
      const lab = l => l==='home'?'🏠 '+t('addrHome'):l==='work'?'💼 '+t('addrWork'):'📍 '+t('addrOther');
      form.innerHTML = `<div class="center" style="padding:6px 0"><div style="font-size:48px">👋</div>
        <h3 style="margin:8px 0 2px">${t('auHi')}, ${esc(user.name)}!</h3><p class="muted small">${esc(user.email)} • ${esc(user.phone||'')}</p></div>
        <div class="addr-head"><h4>📍 ${t('addrTitle')}</h4></div>
        <div id="auAddrList">${addrs.length ? addrs.map(a=>`<div class="addr-card sel" style="cursor:default"><span class="alab">${lab(a.label)}</span>
          <button class="adel" data-aadel="${a.id}">🗑️</button><br/><b>${esc(a.name)}</b><p>${esc(a.line)}, ${esc(a.city)} ${esc(a.pin)}<br/>📞 ${esc(a.phone)}</p></div>`).join('')
        : `<p class="muted small center">${t('addrEmpty')}</p>`}</div>
        <button class="btn secondary full sm" id="auAddrToggle">＋ ${t('addrAdd')}</button>
        <div id="auAddrForm" class="hidden" style="margin-top:10px">${addrFormHTML('auA')}
          <button class="btn primary full" id="auAddrSave">${t('addrSave')}</button></div>
        <button class="btn ghost full" id="btnLogout" style="margin-top:10px">${t('auLogout')}</button>`;
      const lo = $('#btnLogout'); if(lo) lo.onclick = ()=>{ user=null; LS.del('aw_user_v1'); toast('Logged out','👋'); render(); };
      const tg = $('#auAddrToggle');
      if(tg) tg.onclick = ()=>{ const f=$('#auAddrForm'); if(f) f.classList.toggle('hidden'); };
      const sv = $('#auAddrSave');
      if(sv) sv.onclick = ()=>{
        const a = readAddrForm('auA');
        if(!a.name||!a.phone||!a.line){ toast('Please fill name, phone & address','⚠️'); return; }
        addrs.unshift(a); saveAddrs(); cloudUp(); render(); toast(HI()?'पता सेव हो गया':'Address saved','📍');
      };
      $$('[data-aadel]',form).forEach(b=>b.onclick=()=>{ addrs = addrs.filter(x=>x.id!==b.dataset.aadel); saveAddrs(); cloudUp(); render(); });
      return;
    }
    form.innerHTML = `${mode==='signup'?`<div class="field"><label>${t('auName')}</label><input type="text" id="auName" placeholder="${t('auName')}"/></div>`:''}
      <div class="field"><label>${t('auEmail')}</label><input type="text" id="auEmail" placeholder="you@email.com"/></div>
      <div class="field"><label>${t('auPhone')}</label><input type="text" id="auPhone" placeholder="10-digit mobile"/></div>
      <button class="btn primary full" id="auGo">${mode==='login'?t('auLoginBtn'):t('auCreateBtn')}</button>`;
    const go = $('#auGo');
    if(go) go.onclick = ()=>{
      const email = $('#auEmail').value.trim(), phone = $('#auPhone').value.trim();
      const nm = $('#auName');
      const name = mode==='signup' ? (nm?nm.value.trim():'') : (email.split('@')[0]||'Friend');
      if(!email || !phone){ toast('Enter email & phone','⚠️'); return; }
      user = { name: name||'Friend', email, phone }; LS.set('aw_user_v1', user);
      const am=$('#authModal'); if(am) am.classList.remove('show'); render(); toast(`Welcome, ${user.name}!`,'🎉');
    };
  };
  const tl = $('#tabLogin'), ts = $('#tabSignup');
  if(tl) tl.onclick = ()=>{ mode='login'; render(); };
  if(ts) ts.onclick = ()=>{ mode='signup'; render(); };
  render(); openModal('authModal');
}
function bindSearch(inputEl){
  if(!inputEl) return ()=>{};
  const sug = $('#searchSuggest');
  const go = q => { route={page:'shop',vertical:'all',category:'all',query:q,sort:'pop'}; filters={cats:new Set(),maxPrice:100000,minRating:0,vegOnly:false}; if(sug) sug.classList.remove('show'); renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  inputEl.addEventListener('input', ()=>{
    const q = inputEl.value.trim().toLowerCase();
    if(!sug) return;
    if(q.length<2){ sug.classList.remove('show'); return; }
    const hits = getProducts().filter(p=>(p.n+' '+p.c+' '+p.s).toLowerCase().includes(q)).slice(0,6);
    sug.innerHTML = hits.map(p=>`<div class="sug-item" data-s="${p.id}"><span class="em ${p.g}">${p.e}</span><div><b>${esc(p.n)}</b><small>${esc(p.c)} • ${fmt(p.p)}</small></div></div>`).join('')
      || `<div class="sug-item"><div><b>${t('noMatch')}</b><small>Try "pizza", "milk", "watch"…</small></div></div>`;
    sug.classList.add('show');
    $$('[data-s]',sug).forEach(b=>b.onclick=()=>{ inputEl.value=''; sug.classList.remove('show'); openProduct(b.dataset.s); });
  });
  inputEl.addEventListener('keydown', e=>{ if(e.key==='Enter' && inputEl.value.trim()) go(inputEl.value.trim()); });
  document.addEventListener('click', e=>{ if(sug && !e.target.closest('.search-wrap')) sug.classList.remove('show'); });
  return go;
}
function bindVoice(btnId, inputEl, go){
  const btn = document.getElementById(btnId);
  if(!btn || !inputEl) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ btn.style.display = 'none'; return; }
  btn.onclick = ()=>{
    const rec = new SR();
    rec.lang = HI() ? 'hi-IN' : 'en-IN';
    rec.interimResults = true; rec.maxAlternatives = 1;
    const oldPH = inputEl.placeholder;
    inputEl.value = '';
    btn.classList.add('listening');
    inputEl.placeholder = t('voiceListen');
    try{ inputEl.focus(); }catch{}
    let finalQ = '';
    rec.onresult = e=>{
      let interim = '';
      for(let i=e.resultIndex; i<e.results.length; i++){
        const tr = e.results[i][0].transcript;
        if(e.results[i].isFinal) finalQ += tr; else interim += tr;
      }
      inputEl.value = finalQ || interim;
      if(finalQ){ try{ rec.stop(); }catch{} }
    };
    rec.onend = ()=>{
      btn.classList.remove('listening');
      inputEl.placeholder = oldPH;
      const q = (finalQ || inputEl.value).trim();
      if(q) go(q); else toast(t('voiceNoHit'),'🎤');
    };
    rec.onerror = ()=>{ btn.classList.remove('listening'); inputEl.placeholder = oldPH; };
    try{ rec.start(); }catch{ btn.classList.remove('listening'); inputEl.placeholder = oldPH; }
  };
}

/* ============================================================
   CUSTOMIZER
   ============================================================ */
const CUSTOM_TABS = [['store','🏪 Store'],['theme','🎨 Theme'],['home','🏠 Homepage'],['promos','🎁 Promos'],['commerce','💰 Commerce'],['products','📦 Products'],['data','💾 Data']];
function cloudCardHTML(){
  const on = cloudOn();
  let last = '';
  try{ const c = Cloud.ensure(); if(on && c.lastSync) last = `<small class="muted">• ${t('cloudLast')} ${timeAgo(c.lastSync)}</small>`; }catch{}
  let url = '';
  try{ url = Cloud.ensure().url || ''; }catch{}
  return `<div class="c-group"><h4>☁️ ${t('cloudTitle')}</h4>
    <div class="cloud-card">
      <div class="cloud-status"><span class="dot ${on?'on':''}"></span>${on?t('cloudOn'):t('cloudLocal')} ${last}</div>
      <p class="muted small" style="margin:0 0 4px">${t('cloudDesc')}</p>
      <div class="field"><label>${t('cloudUrl')}</label><input type="text" id="cloudUrl" value="${esc(url)}" placeholder="https://your-app.firebaseio.com"/></div>
      <div class="cloud-row">
        ${on?`<button class="btn secondary full sm" id="cloudSync">🔄 ${t('cloudSync')}</button><button class="btn danger-ghost sm" id="cloudOff">${t('cloudOff')}</button>`
        :`<button class="btn primary full sm" id="cloudGo">☁️ ${t('cloudConnect')}</button>`}
      </div>
    </div></div>`;
}
function renderCustomizer(tab='store'){
  const tabs = $('#customTabs'); if(!tabs) return;
  tabs.innerHTML = CUSTOM_TABS.map(([id,l])=>`<button class="${id===tab?'active':''}" data-ct="${id}">${l}</button>`).join('');
  $$('#customTabs button').forEach(b=>b.onclick=()=>renderCustomizer(b.dataset.ct));
  const B = $('#customBody'); if(!B) return;
  const S = settings;
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
  if(tab==='promos'){
    const all = getBanners();
    B.innerHTML = `<div style="display:flex;gap:8px"><button class="btn primary full" id="cAddB">＋ ${t('promoAdd')}</button><button class="btn ghost sm" id="cResetB" title="Reset">↺</button></div>
      <p class="muted small center">🎁 × ${all.length}</p>
      <div id="cBList">${all.length ? all.map(promoRowHTML).join('') : `<p class="muted small center">${t('promoEmpty')}</p>`}</div>`;
    const ab = $('#cAddB'); if(ab) ab.onclick = ()=>openPromo(null);
    const rb = $('#cResetB'); if(rb) rb.onclick = ()=>{ customBanners = null; LS.del('aw_banners_v1'); renderCustomizer('promos'); renderPage(); toast('Banners reset','🎁'); };
    bindPromoRows();
  }
  if(tab==='commerce'){
    const C = S.commerce;
    B.innerHTML = `<div class="c-group"><h4>💠 ${t('rzpTitle')}</h4><div class="cloud-card">
      <p class="muted small" style="margin:0 0 4px">${t('rzpDesc')}</p>
      <div class="field"><label>${t('rzpKey')}</label><input type="text" id="rzpKeyIn" value="${esc(rzpKey)}" placeholder="rzp_test_… / rzp_live_…"/></div>
      <div class="cloud-row"><button class="btn primary full sm" id="rzpSave">${t('rzpSave')}</button>${rzpKey?`<button class="btn danger-ghost sm" id="rzpRemove">${t('rzpRemove')}</button>`:''}</div>
    </div></div>
    <div class="c-group"><h4>Money</h4>
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
    const ap = $('#cAddP'); if(ap) ap.onclick = ()=>openPM(null);
    const ps = $('#cPSearch');
    if(ps) ps.oninput = e=>{
      const q = e.target.value.toLowerCase();
      const hits = getProducts().filter(p=>(p.n+p.c+p.v).toLowerCase().includes(q)).slice(0,40);
      const pl = $('#cPList'); if(pl) pl.innerHTML = hits.map(pmRow).join(''); bindPmRows();
    };
    bindPmRows();
  }
  if(tab==='data') B.innerHTML = cloudCardHTML() + `
    <div class="c-group"><h4>Backup & restore</h4>
      <p class="muted small">Export your theme, store content & product catalog as JSON. Import it on any device.</p>
      <div style="display:flex;gap:8px"><button class="btn secondary full" id="dExp">⬇ Export JSON</button><button class="btn secondary full" id="dImp">⬆ Import JSON</button></div></div>
    <div class="c-group"><h4>Demo data</h4>
      <div class="toggle-row"><span>Sample orders</span><button class="btn ghost sm" id="dSeed">Add sample</button></div>
      <div class="toggle-row"><span>Reset everything</span><button class="btn danger-ghost sm" id="dReset">Reset</button></div></div>
    <div class="c-group"><h4>About</h4><p class="muted small">${getProducts().length} products • ${VERTICALS.length} verticals • ${orders.length} orders<br/>All data lives in your browser (localStorage)${cloudOn()?' + ☁️ cloud':''}.</p></div>`;
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
    if(!p || !confirm(`Delete "${p.n}"?`)) return;
    extraProducts = extraProducts.filter(x=>x.id!==p.id); LS.set('aw_products_extra_v1', extraProducts);
    if(SEED_PRODUCTS.find(x=>x.id===p.id)){ deletedIds.push(p.id); LS.set('aw_products_deleted_v1', deletedIds); }
    delete editedProducts[p.id]; LS.set('aw_products_edited_v1', editedProducts);
    delete cart[p.id]; saveCart(); updateBadges(); cloudUp();
    renderCustomizer('products'); renderPage(); toast('Product deleted','🗑️');
  });
}
function promoRowHTML(b){
  const v = b.vert && b.vert !== 'all' ? vertOf(b.vert) : null;
  return `<div class="pm-row"><span class="pe" style="background:${b.bg};font-size:22px">${b.e}</span><div class="pi"><b>${esc(b.t)||'(untitled)'}</b><small>${b.code?'🎟️ '+b.code+' • ':''}${v?v.emoji+' '+vname(v):'🌍 '+t('all')}</small></div>
  <button class="btn secondary sm" data-bedit="${b.id}">${t('selEdit')}</button><button class="btn danger-ghost sm" data-bdel="${b.id}">✕</button></div>`;
}
function bindPromoRows(){
  $$('#cBList [data-bedit]').forEach(b=>b.onclick=()=>openPromo(b.dataset.bedit));
  $$('#cBList [data-bdel]').forEach(b=>b.onclick=()=>{
    initCustomBanners();
    customBanners = customBanners.filter(x=>x.id!==b.dataset.bdel);
    saveBanners(); renderCustomizer('promos'); renderPage(); toast('Banner deleted','🗑️');
  });
}
function openPromo(id){
  initCustomBanners();
  const b = id ? customBanners.find(x=>x.id===id) : { id:uid('b'), e:'🎁', t:'', s:'', bg:PROMO_GRADIENTS[0], code:'', vert:'all' };
  if(!b) return;
  let bg = b.bg || PROMO_GRADIENTS[0];
  const box = $('#promoBox'); if(!box) return;
  box.innerHTML = `<div class="modal-head"><h3>${id?'✏️':'＋'} ${t('promoTitle')}</h3>
    <button class="icon-btn" onclick="document.getElementById('promoModal').classList.remove('show')">✕</button></div>
  <div class="modal-body">
    <div class="banner" id="pbPrev" style="background:${bg};margin-bottom:12px;pointer-events:none"><span class="be">${b.e}</span><b>${esc(b.t)||'Title'}</b><small>${esc(b.s)||'Subtitle'}</small><span class="go">🎟️ →</span></div>
    <div class="addr-grid">
      <div class="field"><label>${t('promoEmoji')}</label><input type="text" id="pbE" value="${esc(b.e)}"/></div>
      <div class="field"><label>${t('promoCode')}</label><select id="pbCode"><option value="">${t('promoNone')}</option>${COUPONS.map(c=>`<option value="${c.code}" ${b.code===c.code?'selected':''}>${c.code}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>${HI()?'शीर्षक':'Title'}</label><input type="text" id="pbT" value="${esc(b.t)}"/></div>
    <div class="field"><label>${t('promoSubT')}</label><input type="text" id="pbS" value="${esc(b.s)}"/></div>
    <div class="field"><label>${t('promoColor')}</label><div class="swatch-row">${PROMO_GRADIENTS.map(x=>`<div class="swatch ${x===bg?'active':''}" data-pg="${x}" style="background:${x};border-radius:10px"></div>`).join('')}</div></div>
    <div class="field"><label>${t('promoTarget')}</label><select id="pbVert"><option value="all">🌍 ${t('all')}</option>${VERTICALS.map(v=>`<option value="${v.id}" ${b.vert===v.id?'selected':''}>${v.emoji} ${vname(v)}</option>`).join('')}</select></div>
    <button class="btn primary full" id="pbSave">${t('promoSave')}</button>
  </div>`;
  openModal('promoModal');
  const prev = ()=>{
    const pv = $('#pbPrev'); if(!pv) return;
    pv.style.background = bg;
    pv.querySelector('.be').textContent = ($('#pbE')||{value:'🎁'}).value || '🎁';
    pv.querySelector('b').textContent = ($('#pbT')||{value:''}).value || 'Title';
    pv.querySelector('small').textContent = ($('#pbS')||{value:''}).value || 'Subtitle';
  };
  ['pbE','pbT','pbS'].forEach(x=>{ const el=$('#'+x); if(el) el.oninput = prev; });
  $$('#promoBox [data-pg]').forEach(s=>s.onclick=()=>{ bg=s.dataset.pg; $$('#promoBox [data-pg]').forEach(x=>x.classList.remove('active')); s.classList.add('active'); prev(); });
  const sv = $('#pbSave');
  if(sv) sv.onclick = ()=>{
    const obj = { id:b.id, e:($('#pbE')||{value:'🎁'}).value||'🎁', t:($('#pbT')||{value:''}).value.trim(),
      s:($('#pbS')||{value:''}).value.trim(), bg, code:($('#pbCode')||{value:''}).value, vert:($('#pbVert')||{value:'all'}).value };
    const ix = customBanners.findIndex(x=>x.id===b.id);
    if(ix>-1) customBanners[ix] = obj; else customBanners.push(obj);
    saveBanners();
    const pm = $('#promoModal'); if(pm) pm.classList.remove('show');
    renderCustomizer('promos'); renderPage(); toast('Banner saved','🎁');
  };
}
function bindCustomizer(tab){
  const live = ()=>{ saveSettings(); cloudUp(); applySettings(); applyChromeI18n(); renderNav(); renderPage(); };
  const on = (id, ev, fn) => { const el = document.getElementById(id); if(el) el[ev] = fn; };
  if(tab==='store'){
    $$('#cLang button').forEach(b=>b.onclick=()=>{ settings.lang=b.dataset.l; saveSettings(); renderAll(); renderCustomizer('store'); });
    on('cLogo','oninput', e=>{ settings.logoEmoji=e.target.value; live(); });
    on('cLogoFile','onchange', async e=>{
      const f = e.target.files[0]; if(!f) return;
      try{ settings.logoImg = await fileToDataURL(f, 256, .85); live(); renderCustomizer('store'); toast('Logo updated','🖼️'); }
      catch{ toast('Could not read that image','⚠️'); }
    });
    on('cLogoRm','onclick', ()=>{ settings.logoImg=''; live(); renderCustomizer('store'); });
    on('cName1','oninput', e=>{ settings.storeName=e.target.value; live(); });
    on('cName2','oninput', e=>{ settings.storeName2=e.target.value; live(); });
    on('cTag','oninput', e=>{ settings.tagline=e.target.value; live(); });
    on('cAnnShow','onchange', e=>{ settings.showAnnounce=e.target.checked; live(); });
    on('cAnn','oninput', e=>{ settings.announce=e.target.value; live(); });
    on('cHB','oninput', e=>{ settings.heroBadge=e.target.value; live(); });
    on('cHT','oninput', e=>{ settings.heroTitle=e.target.value; live(); });
    on('cHS','oninput', e=>{ settings.heroSub=e.target.value; live(); });
    on('cHC1','oninput', e=>{ settings.heroCta1=e.target.value; live(); });
    on('cHC2','oninput', e=>{ settings.heroCta2=e.target.value; live(); });
  }
  if(tab==='theme'){
    $$('#cMode button').forEach(b=>b.onclick=()=>{ settings.theme.mode=b.dataset.m; live(); renderCustomizer('theme'); });
    $$('#customBody .swatch[data-p]').forEach(s=>s.onclick=()=>{ settings.theme.primary=s.dataset.p; settings.theme.secondary=s.dataset.s; live(); renderCustomizer('theme'); });
    on('cP1','oninput', e=>{ settings.theme.primary=e.target.value; live(); });
    on('cP2','oninput', e=>{ settings.theme.secondary=e.target.value; live(); });
    on('cFont','onchange', e=>{ settings.theme.font=e.target.value; live(); });
    on('cR','oninput', e=>{ settings.theme.radius=+e.target.value; setT('cRv', e.target.value+'px'); live(); });
    $$('#cCard button').forEach(b=>b.onclick=()=>{ settings.theme.cardStyle=b.dataset.c; live(); renderCustomizer('theme'); });
  }
  if(tab==='home') $$('[data-sec]').forEach(x=>x.onchange=()=>{ settings.sections[x.dataset.sec]=x.checked; live(); });
  if(tab==='commerce'){
    on('rzpSave','onclick', ()=>{ rzpKey = ($('#rzpKeyIn')||{value:''}).value.trim(); LS.set('aw_rzp_v1', rzpKey); renderCustomizer('commerce'); toast(rzpKey?'Razorpay enabled 💠':'Key cleared','💠'); });
    on('rzpRemove','onclick', ()=>{ rzpKey = ''; LS.del('aw_rzp_v1'); renderCustomizer('commerce'); });
    on('cCur','oninput', e=>{ settings.commerce.currency=e.target.value||'₹'; live(); renderCart(); });
    on('cDel','oninput', e=>{ settings.commerce.deliveryFee=+e.target.value||0; live(); renderCart(); });
    on('cFree','oninput', e=>{ settings.commerce.freeAbove=+e.target.value||0; live(); renderCart(); });
    on('cTax','oninput', e=>{ settings.commerce.taxPct=+e.target.value||0; live(); renderCart(); });
    $$('[data-cm]').forEach(x=>x.onchange=()=>{ settings.commerce[x.dataset.cm]=x.checked; live(); });
  }
  if(tab==='data'){
    on('dExp','onclick', exportData);
    on('dImp','onclick', ()=>{ const f=$('#importFile'); if(f) f.click(); });
    on('dSeed','onclick', ()=>{ seedSampleOrders(); toast('Sample orders added','📦'); });
    on('dReset','onclick', resetAll);
    on('cloudGo','onclick', async ()=>{
      const url = ($('#cloudUrl')||{value:''}).value.trim();
      const btn = $('#cloudGo'); if(btn){ btn.disabled = true; btn.textContent = '⏳…'; }
      const res = await Cloud.test(url);
      if(res === 'ok'){
        Cloud.ensure().url = url.replace(/\/+$/,''); Cloud.save();
        try{ await Cloud.syncUp(); await Cloud.syncDown(true); }catch{}
        renderAll(); renderCustomizer('data'); toast('☁️ Cloud connected!','☁️');
      } else {
        if(btn){ btn.disabled = false; }
        renderCustomizer('data');
        toast(res==='badurl' ? 'Paste a valid firebaseio.com URL' : res==='denied' ? 'Rules denied access — enable test mode' : 'Could not reach database', '⚠️');
      }
    });
    on('cloudOff','onclick', ()=>{ Cloud.ensure().url=''; Cloud.save(); renderCustomizer('data'); if(route.page==='seller') renderPage(); toast('Cloud disconnected — local only','📴'); });
    on('cloudSync','onclick', async ()=>{
      const btn = $('#cloudSync'); if(btn){ btn.disabled = true; btn.textContent = '⏳…'; }
      try{ await Cloud.syncUp(); await Cloud.syncDown(true); renderAll(); renderCustomizer('data'); toast('☁️ Synced!','☁️'); }
      catch{ toast('Sync failed — check connection','⚠️'); renderCustomizer('data'); }
    });
  }
}
function exportData(){
  const data = { settings, extraProducts, deletedIds, editedProducts, addrs, customBanners, loyalty, subs, exportedAt:new Date().toISOString() };
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
  if(!p) return;
  const grads = ['g1','g2','g3','g4','g5','g6','g7','g8'];
  let g = p.g, imgVal = p.img || '';
  const box = $('#pmBox'); if(!box) return;
  box.innerHTML = `<div class="modal-head"><h3>${id?'✏️ Edit product':'＋ Add product'}</h3>
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
  const refreshPrev = ()=>{ const pv=$('#pmPrev'); if(pv){ pv.className = `pm-img-prev ${g}`; pv.innerHTML = mediaHTML({ e:($('#pmE')||{value:'📦'}).value||'📦', img:imgVal }); } };
  const fillCats = ()=>{ const vv = ($('#pmV')||{value:'food'}).value; const sc=$('#pmC'); if(sc) sc.innerHTML = (CATEGORIES[vv]||['General']).map(c=>`<option ${c===p.c?'selected':''}>${c}</option>`).join(''); };
  fillCats();
  const pmv = $('#pmV'); if(pmv) pmv.onchange = fillCats;
  $$('#pmBox [data-g]').forEach(s=>s.onclick=()=>{ g=s.dataset.g; $$('#pmBox [data-g]').forEach(x=>x.classList.remove('active')); s.classList.add('active'); refreshPrev(); });
  const pme = $('#pmE'); if(pme) pme.oninput = refreshPrev;
  const pmi = $('#pmImg'); if(pmi) pmi.oninput = e=>{ imgVal = e.target.value.trim(); refreshPrev(); };
  const pmr = $('#pmImgRm'); if(pmr) pmr.onclick = ()=>{ imgVal=''; const a=$('#pmImg'),b=$('#pmFile'); if(a)a.value=''; if(b)b.value=''; refreshPrev(); };
  const pmf = $('#pmFile');
  if(pmf) pmf.onchange = async e=>{
    const f = e.target.files[0]; if(!f) return;
    try{
      imgVal = await fileToDataURL(f, 800, .82);
      if(imgVal.length > 1400000) toast('Large photo — saved, but keep uploads small','⚠️');
      const a=$('#pmImg'); if(a) a.value=''; refreshPrev(); toast('Photo added 📸','🖼️');
    }catch{ toast('Could not read that image','⚠️'); }
  };
  const pms = $('#pmSave');
  if(pms) pms.onclick = ()=>{
    const gv = sel => { const el=$(sel); return el?el.value:''; };
    const obj = { id:id||uid('c'), n:gv('#pmN').trim()||'Untitled', v:gv('#pmV'), c:gv('#pmC'),
      p:+gv('#pmP')||0, m:+gv('#pmM')||0, r:p.r||4.5, rc:p.rc||10, e:gv('#pmE')||'📦', g,
      d:gv('#pmD'), s:gv('#pmS'), u:gv('#pmU'), t:gv('#pmT'), badge:gv('#pmB'),
      veg:($('#pmVeg')||{}).checked||false, img:imgVal };
    if(id){ const ix = extraProducts.findIndex(x=>x.id===id);
      if(ix>-1) extraProducts[ix]=obj; else editedProducts[id]=obj;
    } else extraProducts.push(obj);
    const ok1 = LS.set('aw_products_extra_v1',extraProducts), ok2 = LS.set('aw_products_edited_v1',editedProducts);
    if(!ok1 || !ok2) toast('Storage full — photo too large, try a smaller image','⚠️');
    cloudUp();
    const pm2=$('#pmModal'); if(pm2) pm2.classList.remove('show');
    renderCustomizer('products'); renderPage();
    toast(id?'Product updated':'Product added to store','📦');
  };
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', ()=>{
  try{ renderAll(); }catch(err){ console.error(err); }
  renderCart(); renderWish(); renderCities();
  bindDrawerClose();
  try{
    if(typeof Cloud !== 'undefined'){
      Cloud.startPoll();
      Cloud.syncDown(false).then(ch=>{ if(ch) renderAll(); }).catch(()=>{});
    }
  }catch{}
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on('overlay', closeAll);
  on('btnCart', ()=>{ renderCart(); openDrawer('cartDrawer'); });
  on('btnWishlist', ()=>{ renderWish(); openDrawer('wishDrawer'); });
  on('btnBell', ()=>{ notifs.forEach(n=>n.read=true); saveNotifs(); updateBadges(); renderNotifs(); openDrawer('notifDrawer'); });
  on('btnCustomize', ()=>{ openDrawer('customDrawer'); renderCustomizer('store'); });
  on('btnCustomize2', ()=>{ openDrawer('customDrawer'); renderCustomizer('store'); });
  on('btnMenu', ()=>{ const sm=$('#sideMenu'),ov=$('#overlay'); if(sm) sm.classList.add('show'); if(ov) ov.classList.add('show'); });
  on('btnCloseMenu', closeAll);
  on('btnUser', ()=>openAuth('login'));
  on('btnLogin2', ()=>{ closeAll(); openAuth('login'); });
  on('btnOffers', ()=>{ route.page='offers'; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); });
  on('btnLang', ()=>{
    settings.lang = HI() ? 'en' : 'hi'; saveSettings(); renderAll();
    toast(HI()?'भाषा: हिंदी 🌐':'Language: English 🌐','🌐');
  });
  on('logoHome', e=>{ e.preventDefault(); route={page:'home',vertical:'all',category:'all',query:'',sort:'pop'}; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); });
  on('btnLocation', ()=>{ renderCities(); openModal('locationModal'); });
  on('btnLocation2', ()=>{ closeAll(); renderCities(); openModal('locationModal'); });
  const locS = $('#locSearch'); if(locS) locS.oninput = e=>renderCities(e.target.value);
  on('btnDetect', ()=>{ const c = CITIES[Math.floor(Math.random()*CITIES.length)]; location=c; LS.set('aw_loc_v1',c); renderNav(); const lm=$('#locationModal'); if(lm) lm.classList.remove('show'); renderPage(); toast(`Location detected: ${c.n} 🎯`,'🎯'); });
  on('btnTheme', ()=>{
    const cur = document.documentElement.dataset.theme;
    settings.theme.mode = cur==='dark'?'light':'dark'; saveSettings(); applySettings();
  });
  const goDesk = bindSearch($('#searchInput'));
  bindVoice('btnMic', $('#searchInput'), goDesk);
  bindVoice('btnMicM', $('#searchInputM'), goDesk);
  on('btnSearch', ()=>{ const si=$('#searchInput'); const q=si?si.value.trim():''; if(q) goDesk(q); });
  const sim = $('#searchInputM');
  if(sim) sim.addEventListener('keydown', e=>{ if(e.key==='Enter'&&e.target.value.trim()) goDesk(e.target.value.trim()); });
  on('btnExport', exportData);
  on('btnImport', ()=>{ const f=$('#importFile'); if(f) f.click(); });
  on('btnResetCustom', resetAll);
  const imp = $('#importFile');
  if(imp) imp.onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ try{
      const d = JSON.parse(rd.result);
      if(d.settings){ settings = Object.assign({}, DEFAULT_SETTINGS, d.settings); saveSettings(); }
      if(d.extraProducts){ extraProducts=d.extraProducts; LS.set('aw_products_extra_v1',extraProducts); }
      if(d.deletedIds){ deletedIds=d.deletedIds; LS.set('aw_products_deleted_v1',deletedIds); }
      if(d.editedProducts){ editedProducts=d.editedProducts; LS.set('aw_products_edited_v1',editedProducts); }
      if(d.addrs){ addrs=d.addrs; saveAddrs(); }
      if(d.customBanners){ customBanners=d.customBanners; saveBanners(); }
      if(d.loyalty){ loyalty=Object.assign({pts:0,hist:[],updatedAt:0},d.loyalty); saveLoyalty(); }
      if(d.subs){ subs=d.subs; saveSubs(); }
      renderAll(); renderCustomizer('store'); toast('Backup restored!','💾');
    }catch{ toast('Invalid backup file','⚠️'); } };
    rd.readAsText(f); e.target.value='';
  };
  $$('.modal-wrap').forEach(m=>m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('show'); }));
  setTimeout(()=>toast(`Welcome to ${settings.storeName} ${settings.storeName2}! 🎉`,'👋'), 600);
  if(!LS.get('aw_welcomed_v1', null)){
    setTimeout(()=>{
      notify(HI()?'नमस्ते! 👋':'Welcome! 👋', HI()?'ऑर्डर अपडेट यहां मिलेंगे। पुश अलर्ट चालू करें।':'Order updates will land here. Turn on push alerts for live pings.', '👋');
      LS.set('aw_welcomed_v1', 1);
    }, 2500);
  }
});
