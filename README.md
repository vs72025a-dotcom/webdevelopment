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

**🎨 Fully customisable (no code)**
Hit the floating **Customize** button:
- **Store** — logo, name, tagline, announcement bar, hero badge/headline/CTAs
- **Theme** — light/dark/auto, 8 presets + custom pickers, 5 fonts, corner radius, card style
- **Homepage** — toggle 11 sections on/off
- **Commerce** — currency, delivery fee, free-delivery threshold, tax %, card badges
- **Products** — add / edit / delete any product (vertical, price, MRP, emoji, gradient…)
- **Data** — export/import full backup JSON, seed sample orders, one-click reset

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
js/data.js      → verticals, 70+ products, banners, coupons, cities
js/app.js       → state, rendering, cart, checkout, tracking, customizer
```

## 🧪 Try this

1. Search "pizza" → open quick-view → post a review → add to cart
2. Apply `WELCOME20` in the cart → checkout → track the live order
3. Open **🎨 Customize** → switch to dark + Violet theme, rename the store, hide sections
4. **Products tab** → add your own product with your own emoji/pricing
5. **Data tab** → export backup, reset, re-import
