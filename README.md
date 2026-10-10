# 🌍 AnyWhere Anything — Super-App Store

One website for **everything, delivered anywhere**: Food 🍔 • Grocery 🥦 • Fashion 👗 • Electronics 🎧 • Pharmacy 💊 • Home 🏠 • Beauty 💄 • Services 🧹

A complete, **fully customisable** storefront + commerce engine in pure HTML/CSS/JS — no build step, no dependencies.

## ✨ Features

**🛍️ Multi-vertical marketplace**
- 8 verticals, 70+ seeded products, curated collections, flash deals with live countdown
- Explore page with category / price / rating / veg filters + 5 sort modes
- Live search with instant suggestions, recently-viewed shelf

**🛒 Full commerce loop**
- Cart drawer with free-delivery progress bar, coupons (`WELCOME20`, `FREEDEL`, `FOOD50`, `FRESH100`, `TECH10`, `GLOW20`)
- Wishlist, product quick-view with ratings + reviews, multi-step checkout (address → payment → success)
- Orders with **live tracking timeline**, reorder, demo auto-advancing statuses

**📍 Anywhere delivery** — city/pincode picker, mock geo-detect, per-product ETAs

**🖼️ Real product photos** — paste an image URL or upload from your device (auto-compressed, saved in-browser) per product + custom store logo

**💼 Seller Central** — revenue/orders/ratings stats, 7-day sales chart, order manager, top-products inventory, payouts (side menu → Seller Central)

**🌐 English + Hindi mode** — one-tap EN/हिं toggle in the header, full UI translation

**⚡ UPI payments** — GPay/PhonePe/Paytm/BHIM picker, UPI-ID verification, scan-and-pay QR, approval simulation at checkout

**🔔 Notifications + push** — bell center for order/return updates + optional browser push alerts (Notification API)

**📍 Address book** — save Home/Work/Other addresses in your account, one-tap select at checkout

**↩ Returns & refunds** — reason picker on delivered orders, 4-stage refund tracking (Requested → Approved → Picked up → Refunded) back to the payment method

**🗺️ Live rider map** — animated tracker map in every order: moving rider, store→home route, ETA chip, rider card

**🕐 Delivery slots** — ASAP or scheduled food windows, 3-day service-visit booking, Standard vs Express (+fee) shipping for the rest

**⭐ Rider ratings** — 5-star + tags for every delivered order; rider averages surface on tracking

**🎁 Gifting** — gift wrap + occasion + message + price-hiding, saved per order and shown on tracking

**☁️ Firebase cloud sync** — optional real backend: connect a free Realtime Database URL and orders/products/settings sync across devices (see below)

**🎯 Promo banner manager** — add/edit/delete homepage banners (emoji, gradient, coupon, target category); banner clicks deep-link + auto-apply coupons (Customize → Promos)

**🎙️ Voice search** — mic button in the header (Chrome/Edge): speak to search, auto-navigates on matches

**💳 Razorpay payments** — paste a Razorpay Key ID (Customize → Commerce) and a real Razorpay checkout option appears alongside UPI/cards/COD; hidden when no key is set

**📅 Order calendar** — My Orders has List + Calendar views: placed/delivery/service dates as dots, click any day for that day's orders

**⏰ Scheduled delivery + reminders** — food & grocery carts can check out for a later day/time window; scheduled orders hold status with a live countdown chip and fire a reminder as the window nears

**⭐ Loyalty wallet** — earn 1 pt per ₹10 on every order, redeem points (1 pt = ₹1) at checkout, full history in the side-menu wallet; balance syncs via Firebase

**📦 Split checkout** — send one cart to multiple saved addresses in a single checkout: per-item address picker, linked multi-shipment orders with proportional coupons and one delivery fee

**🔁 Grocery subscriptions** — subscribe to any grocery product (weekly / 2-weekly / monthly) with 5% off; auto-orders on schedule with loyalty earn, pause/skip/cancel manager, renewal dots on the calendar

**🎁 Refer & Earn** — every wallet has a referral code: share it, and applied codes grant +50 pts to both sides, booked in loyalty history

