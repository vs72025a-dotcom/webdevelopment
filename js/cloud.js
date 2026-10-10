/* ============================================================
   AnyWhere Anything — Cloud Sync (Firebase Realtime Database)
   The app works 100% offline. Paste a Firebase RTDB URL in
   Customize → Data → Cloud sync to sync orders, products,
   settings & addresses across devices (see README for setup).
   ============================================================ */
const Cloud = {
  cfg: null,
  ensure(){
    if(!this.cfg){
      try{ this.cfg = LS.get('aw_cloud_v1', { url:'', lastSync:0 }); }
      catch{ this.cfg = { url:'', lastSync:0 }; }
    }
    return this.cfg;
  },
  get on(){ const c = this.ensure(); return !!(c && c.url); },
  base(){ return String(this.ensure().url || '').replace(/\/+$/, ''); },
  key(k){ return `${this.base()}/aw_store_main/${k}.json`; },
  save(){ try{ LS.set('aw_cloud_v1', this.ensure()); }catch{} },

  /* Validate URL shape, then ping the database */
  async test(url){
    try{
      const clean = String(url || '').trim().replace(/\/+$/, '');
      if(!/^https:\/\/[a-z0-9-]+\.firebaseio\.com$/i.test(clean) &&
         !/^https:\/\/[a-z0-9-]+\.firebasedatabase\.app$/i.test(clean)) return 'badurl';
      const c = new AbortController();
      const to = setTimeout(()=>c.abort(), 9000);
      const r = await fetch(clean + '/.json?shallow=true', { signal:c.signal });
      clearTimeout(to);
      return r.ok ? 'ok' : 'denied';
    }catch{ return 'fail'; }
  },
  async pull(k){
    const r = await fetch(this.key(k));
    if(!r.ok) throw new Error('pull-failed');
    return r.json();
  },
  async push(k, data){
    await fetch(this.key(k), {
      method:'PUT', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ updatedAt: Date.now(), data }),
    });
  },

  /* Debounced upload — call after any local change */
  _t: null,
  up(){
    if(!this.on) return;
    clearTimeout(this._t);
    this._t = setTimeout(()=>{ this.syncUp().catch(()=>{}); }, 1500);
  },
  collect(){
    return {
      orders, extraProducts, deletedIds, editedProducts, addrs,
      loyalty: (typeof loyalty !== 'undefined') ? loyalty : { pts:0, hist:[], updatedAt:0 },
      subs: (typeof subs !== 'undefined') ? subs : [],
      pilots: (typeof pilots !== 'undefined') ? pilots : [],
      settings: Object.assign({}, settings, { updatedAt: Date.now() }),
    };
  },
  async syncUp(){
    if(!this.on) return;
    const all = this.collect();
    for(const k of Object.keys(all)) await this.push(k, all[k]);
    this.ensure().lastSync = Date.now(); this.save();
  },

  /* ---- Merge helpers (never delete local data) ---- */
  applyOrders(arr){
    if(!Array.isArray(arr)) return false;
    const mine = new Map(orders.map(o=>[o.id, o]));
    let changed = false, fresh = 0;
    arr.forEach(c=>{
      if(!c || !c.id) return;
      const m = mine.get(c.id);
      if(!m){ orders.push(c); changed = true; fresh++; return; }
      if((c.status||0) > (m.status||0)){ m.status = c.status; changed = true; }
      if(c.return && (!m.return || (c.return.status||0) > (m.return.status||0))){ m.return = c.return; changed = true; }
      if(c.rating && !m.rating){ m.rating = c.rating; changed = true; }
      if(c.proof && !m.proof){ m.proof = c.proof; changed = true; }
    });
    if(changed){
      saveOrders();
      if(fresh) notify(HI()?'☁️ क्लाउड से नया ऑर्डर':'☁️ New order from cloud', `${fresh} order(s) synced`, '☁️');
    }
    return changed;
  },
  applyProducts(pack){
    pack = pack || {};
    let changed = false;
    const del = new Set([...(deletedIds||[]), ...((pack.deleted)||[])]);
    if(del.size !== (deletedIds||[]).length){ deletedIds = [...del]; LS.set('aw_products_deleted_v1', deletedIds); changed = true; }
    const have = new Set(extraProducts.map(p=>p.id));
    (pack.extra||[]).forEach(p=>{ if(p && p.id && !have.has(p.id) && !del.has(p.id)){ extraProducts.push(p); changed = true; } });
    Object.entries(pack.edited||{}).forEach(([id,p])=>{ if(!editedProducts[id] && !del.has(id)){ editedProducts[id]=p; changed = true; } });
    if(changed){ LS.set('aw_products_extra_v1', extraProducts); LS.set('aw_products_edited_v1', editedProducts); }
    return changed;
  },
  applyAddrs(arr){
    if(!Array.isArray(arr)) return false;
    const have = new Set(addrs.map(a=>a.id));
    let changed = false;
    arr.forEach(a=>{ if(a && a.id && !have.has(a.id)){ addrs.push(a); changed = true; } });
    if(changed) saveAddrs();
    return changed;
  },
  applyLoyalty(c){
    if(!c || typeof c !== 'object' || typeof loyalty === 'undefined') return false;
    if((c.updatedAt||0) <= (loyalty.updatedAt||0)) return false;
    loyalty = { pts:c.pts||0, hist:Array.isArray(c.hist)?c.hist:[], updatedAt:c.updatedAt||0 };
    try{ LS.set('aw_loyal_v1', loyalty); }catch{}
    return true;
  },
  applySubs(arr){
    if(!Array.isArray(arr) || typeof subs === 'undefined') return false;
    const mine = new Map(subs.map(x=>[x.id, x]));
    let changed = false;
    arr.forEach(c=>{
      if(!c || !c.id) return;
      const m = mine.get(c.id);
      if(!m){ subs.push(c); changed = true; return; }
      if(c.active === false && m.active !== false){ m.active = false; changed = true; }
      if((c.nextTs||0) > (m.nextTs||0)){ m.nextTs = c.nextTs; changed = true; }
    });
    if(changed){ try{ LS.set('aw_subs_v1', subs); }catch{} }
    return changed;
  },
  applyPilots(arr){
    if(!Array.isArray(arr) || typeof pilots === 'undefined') return false;
    const mine = new Map(pilots.map(x=>[x.id, x]));
    let changed = false;
    arr.forEach(c=>{
      if(!c || !c.id) return;
      const m = mine.get(c.id);
      if(!m){ pilots.push(c); changed = true; return; }
      if(c.active === false && m.active !== false){ m.active = false; changed = true; }
      if((c.nextTs||0) > (m.nextTs||0)){ m.nextTs = c.nextTs; changed = true; }
    });
    if(changed){ try{ LS.set('aw_pilot_v1', pilots); }catch{} }
    return changed;
  },
  async syncDown(forceSettings){
    if(!this.on) return false;
    const get = async k => { try{ const r = await this.pull(k); return r ? r.data : null; }catch{ return null; } };
    const [cOrders, cExtra, cEdited, cDeleted, cAddrs, cSettings, cLoyalty, cSubs, cPilots] = await Promise.all([
      get('orders'), get('extraProducts'), get('editedProducts'), get('deletedIds'), get('addrs'), get('settings'), get('loyalty'), get('subs'), get('pilots'),
    ]);
    let changed = false;
    if(this.applyOrders(cOrders)) changed = true;
    if(this.applyProducts({ extra:cExtra, edited:cEdited, deleted:cDeleted })) changed = true;
    if(this.applyAddrs(cAddrs)) changed = true;
    if(this.applyLoyalty(cLoyalty)) changed = true;
    if(this.applySubs(cSubs)) changed = true;
    if(this.applyPilots(cPilots)) changed = true;
    if(forceSettings && cSettings && (cSettings.updatedAt||0) > (this.ensure().lastSync||0)){
      settings = Object.assign({}, DEFAULT_SETTINGS, cSettings);
      saveSettings(); changed = true;
    }
    const cloudIds = new Set((cOrders||[]).map(o=>o.id));
    if(orders.some(o=>!cloudIds.has(o.id))) this.up();
    this.ensure().lastSync = Date.now(); this.save();
    return changed;
  },
  startPoll(){
    setInterval(async ()=>{
      if(!this.on) return;
      try{
        const ch = await this.syncDown(false);
        if(ch){ renderPage(); updateBadges(); }
      }catch{}
    }, 30000);
  },
};