**📦 Split-shipment tracking** — tracking any split parcel shows all sibling shipments with per-city status and one-tap jump between them

**📦 Essentials boxes** — 4 curated grocery boxes (Breakfast, Monthly Staples, Fresh Weekly, Snack Attack): one-tap subscribe, multi-item auto-orders with 5% off, box renewal events on the calendar

**🏆 Referral leaderboard** — live ranked board in the wallet with medals, your rank, and a demo join button to watch yourself climb

**📸 Delivery-photo proof** — delivered orders auto-attach a rider snapshot (generated + timestamped); recipients can view it on tracking/cards, retake, or upload their own photo

**🛠️ Custom box builder** — build your own subscription box from any groceries: steppers, custom name, frequency; multi-item auto-orders with 5% off like curated boxes

**🎁 Subscription gifting** — gift any subscription with a recipient, message, and scheduled start (tomorrow → 30 days); first delivery arrives as the gift with your message

**💰 Rider tips** — tip delivered orders from tracking (₹10–100 presets or custom); per-rider totals, one-tap once-only, 💰 chip on order cards

**🎁 Gift-wrapped first deliveries** — gifted subscriptions can add gift wrap (+fee) with an occasion; the first delivery arrives wrapped with your message

**🏆 Rider tip leaderboard** — live top-5 board in tracking: demo legends merged with your real tips, your rider highlighted

**🔄 Smart reorder shelf** — home section that notices food/grocery you haven't ordered in a while ("running low!"), sorted by need, one-tap add; toggleable in Customize → Homepage

**🎨 Fully customisable (no code)**
Hit the floating **Customize** button:
- **Store** — logo, name, tagline, announcement bar, hero badge/headline/CTAs
- **Theme** — light/dark/auto, 8 presets + custom pickers, 5 fonts, corner radius, card style
- **Homepage** — toggle 11 sections on/off
- **Commerce** — currency, delivery fee, free-delivery threshold, tax %, card badges, Razorpay key
- **Promos** — homepage banner manager with live preview
- **Products** — add / edit / delete any product (vertical, price, MRP, emoji, gradient…)
- **Data** — export/import full backup JSON, seed sample orders, one-click reset, Firebase cloud sync

Everything persists in `localStorage`. Fully responsive with a mobile bottom-nav + side menu.

## 🚀 Run

No install needed — just serve the folder:

```bash
cd webdevelopment
python3 -m http.server 8000
# open http://localhost:8000
```

Or open `index.html` directly in a browser (all features work offline except Google Fonts).

## 🗂️ Structure

```
index.html      → app shell, drawers, modals
styles.css      → design system (CSS variables drive the customizer)
js/data.js      → verticals, 70+ products, banners, coupons, cities, EN+HI strings
js/app.js       → state, rendering, cart, checkout, tracking, customizer
js/cloud.js     → Firebase Realtime Database sync layer (offline-first)
```

## 🧪 Try this

1. Search "pizza" → open quick-view → post a review → add to cart
2. Cart → 🎁 gift-wrap it → checkout → pick a slot → pay with UPI → track the rider on the map
3. After delivery → ⭐ rate your rider, or ↩ request a return
4. Open **🎨 Customize** → switch to dark + Violet theme, rename the store, hide sections
5. **Products tab** → add your own product with your own photo/pricing
6. **Data tab** → export backup, reset, re-import — or connect Firebase below

## ☁️ Firebase setup (5 minutes, free)

The app works fully offline, but you can attach a real cloud backend:

1. Go to [Firebase Console](https://console.firebase.google.com) → Add project (any name, analytics off is fine)
2. **Build → Realtime Database** → Create database → choose region → start in **test mode**
3. Copy the database URL — looks like `https://your-app-default-rtdb.firebaseio.com`
4. In the app: **🎨 Customize → Data → Cloud sync** → paste the URL → **Connect**
5. Done! Orders, products, settings & addresses now sync across every device with the same URL (auto-poll every 30s + instant push on changes). Seller Central on your laptop will live-update with orders placed on your phone.

> Test mode allows open read/write for 30 days — fine for demos. For production, set proper `.read`/`.write` rules in Firebase.
