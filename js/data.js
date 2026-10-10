/* ============================================================
   AnyWhere Anything — Seed Data
   ============================================================ */
const VERTICALS = [
  { id:'food',        name:'Food',        hn:'खाना',          emoji:'🍔', grad:'g1', tag:'30-min delivery' },
  { id:'grocery',     name:'Grocery',     hn:'किराना',         emoji:'🥦', grad:'g2', tag:'Farm fresh' },
  { id:'fashion',     name:'Fashion',     hn:'फैशन',          emoji:'👗', grad:'g4', tag:'Top brands' },
  { id:'electronics', name:'Electronics', hn:'इलेक्ट्रॉनिक्स', emoji:'🎧', grad:'g3', tag:'Genuine + warranty' },
  { id:'pharmacy',    name:'Pharmacy',    hn:'फार्मेसी',        emoji:'💊', grad:'g7', tag:'100% genuine' },
  { id:'home',        name:'Home & Kitchen', hn:'घर',          emoji:'🏠', grad:'g6', tag:'Everything home' },
  { id:'beauty',      name:'Beauty',      hn:'ब्यूटी',         emoji:'💄', grad:'g8', tag:'Glow up' },
  { id:'services',    name:'Services',    hn:'सेवाएं',         emoji:'🧹', grad:'g5', tag:'At your doorstep' },
];

const CATEGORIES = {
  food:['Pizza','Biryani','Burgers','Chinese','Desserts','South Indian','North Indian','Beverages'],
  grocery:['Fruits','Vegetables','Dairy','Snacks','Staples','Beverages','Frozen','Baby Care'],
  fashion:['Men','Women','Kids','Footwear','Watches','Bags','Accessories'],
  electronics:['Audio','Mobiles','Laptops','Wearables','Cameras','Home Appliances','Gaming'],
  pharmacy:['Ayurveda','Vitamins','Personal Care','Devices','Baby & Mother','First Aid'],
  home:['Kitchen','Decor','Furniture','Cleaning','Storage','Lighting'],
  beauty:['Skincare','Haircare','Makeup','Fragrance','Bath & Body','Men Grooming'],
  services:['Cleaning','Repair','Salon','Plumbing','Electrician','Painting'],
};

/* id, n=name, v=vertical, c=category, p=price, m=mrp, r=rating, rc=count, e=emoji, g=gradient, d=desc, veg, badge, t=time, s=store, u=unit */
const SEED_PRODUCTS = [
/* ---------------- FOOD ---------------- */
{id:'f1',n:'Farmhouse Veggie Pizza (Medium)',v:'food',c:'Pizza',p:299,m:449,r:4.5,rc:2314,e:'🍕',g:'g1',d:'Loaded garden veggies, extra mozzarella, signature tomato sauce on a hand-tossed crust.',veg:true,badge:'Bestseller',t:'30 min',s:"Tony's Pizzeria",u:'Medium 10"'},
{id:'f2',n:'Chicken Dum Biryani + Raita',v:'food',c:'Biryani',p:249,m:349,r:4.7,rc:5120,e:'🍛',g:'g6',d:'Slow-cooked seeraga samba rice layered with juicy chicken, served with raita & brinjal curry.',veg:false,badge:'Must Try',t:'35 min',s:'Dum House',u:'Serves 1-2'},
{id:'f3',n:'Double Cheese Smash Burger',v:'food',c:'Burgers',p:179,m:249,r:4.4,rc:1876,e:'🍔',g:'g6',d:'Two crispy veg patties, double cheese, chipotle mayo in a toasted brioche bun.',veg:true,t:'25 min',s:'Burger Barn',u:'1 pc'},
{id:'f4',n:'Hakka Noodles + Manchurian Combo',v:'food',c:'Chinese',p:199,m:299,r:4.3,rc:1204,e:'🍜',g:'g1',d:'Wok-tossed hakka noodles with veg manchurian balls in garlic-soy glaze.',veg:true,t:'30 min',s:'Dragon Wok',u:'Combo'},
{id:'f5',n:'Molten Choco Lava Cake (2 pc)',v:'food',c:'Desserts',p:149,m:199,r:4.8,rc:3411,e:'🍩',g:'g4',d:'Warm gooey-centre chocolate lava cakes. Pure indulgence, baked fresh on order.',veg:true,badge:'Trending',t:'25 min',s:'Sugar Rush',u:'Pack of 2'},
{id:'f6',n:'Masala Dosa Family Pack',v:'food',c:'South Indian',p:229,m:299,r:4.6,rc:2087,e:'🥞',g:'g6',d:'3 crispy ghee masala dosas with sambar, coconut & tomato chutneys.',veg:true,t:'30 min',s:'Madurai Meals',u:'Pack of 3'},
{id:'f7',n:'Butter Chicken + Naan (2 pc)',v:'food',c:'North Indian',p:289,m:399,r:4.7,rc:4022,e:'🍗',g:'g1',d:'Creamy tomato-butter chicken with charred tandoori naan. Rich & smoky.',veg:false,badge:'Bestseller',t:'35 min',s:'Punjabi Tadka',u:'Combo'},
{id:'f8',n:'Cold Coffee Frappe (Large)',v:'food',c:'Beverages',p:129,m:179,r:4.4,rc:987,e:'🥤',g:'g7',d:'Double-shot espresso blended thick with vanilla ice cream & cocoa dust.',veg:true,t:'20 min',s:'Brew Bar',u:'450 ml'},
{id:'f9',n:'Paneer Tikka Sub + Fries',v:'food',c:'Burgers',p:189,m:259,r:4.2,rc:764,e:'🥪',g:'g2',d:'Smoky paneer tikka stuffed sub with mint mayo + peri-peri fries.',veg:true,t:'25 min',s:'Sub Station',u:'Combo'},
{id:'f10',n:'Sushi Platter (12 pc)',v:'food',c:'Chinese',p:549,m:799,r:4.6,rc:432,e:'🍣',g:'g3',d:'California rolls, veg maki & nigiri with soy, wasabi & pickled ginger.',veg:false,badge:'Premium',t:'40 min',s:'Tokyo Table',u:'12 pc'},
{id:'f11',n:'Gulab Jamun Cheesecake Slice',v:'food',c:'Desserts',p:159,m:219,r:4.7,rc:1102,e:'🍰',g:'g4',d:'Fusion cheesecake topped with mini gulab jamuns & pistachio dust.',veg:true,t:'25 min',s:'Sugar Rush',u:'1 slice'},
{id:'f12',n:'Idli Sambar + Filter Coffee',v:'food',c:'South Indian',p:99,m:149,r:4.5,rc:1560,e:'☕',g:'g6',d:'Cloud-soft idlis with hot sambar + authentic degree filter coffee.',veg:true,t:'20 min',s:'Madurai Meals',u:'Combo'},
/* ---------------- GROCERY ---------------- */
{id:'g1',n:'Fresh Alphonso Mangoes (1 kg)',v:'grocery',c:'Fruits',p:349,m:499,r:4.6,rc:876,e:'🥭',g:'g1',d:'Ratnagiri alphonsos, naturally ripened. Sweet, aromatic, fibreless.',veg:true,badge:'Seasonal',t:'2 hrs',s:'Fresh Farm',u:'1 kg'},
{id:'g2',n:'Organic Vegetable Basket (3 kg)',v:'grocery',c:'Vegetables',p:299,m:420,r:4.4,rc:1230,e:'🥦',g:'g2',d:'Seasonal farm veggies: tomato, onion, potato, carrot, beans, greens & more.',veg:true,t:'2 hrs',s:'Fresh Farm',u:'3 kg'},
{id:'g3',n:'A2 Desi Cow Milk (1 L)',v:'grocery',c:'Dairy',p:85,m:99,r:4.7,rc:3410,e:'🥛',g:'g7',d:'Farm-fresh A2 milk, pasteurised & chilled. Delivered within hours of milking.',veg:true,t:'Morning',s:'Dairy Pure',u:'1 L'},
{id:'g4',n:'Farm Eggs Protein Pack (12 pc)',v:'grocery',c:'Dairy',p:110,m:140,r:4.5,rc:2210,e:'🥚',g:'g1',d:'Protein-rich brown eggs from free-range hens. Crack-checked & hygienic.',veg:false,t:'2 hrs',s:'Dairy Pure',u:'12 pc'},
{id:'g5',n:'Whole Wheat Atta (5 kg)',v:'grocery',c:'Staples',p:265,m:320,r:4.5,rc:1870,e:'🌾',g:'g6',d:'100% MP sharbati wheat, stone-ground. Soft rotis every time.',veg:true,t:'2 hrs',s:'Daily Needs',u:'5 kg'},
{id:'g6',n:'Basmati Rice Premium (5 kg)',v:'grocery',c:'Staples',p:649,m:850,r:4.6,rc:990,e:'🍚',g:'g1',d:'Extra-long grain aged basmati. Aromatic, non-sticky, biryani-perfect.',veg:true,badge:'Bestseller',t:'2 hrs',s:'Daily Needs',u:'5 kg'},
{id:'g7',n:'Mixed Dry Fruits (500 g)',v:'grocery',c:'Snacks',p:499,m:699,r:4.7,rc:760,e:'🥜',g:'g6',d:'Almonds, cashews, raisins, pista & walnuts. Premium handpicked mix.',veg:true,t:'2 hrs',s:'Nutty Yours',u:'500 g'},
{id:'g8',n:'Masala Chips Party Pack (10)',v:'grocery',c:'Snacks',p:199,m:250,r:4.3,rc:1540,e:'🍟',g:'g1',d:'10 tangy masala chip pouches. Party-ready crunch.',veg:true,t:'2 hrs',s:'Snack Street',u:'10 pack'},
{id:'g9',n:'Cold-Pressed Coconut Oil (1 L)',v:'grocery',c:'Staples',p:429,m:549,r:4.8,rc:640,e:'🥥',g:'g2',d:'Single-origin coconuts, wood-pressed. For cooking, hair & skin.',veg:true,t:'2 hrs',s:'Daily Needs',u:'1 L'},
{id:'g10',n:'Greek Yogurt Cups (4 × 100 g)',v:'grocery',c:'Dairy',p:180,m:220,r:4.4,rc:520,e:'🍦',g:'g7',d:'Thick high-protein greek yogurt in mango, berry, vanilla & plain.',veg:true,t:'2 hrs',s:'Dairy Pure',u:'4 pack'},
{id:'g11',n:'Frozen Green Peas (1 kg)',v:'grocery',c:'Frozen',p:140,m:180,r:4.2,rc:410,e:'🫛',g:'g2',d:'Farm-frozen sweet peas. Ready-to-cook, no preservatives.',veg:true,t:'2 hrs',s:'Frosty',u:'1 kg'},
{id:'g12',n:'Baby Diapers Newborn (58 pc)',v:'grocery',c:'Baby Care',p:599,m:799,r:4.6,rc:890,e:'👶',g:'g8',d:'12-hr dryness, rash-guard, ultra-soft newborn diapers.',veg:true,t:'2 hrs',s:'Baby Bliss',u:'58 pc'},
/* ---------------- FASHION ---------------- */
{id:'a1',n:'Men Slim-Fit Denim Jacket',v:'fashion',c:'Men',p:1499,m:2999,r:4.5,rc:640,e:'🧥',g:'g3',d:'Mid-wash stretch denim, all-season layering essential. Sizes S–XXL.',t:'2 days',s:'Urban Thread',u:'1 pc'},
{id:'a2',n:'Women Floral Summer Dress',v:'fashion',c:'Women',p:1099,m:2199,r:4.6,rc:920,e:'👗',g:'g4',d:'Breezy rayon midi with pockets. Sizes XS–XL.',t:'2 days',s:'Velvet Vogue',u:'1 pc',badge:'Trending'},
{id:'a3',n:'Kids Dino Hoodie (4–10 yrs)',v:'fashion',c:'Kids',p:649,m:1299,r:4.7,rc:510,e:'🧸',g:'g1',d:'Super-soft fleece hoodie with glow-in-dark dino print.',t:'2 days',s:'Tiny Toes',u:'1 pc'},
{id:'a4',n:'Running Sports Shoes',v:'fashion',c:'Footwear',p:1899,m:3499,r:4.4,rc:1730,e:'👟',g:'g7',d:'Lightweight breathable knit, anti-skid sole. UK 6–11.',t:'3 days',s:'StrideX',u:'1 pair',badge:'Bestseller'},
{id:'a5',n:'Minimal Steel Watch',v:'fashion',c:'Watches',p:2499,m:4999,r:4.8,rc:430,e:'⌚',g:'g5',d:'Sapphire-coated dial, 5ATM, genuine leather strap. 2-yr warranty.',t:'3 days',s:'TimeCraft',u:'1 pc'},
{id:'a6',n:'Leather Office Backpack',v:'fashion',c:'Bags',p:1799,m:3599,r:4.5,rc:380,e:'🎒',g:'g6',d:'Vegan leather, 15.6" laptop sleeve, USB port, anti-theft pocket.',t:'2 days',s:'Urban Thread',u:'1 pc'},
{id:'a7',n:'Aviator Sunglasses',v:'fashion',c:'Accessories',p:899,m:1999,r:4.3,rc:720,e:'🕶️',g:'g1',d:'Polarised UV400 gold-frame aviators with hard case.',t:'2 days',s:'Shade House',u:'1 pc'},
{id:'a8',n:'Cotton Oversized T-Shirt',v:'fashion',c:'Men',p:499,m:999,r:4.4,rc:2140,e:'👕',g:'g2',d:'240 GSM bio-washed cotton, drop shoulders. 6 colours.',t:'2 days',s:'Urban Thread',u:'1 pc'},
{id:'a9',n:'Block-Heel Sandals',v:'fashion',c:'Footwear',p:1299,m:2599,r:4.5,rc:560,e:'👠',g:'g4',d:'Cushioned 2" block heels, all-day comfort. UK 3–8.',t:'3 days',s:'Velvet Vogue',u:'1 pair'},
{id:'a10',n:'Silk Saree with Blouse',v:'fashion',c:'Women',p:2999,m:5999,r:4.9,rc:310,e:'🥻',g:'g8',d:'Handloom soft silk with zari border + unstitched blouse.',t:'4 days',s:'Velvet Vogue',u:'1 pc',badge:'Premium'},
/* ---------------- ELECTRONICS ---------------- */
{id:'e1',n:'Noise-Cancelling Headphones',v:'electronics',c:'Audio',p:4999,m:9999,r:4.7,rc:2310,e:'🎧',g:'g3',d:'40h battery, ENC mic, Bluetooth 5.4, foldable. 1-yr warranty.',t:'2 days',s:'VoltEdge',u:'1 pc',badge:'Bestseller'},
{id:'e2',n:'True Wireless Earbuds Pro',v:'electronics',c:'Audio',p:2499,m:5999,r:4.5,rc:4120,e:'🎵',g:'g5',d:'13mm drivers, 45ms low-latency gaming mode, 50h case battery.',t:'2 days',s:'VoltEdge',u:'1 pc'},
{id:'e3',n:'Smartphone 5G (8+128 GB)',v:'electronics',c:'Mobiles',p:18999,m:24999,r:4.6,rc:1890,e:'📱',g:'g7',d:'120Hz AMOLED, 50MP OIS camera, 5000mAh, 67W fast charge.',t:'2 days',s:'VoltEdge',u:'1 pc',badge:'Trending'},
{id:'e4',n:'Ultrabook Laptop 14" (16/512)',v:'electronics',c:'Laptops',p:58990,m:74990,r:4.8,rc:640,e:'💻',g:'g3',d:'Latest-gen chip, 1.2kg metal body, backlit KB, 18h battery.',t:'3 days',s:'VoltEdge',u:'1 pc'},
{id:'e5',n:'Smartwatch AMOLED + BT Call',v:'electronics',c:'Wearables',p:2999,m:7999,r:4.4,rc:2760,e:'⌚',g:'g5',d:'1.85" AMOLED, SpO2, 100+ sport modes, 10-day battery.',t:'2 days',s:'VoltEdge',u:'1 pc'},
{id:'e6',n:'Mirrorless Camera 24MP',v:'electronics',c:'Cameras',p:52990,m:64990,r:4.9,rc:210,e:'📷',g:'g6',d:'24MP sensor, 4K60 video, kit lens 15-45mm, Wi-Fi transfer.',t:'4 days',s:'PixelPro',u:'1 pc',badge:'Premium'},
{id:'e7',n:'Air Fryer 5L Digital',v:'electronics',c:'Home Appliances',p:5999,m:9999,r:4.5,rc:1120,e:'🍳',g:'g6',d:'8 presets, 360° rapid air, dishwasher-safe basket, 2-yr warranty.',t:'2 days',s:'HomeVolt',u:'1 pc'},
{id:'e8',n:'Mechanical RGB Keyboard',v:'electronics',c:'Gaming',p:3499,m:5999,r:4.6,rc:890,e:'⌨️',g:'g5',d:'Hot-swap switches, PBT keycaps, tri-mode connect.',t:'2 days',s:'GameZone',u:'1 pc'},
{id:'e9',n:'Portable Bluetooth Speaker',v:'electronics',c:'Audio',p:1999,m:3999,r:4.5,rc:1540,e:'🔊',g:'g7',d:'30W stereo, IPX7, 24h playtime, TWS pairing.',t:'2 days',s:'VoltEdge',u:'1 pc'},
{id:'e10',n:'Robot Vacuum + Mop',v:'electronics',c:'Home Appliances',p:15999,m:24999,r:4.6,rc:470,e:'🤖',g:'g3',d:'LiDAR mapping, 4000Pa, app + voice control, auto-recharge.',t:'3 days',s:'HomeVolt',u:'1 pc'},
/* ---------------- PHARMACY ---------------- */
{id:'p1',n:'Vitamin C + Zinc (60 tabs)',v:'pharmacy',c:'Vitamins',p:349,m:499,r:4.6,rc:980,e:'🍊',g:'g1',d:'Daily immunity support. Vegetarian, lab-tested.',t:'Same day',s:'MediTrust',u:'60 tabs'},
{id:'p2',n:'Ashwagandha Capsules (90)',v:'pharmacy',c:'Ayurveda',p:449,m:649,r:4.5,rc:720,e:'🌿',g:'g2',d:'KSM-grade extract for stress, sleep & strength.',t:'Same day',s:'MediTrust',u:'90 caps'},
{id:'p3',n:'Digital Thermometer Flex',v:'pharmacy',c:'Devices',p:199,m:349,r:4.4,rc:610,e:'🌡️',g:'g7',d:'10-sec fast reading, waterproof tip, fever alarm.',t:'Same day',s:'MediTrust',u:'1 pc'},
{id:'p4',n:'BP Monitor Automatic',v:'pharmacy',c:'Devices',p:1899,m:2999,r:4.6,rc:430,e:'❤️‍🩹',g:'g3',d:'Clinically validated, one-touch, memory for 2 users.',t:'2 days',s:'MediTrust',u:'1 pc'},
{id:'p5',n:'Protein Powder Vanilla (1 kg)',v:'pharmacy',c:'Vitamins',p:1899,m:2499,r:4.5,rc:1340,e:'🥤',g:'g6',d:'24g protein/serving, 5.5g BCAA, no added sugar.',t:'Same day',s:'FitFuel',u:'1 kg',badge:'Bestseller'},
{id:'p6',n:'First-Aid Kit (120 pc)',v:'pharmacy',c:'First Aid',p:799,m:1299,r:4.7,rc:380,e:'🩹',g:'g4',d:'Complete home + travel kit in waterproof pouch.',t:'Same day',s:'MediTrust',u:'120 pc'},
{id:'p7',n:'Baby Lotion Gentle (400 ml)',v:'pharmacy',c:'Baby & Mother',p:329,m:429,r:4.8,rc:540,e:'🧴',g:'g8',d:'Paediatrician-tested, paraben-free, 24h moisture.',t:'Same day',s:'Baby Bliss',u:'400 ml'},
{id:'p8',n:'Hand Sanitizer 70% (5 L)',v:'pharmacy',c:'Personal Care',p:649,m:999,r:4.3,rc:290,e:'🧼',g:'g7',d:'WHO-formula gel, refill can for home & office.',t:'Same day',s:'MediTrust',u:'5 L'},
/* ---------------- HOME ---------------- */
{id:'h1',n:'Nonstick Cookware Set (5 pc)',v:'home',c:'Kitchen',p:2499,m:4999,r:4.6,rc:760,e:'🍳',g:'g6',d:'Granite-coated, induction-ready, cool-touch handles.',t:'2 days',s:'KitchenKing',u:'5 pc',badge:'Bestseller'},
{id:'h2',n:'Ceramic Planter Trio',v:'home',c:'Decor',p:899,m:1499,r:4.5,rc:420,e:'🪴',g:'g2',d:'Hand-glazed planters in 3 sizes + drainage trays.',t:'3 days',s:'Nest & Nook',u:'3 pc'},
{id:'h3',n:'Memory Foam Pillows (2)',v:'home',c:'Furniture',p:1199,m:2199,r:4.4,rc:880,e:'🛏️',g:'g7',d:'Ergonomic contour pillows with bamboo covers.',t:'2 days',s:'Nest & Nook',u:'2 pc'},
{id:'h4',n:'LED String Lights 20m',v:'home',c:'Lighting',p:499,m:999,r:4.5,rc:1130,e:'💡',g:'g1',d:'Warm-white copper wire, 8 modes, USB + battery.',t:'2 days',s:'GlowKart',u:'20 m'},
{id:'h5',n:'Vacuum Storage Bags (6)',v:'home',c:'Storage',p:649,m:1099,r:4.3,rc:540,e:'🧳',g:'g5',d:'Jumbo space-savers with pump. 80% more space.',t:'2 days',s:'Nest & Nook',u:'6 pc'},
{id:'h6',n:'Spin Mop + Bucket Set',v:'home',c:'Cleaning',p:1099,m:1999,r:4.4,rc:970,e:'🧽',g:'g7',d:'360° spin, 2 microfiber heads, splash-guard bucket.',t:'2 days',s:'KitchenKing',u:'1 set'},
{id:'h7',n:'Scented Candle Gift Set (4)',v:'home',c:'Decor',p:799,m:1399,r:4.7,rc:610,e:'🕯️',g:'g4',d:'Soy candles: vanilla, coffee, lavender & sandalwood.',t:'2 days',s:'GlowKart',u:'4 pc'},
{id:'h8',n:'Insulated Steel Bottle 1L',v:'home',c:'Kitchen',p:699,m:1299,r:4.6,rc:1420,e:'🍶',g:'g3',d:'24h hot / 24h cold, leakproof, matte finish.',t:'2 days',s:'KitchenKing',u:'1 L'},
/* ---------------- BEAUTY ---------------- */
{id:'b1',n:'Vitamin C Face Serum 30ml',v:'beauty',c:'Skincare',p:549,m:899,r:4.6,rc:1870,e:'✨',g:'g4',d:'15% ethylated Vit-C + hyaluronic acid. Glass skin in 4 weeks.',t:'2 days',s:'GlowLab',u:'30 ml',badge:'Trending'},
{id:'b2',n:'Matte Lipstick Set (6)',v:'beauty',c:'Makeup',p:799,m:1499,r:4.5,rc:940,e:'💄',g:'g4',d:'6 bestseller shades, 8-hr stay, vitamin-E enriched.',t:'2 days',s:'GlamBox',u:'6 pc'},
{id:'b3',n:'Argan Hair Oil 100ml',v:'beauty',c:'Haircare',p:449,m:699,r:4.7,rc:760,e:'💇',g:'g6',d:'Cold-pressed Moroccan argan. Frizz-free shine.',t:'2 days',s:'GlowLab',u:'100 ml'},
{id:'b4',n:'Eau De Parfum 100ml — Oud',v:'beauty',c:'Fragrance',p:1499,m:2499,r:4.8,rc:520,e:'🌸',g:'g8',d:'Long-lasting 8-10h oud + amber. Unisex luxury.',t:'3 days',s:'Maison Aroma',u:'100 ml',badge:'Premium'},
{id:'b5',n:'K-Beauty Sheet Mask (10)',v:'beauty',c:'Skincare',p:499,m:899,r:4.4,rc:1120,e:'🧖',g:'g8',d:'10 hydrating masks: aloe, snail, rice & green tea.',t:'2 days',s:'GlowLab',u:'10 pc'},
{id:'b6',n:'Beard Grooming Kit',v:'beauty',c:'Men Grooming',p:899,m:1599,r:4.5,rc:640,e:'🧔',g:'g6',d:'Oil, balm, wash, brush & comb in travel pouch.',t:'2 days',s:'Mane & Co',u:'5 pc'},
{id:'b7',n:'Body Butter Vanilla (200g)',v:'beauty',c:'Bath & Body',p:399,m:649,r:4.6,rc:480,e:'🧁',g:'g1',d:'Whipped shea butter, 48h moisture, non-greasy.',t:'2 days',s:'GlowLab',u:'200 g'},
{id:'b8',n:'Waterproof Kajal Duo',v:'beauty',c:'Makeup',p:299,m:499,r:4.3,rc:830,e:'👁️',g:'g5',d:'Smudge-proof 24h kajal + sharpener. Jet black.',t:'2 days',s:'GlamBox',u:'2 pc'},
/* ---------------- SERVICES ---------------- */
{id:'s1',n:'Full Home Deep Cleaning',v:'services',c:'Cleaning',p:2499,m:3999,r:4.7,rc:1150,e:'🧹',g:'g2',d:'3BHK deep clean: kitchen, bathrooms, sofa & carpet. 4 pros, 4 hrs.',t:'Slot',s:'FixIt Pro',u:'3 BHK'},
{id:'s2',n:'AC Service + Gas Check',v:'services',c:'Repair',p:799,m:1299,r:4.6,rc:890,e:'❄️',g:'g7',d:'Foam-jet clean, filter wash, cooling check. Split/window.',t:'Slot',s:'FixIt Pro',u:'1 AC'},
{id:'s3',n:'Salon at Home — Women',v:'services',c:'Salon',p:1299,m:2199,r:4.8,rc:2040,e:'💅',g:'g4',d:'Waxing + facial + mani-pedi combo by senior beautician.',t:'Slot',s:'GlamHome',u:'90 min',badge:'Bestseller'},
{id:'s4',n:'Plumber Visit + Repair',v:'services',c:'Plumbing',p:299,m:499,r:4.5,rc:670,e:'🔧',g:'g3',d:'Tap, flush & leakage repair. Upfront pricing, 30-day warranty.',t:'90 min',s:'FixIt Pro',u:'1 visit'},
{id:'s5',n:'Electrician Safety Check',v:'services',c:'Electrician',p:349,m:599,r:4.6,rc:540,e:'💡',g:'g1',d:'Full-home wiring audit + 5 minor fixes. Certified pros.',t:'90 min',s:'FixIt Pro',u:'1 visit'},
{id:'s6',n:'1BHK Painting (Asian)',v:'services',c:'Painting',p:14999,m:21999,r:4.7,rc:210,e:'🎨',g:'g8',d:'Premium emulsion, furniture masking, 2 coats, 1-day completion.',t:'Slot',s:'ColorCasa',u:'1 BHK'},
];

const BANNERS = [
  { e:'🍕', t:'50% OFF First Food Order', s:'Hot & fresh in 30 minutes', bg:'linear-gradient(135deg,#f97316,#dc2626)', code:'FOOD50' },
  { e:'🥬', t:'Farm-Fresh Groceries', s:'Flat ₹100 off above ₹499', bg:'linear-gradient(135deg,#16a34a,#065f46)', code:'FRESH100' },
  { e:'🎧', t:'Electronics Fest', s:'Up to 60% off + no-cost EMI', bg:'linear-gradient(135deg,#4f46e5,#7c3aed)', code:'TECH10' },
  { e:'💄', t:'Beauty Bonanza', s:'Min 40% off top brands', bg:'linear-gradient(135deg,#ec4899,#8b5cf6)', code:'GLOW20' },
];

const COUPONS = [
  { code:'WELCOME20', e:'🎉', t:'20% off everything', d:'Up to ₹200 off on orders above ₹499. New users.', type:'pct', val:20, cap:200, min:499 },
  { code:'FREEDEL', e:'🛵', t:'Free delivery', d:'Zero delivery fee on any order above ₹199.', type:'freedel', val:0, min:199 },
  { code:'FOOD50', e:'🍕', t:'50% off food', d:'Up to ₹150 off on food orders above ₹249.', type:'pct', val:50, cap:150, min:249, vert:'food' },
  { code:'FRESH100', e:'🥬', t:'₹100 off groceries', d:'Flat ₹100 off grocery orders above ₹499.', type:'flat', val:100, min:499, vert:'grocery' },
  { code:'TECH10', e:'🎧', t:'10% off electronics', d:'Up to ₹1500 off electronics above ₹4999.', type:'pct', val:10, cap:1500, min:4999, vert:'electronics' },
  { code:'GLOW20', e:'💄', t:'20% off beauty', d:'Up to ₹300 off beauty above ₹799.', type:'flat_pct', val:20, cap:300, min:799, vert:'beauty' },
];

const CITIES = [
  { n:'New York', pin:'10001', e:'🗽' }, { n:'Mumbai', pin:'400001', e:'🌉' },
  { n:'Delhi', pin:'110001', e:'🕌' }, { n:'Bengaluru', pin:'560001', e:'🌳' },
  { n:'Los Angeles', pin:'90001', e:'🌴' }, { n:'London', pin:'E1 6AN', e:'🎡' },
  { n:'Chennai', pin:'600001', e:'🏖️' }, { n:'Hyderabad', pin:'500001', e:'🍲' },
  { n:'Chicago', pin:'60601', e:'🌆' }, { n:'Dubai', pin:'00000', e:'🏙️' },
  { n:'Pune', pin:'411001', e:'⛰️' }, { n:'Kolkata', pin:'700001', e:'🚋' },
];

const REVIEWS = [
  { n:'Priya S.', r:5, t:'Super fresh and arrived earlier than promised. Packaging was excellent!' },
  { n:'Rahul M.', r:4, t:'Great quality for the price. Will definitely order again.' },
  { n:'Ananya K.', r:5, t:'Exactly as described. Delivery partner was polite and quick.' },
];

const TESTIMONIALS = [
  { n:'Sneha R.', c:'Mumbai', e:'👩', s:5, t:'Ordered biryani, groceries AND a birthday gift in one cart. This app replaced 4 apps on my phone!' },
  { n:'Arjun P.', c:'Bengaluru', e:'🧑', s:5, t:'AC repair booked at 9am, technician arrived by 11. Plus my headphones arrived the same evening. Insane.' },
  { n:'Kavya D.', c:'Delhi', e:'👩‍🦰', s:4, t:'Flash deals are genuinely good — got my air fryer 40% off. Delivery tracking is the smoothest I have used.' },
];

const THEME_PRESETS = [
  { n:'Tomato', p:'#e8433f', s:'#8b1e3f' }, { n:'Violet', p:'#7c3aed', s:'#4c1d95' },
  { n:'Ocean', p:'#0284c7', s:'#0c4a6e' }, { n:'Forest', p:'#16a34a', s:'#14532d' },
  { n:'Sunset', p:'#f97316', s:'#9a3412' }, { n:'Rose', p:'#e11d48', s:'#881337' },
  { n:'Dark Gold', p:'#b45309', s:'#451a03' }, { n:'Teal', p:'#0d9488', s:'#134e4a' },
];

const FONT_OPTIONS = [
  { n:'Jakarta (Default)', v:"'Plus Jakarta Sans','Inter',system-ui,sans-serif" },
  { n:'Inter', v:"'Inter',system-ui,sans-serif" },
  { n:'Sora', v:"'Sora',system-ui,sans-serif" },
  { n:'DM Sans', v:"'DM Sans',system-ui,sans-serif" },
  { n:'System', v:"system-ui,-apple-system,sans-serif" },
];

const DEFAULT_SETTINGS = {
  lang:'en',
  storeName:'AnyWhere', storeName2:'Anything', tagline:'Food • Grocery • Shopping • More', logoEmoji:'🌍', logoImg:'',
  announce:'🎉 Grand Sale — up to 60% OFF + extra 20% with code WELCOME20', showAnnounce:true,
  heroBadge:'⚡ Delivery in 30 mins — Anywhere', heroTitle:'Anything you crave, delivered Anywhere.', heroSub:'Food, groceries, fashion, electronics, medicines & home services — one cart, one checkout, one super-app.',
  heroCta1:'Order Food Now', heroCta2:'Explore Everything',
  sections:{ hero:true, verticals:true, promos:true, flash:true, best:true, collections:true, services:true, cities:true, testimonials:true, recent:true, reorder:true, spotlight:true, footer:true },
  theme:{ mode:'light', primary:'#e8433f', secondary:'#8b1e3f', font:"'Plus Jakarta Sans','Inter',system-ui,sans-serif", radius:16, cardStyle:'modern' },
  commerce:{ currency:'₹', deliveryFee:29, freeAbove:499, taxPct:5, showRatings:true, showVeg:true, showMrp:true, showTime:true },
};
const UPI_APPS = [
  { id:'GPay', short:'G', color:'#1a73e8' },
  { id:'PhonePe', short:'Pe', color:'#5f259f' },
  { id:'Paytm', short:'Pt', color:'#00b9f1' },
  { id:'BHIM', short:'BH', color:'#ed752e' },
];

/* ---------------- English / Hindi UI strings ---------------- */
const I18N = {
en:{
  searchPh:'Search "pizza", "milk", "headphones"…', searchPhM:'Search anything…', search:'Search', cart:'Cart', deliverTo:'Deliver to', all:'All',
  sideHome:'Home', sideExplore:'Explore All', sideOffers:'Offers & Coupons', sideOrders:'My Orders', sideWish:'Wishlist', sideCustom:'Customize Store', sideSeller:'Seller Central', sideLogin:'Login / Sign up',
  bHome:'Home', bExplore:'Explore', bOffers:'Offers', bOrders:'Orders', bCart:'Cart',
  statCustomers:'Happy customers', statCities:'Cities served', statRating:'Average rating',
  secCat:'Shop by category', secCatSub:'Every vertical, one cart — jump right in', secFlash:'Flash Deals — ends in', secBest:'Bestsellers near you', secBestSub:'Most loved this week in',
  secCur:'Curated collections', secCurSub:'Handpicked shelves for every mood', secFood:'Order food in a tap', secFoodSub:'Top rated restaurants near',
  secSvc:'Home services', secSvcSub:'Verified pros at your doorstep', secTrend:'Trending in electronics', secTrendSub:'Genuine products with warranty',
  secRecent:'Recently viewed', secAny:'We deliver Anywhere', secAnySub:'500+ cities and counting', secLoved:'Loved by millions', secLovedSub:'4.8 average across 2M+ reviews', viewAll:'View all →',
  addBtn:'ADD +',
  shopExplore:'Explore everything', shopResults:'Results for', shopDelivering:'delivering to', shopItems:'items', fFilters:'Filters', fResults:'results', fCategory:'Category', fMaxPrice:'Max price', fRating:'Rating', fAny:'Any rating', fAbove:'& above', fVeg:'Veg only', fClear:'Clear all filters',
  sortPop:'Sort: Popularity', sortPlh:'Price: Low → High', sortPhl:'Price: High → Low', sortRate:'Rating', sortOff:'Discount', itemsFound:'items found', noMatch:'No matches found', noMatchSub:'Try a different search or clear filters.',
  offTitle:'Offers & Coupons', offSub:'Stack savings — apply at checkout', copyBtn:'Copy', applyBtn:'Apply', appliedBtn:'Applied ✓',
  ordTitle:'My Orders', ordEmpty:'No orders yet', ordEmptySub:'Your delicious journey starts with the first cart.', ordStart:'Start shopping', ordItems:'items', ordTrack:'Track order', ordReorder:'Reorder',
  st0:'Placed', st1:'Preparing', st2:'Shipped', st3:'Out for delivery', st4:'Delivered',
  cartTitle:'Your Cart', wishTitle:'Wishlist', cartEmpty:'Cart is empty', cartEmptySub:'Add something delicious.', cartBrowse:'Browse products', couponPh:'Coupon code', apply:'Apply', remove:'Remove',
  couponLbl:'Coupon', subtotal:'Subtotal', delivery:'Delivery', free:'FREE', freeWon:"You've unlocked FREE delivery!", addMore:'more for FREE delivery', tax:'Tax', saveMrp:'You save on MRP', total:'Total', checkoutBtn:'Proceed to checkout →',
  pDeliverTo:'Deliver to', pReviews:'Ratings & reviews', pWriteReview:'Write a review…', pPost:'Post', pAddCart:'Add to cart',
  coAddr:'Address', coPay:'Payment', coDone:'Done', coName:'Full name', coPhone:'Phone', coAddrLbl:'Address', coCity:'City', coPin:'Pincode', coContinue:'Continue to payment →', coPayable:'Payable', coBack:'← Back', coPlace:'Place order', coPlacing:'Placing order…',
  coTotal:'Total', coItems:'Items', coDelTax:'Delivery + Tax', coCoupon:'Coupon', coSuccess:'Order placed!', coTrack:'Track order', coShop:'Continue shopping',
  payUpi:'UPI — instant & free', payCard:'Credit / Debit card', payCod:'Cash on delivery', payWallet:'Wallet',
  upiTitle:'Pay with UPI', upiIdPh:'yourname@upi', upiVerify:'Verify', upiVerifying:'Verifying…', upiInvalid:'Enter a valid UPI ID (e.g. name@okhdfc)', upiScan:'Scan & pay', upiScanSub:'Use any UPI app to scan', upiNote:'Approve the collect request in your UPI app', upiWait:'Waiting for approval in',
  selTitle:'Seller Central', selSub:'Your business, one dashboard', selRevenue:'Total revenue', selOrders:'Orders', selProducts:'Live products', selRating:'Avg rating',
  selChart:'Sales — last 7 days', selChartSub:'Live from your orders', selRecent:'Recent orders', selAdvance:'Advance', selTop:'Top products', selAdd:'Add product', selEdit:'Edit',
  selPayout:'Payouts', selAvail:'Available balance', selNext:'Next payout', selEmpty:'No sales yet — add sample orders to preview your dashboard.', selSeed:'Add sample orders', selView:'View store',
  locTitle:'Choose delivery location', locSearchPh:'Search city or pincode', locDetect:'Use my current location', locPop:'Popular cities', locHint:'e.g. Mumbai, 400001…',
  auWelcome:'Welcome', auLogin:'Login', auSignup:'Sign up', auName:'Name', auEmail:'Email', auPhone:'Phone', auLoginBtn:'Login', auCreateBtn:'Create account', auDemo:'Demo auth — stored only in your browser.', auHi:'Hi', auLogout:'Logout',
  ftShop:'Shop', ftCompany:'Company', ftHelp:'Help', ftAbout:'About us', ftCareers:'Careers', ftPartner:'Become a partner', ftGift:'Gift cards', ftBlog:'Blog', ftHelpC:'Help center', ftTrack:'Track order', ftReturns:'Returns', ftTerms:'Terms & privacy', ftCustom:'Customize store', ftSeller:'Seller Central',
  notifTitle:'Notifications', notifEmpty:'No notifications yet', notifEmptySub:'Order updates will appear here.', notifEnable:'Enable push alerts', notifOn:'Push alerts ON', notifClear:'Clear all',
  addrTitle:'My Addresses', addrAdd:'Add new address', addrSave:'Save address', addrLabel:'Label', addrHome:'Home', addrWork:'Work', addrOther:'Other', addrSaveBook:'Save to address book', addrEmpty:'No saved addresses yet', addrSaved:'Saved addresses',
  retTitle:'Return / Refund', retReason:'Reason for return', retDetail:'Details (optional)', retConfirm:'Confirm return', retStatus:'Refund status',
  r0:'Requested', r1:'Approved', r2:'Picked up', r3:'Refunded', retTo:'Refund to',
  mapEta:'Arriving in', mapRider:'Your rider', mapStore:'Store', mapHome:'Home',
  slotTitle:'Delivery slot', slotFood:'Food delivery', slotASAP:'ASAP · 30–40 min', slotSpeed:'Delivery speed', slotStd:'Standard · 2–4 days', slotExp:'Express · tomorrow', slotSvc:'Service visit', slotToday:'Today', slotTomw:'Tomorrow',
  rateTitle:'Rate your rider', rateBtn:'Rate rider', rateThanks:'Thanks for rating!', rateHow:'How was your delivery?', rateSubmit:'Submit rating',
  giftTitle:'Make it a gift', giftWrap:'Gift wrap + message', giftOcc:'Occasion', giftMsg:'Gift message', giftMsgPh:'Write your message…', giftHide:'Hide prices (gift receipt)', giftFee:'Gift wrap',
  expFee:'Express delivery',
  cloudTitle:'Cloud sync (Firebase)', cloudDesc:'Sync orders, products & settings across devices with a free Firebase database.', cloudUrl:'Database URL', cloudConnect:'Connect', cloudOff:'Disconnect', cloudOn:'Connected', cloudLocal:'Local only', cloudSync:'Sync now', cloudLast:'Last synced',
  promoTitle:'Promo banners', promoAdd:'Add banner', promoEmpty:'No banners — add your first!', promoEmoji:'Emoji', promoSubT:'Subtitle', promoColor:'Gradient', promoCode:'Coupon code', promoTarget:'Opens category', promoSave:'Save banner', promoNone:'No coupon',
  voiceListen:'Listening… speak now', voiceNone:'Voice search not supported here', voiceNoHit:'Did not catch that — try again',
  calList:'List', calCal:'Calendar', calPlaced:'Ordered', calDelivery:'Delivery', calService:'Service visit', calNone:'Nothing scheduled this day', calToday:'Today',
  rzpTitle:'Online payments (Razorpay)', rzpDesc:'Accept UPI, cards & netbanking via your own Razorpay key. Leave empty to hide.', rzpKey:'Razorpay Key ID', rzpSave:'Save key', rzpRemove:'Remove', rzpPay:'Razorpay — UPI, cards & more', rzpLoad:'Loading Razorpay…', rzpWin:'Complete payment in the Razorpay window', rzpFail:'Payment failed or cancelled',
  schedTitle:'Schedule delivery', schedNow:'Deliver now', schedLater:'Schedule for later', schedDay:'Day', schedTime:'Time window', schedToday:'Today', schedTomw:'Tomorrow',
  schedSoon:'in', schedChip:'Scheduled', schedRemind:'Delivery reminder', schedRemindSub:'Your scheduled order is on its way soon',
  loyTitle:'Loyalty wallet', loyBal:'Points balance', loyEarn:'You will earn', loyPts:'pts', loyUse:'Use loyalty points', loyApplied:'Loyalty discount', loyHist:'History', loyEmpty:'No loyalty activity yet — place an order to earn!', loyRule:'Earn 1 pt per ₹10 • 1 pt = ₹1 off', loyGot:'points earned!',
  splitTitle:'Split across addresses', splitSub:'Send items to different addresses in one checkout', splitTo:'Deliver to', splitNew:'Use checkout address', splitOf:'of', splitShip:'shipment',
  subTitle:'My Subscriptions', subBtn:'Subscribe', subEvery:'Every', subWeek:'week', sub2Week:'2 weeks', subMonth:'month', subSave:'Subscribe & Save 5%', subEmpty:'No subscriptions yet — subscribe to groceries from any product page!', subNext:'Next delivery', subPause:'Pause', subResume:'Resume', subCancel:'Cancel', subSkip:'Skip next', subActive:'Active', subPaused:'Paused', subDone:'Subscription order placed!',
  refTitle:'Refer & Earn', refYou:'Your referral code', refShare:'Share', refCopied:'Code copied — share it!', refApply:"Apply a friend's code", refGo:'Apply', refOk:'Referral applied! +50 pts', refBad:'Invalid or already-used code', refRule:'You get +50 pts, your friend gets +50 too',
  trkSplit:'Shipments in this order', trkOpen:'Track', calSub:'Subscription',
  boxTitle:'Essentials boxes', boxSub:'Curated grocery boxes — subscribe once, auto-delivered', boxItems:'items', boxGo:'Subscribe box', boxIn:'In this box', boxActive:'Box subscribed!',
  lbTitle:'Referral leaderboard', lbYou:'You', lbPts:'pts', lbDemo:'Demo: a friend joined (+50)', lbRank:'Your rank',
  proofTitle:'Delivery photo', proofSnap:'Simulate rider photo', proofUpload:'Upload photo', proofNone:'No photo yet — the rider snapshot appears here on delivery.', proofBy:'Snapped at delivery',
  buildTitle:'Build your own box', buildName:'Box name', buildNamePh:'e.g. Monthly Munchies', buildFreq:'Delivery every', buildAdd:'items in box', buildGo:'Subscribe custom box', buildNeed:'Add at least 1 item',
  giftSub:'Gift', giftToPh:'Who is it for?', giftMsgPh:'Enjoy your fresh box! 🎁', giftStart:'Starts', giftSave:'Schedule gift', giftCancel:'Cancel', giftFor:'Gift for', giftSent:'Gift subscription scheduled!', giftD1:'Tomorrow', giftD3:'In 3 days', giftD7:'In 7 days', giftD30:'In 30 days',
  tipTitle:'Tip your rider', tipSend:'Send tip', tipThanks:'Thanks for tipping!', tipTotal:'tips earned', tipCustom:'Custom',
  giftWrapFirst:'Gift-wrap first delivery', tipBoard:'Top tipped riders',
  reCycle:'usually lasts', reDays:'days', spotTitle:'Rider of the month', spotWhy:'Highest rated + most tipped in your neighborhood', wrapTitle:'Wrap style',
  secReorder:'Reorder essentials', secReorderSub:'Running low? One tap brings them back', reBought:'bought', reLow:'running low!',
},
hi:{
  searchPh:'"पिज़्ज़ा", "दूध", "हेडफ़ोन" खोजें…', searchPhM:'कुछ भी खोजें…', search:'खोजें', cart:'कार्ट', deliverTo:'डिलीवरी पता', all:'सभी',
  sideHome:'होम', sideExplore:'सब कुछ देखें', sideOffers:'ऑफर और कूपन', sideOrders:'मेरे ऑर्डर', sideWish:'विशलिस्ट', sideCustom:'स्टोर कस्टमाइज़ करें', sideSeller:'सेलर सेंट्रल', sideLogin:'लॉगिन / साइन अप',
  bHome:'होम', bExplore:'देखें', bOffers:'ऑफर', bOrders:'ऑर्डर', bCart:'कार्ट',
  statCustomers:'खुश ग्राहक', statCities:'शहरों में सेवा', statRating:'औसत रेटिंग',
  secCat:'कैटेगरी से खरीदें', secCatSub:'हर कैटेगरी, एक कार्ट — शुरू करें', secFlash:'फ्लैश डील — समाप्त होने में', secBest:'आपके पास बेस्टसेलर', secBestSub:'इस सप्ताह सबसे पसंदीदा',
  secCur:'चुने हुए कलेक्शन', secCurSub:'हर मूड के लिए खास', secFood:'एक टैप में खाना', secFoodSub:'टॉप रेटेड रेस्टोरेंट',
  secSvc:'होम सर्विसेज', secSvcSub:'घर पर वेरिफाइड एक्सपर्ट', secTrend:'इलेक्ट्रॉनिक्स में ट्रेंडिंग', secTrendSub:'वारंटी के साथ असली प्रोडक्ट',
  secRecent:'हाल में देखे', secAny:'हम हर जगह डिलीवर करते हैं', secAnySub:'500+ शहर और बढ़ रहे हैं', secLoved:'लाखों का भरोसा', secLovedSub:'2M+ रिव्यू में 4.8 औसत', viewAll:'सभी देखें →',
  addBtn:'जोड़ें +',
  shopExplore:'सब कुछ देखें', shopResults:'के लिए परिणाम', shopDelivering:'डिलीवरी', shopItems:'आइटम', fFilters:'फ़िल्टर', fResults:'परिणाम', fCategory:'कैटेगरी', fMaxPrice:'अधिकतम कीमत', fRating:'रेटिंग', fAny:'कोई भी रेटिंग', fAbove:'और ऊपर', fVeg:'सिर्फ वेज', fClear:'सभी फ़िल्टर हटाएं',
  sortPop:'क्रम: लोकप्रियता', sortPlh:'कीमत: कम → ज़्यादा', sortPhl:'कीमत: ज़्यादा → कम', sortRate:'रेटिंग', sortOff:'छूट', itemsFound:'आइटम मिले', noMatch:'कोई परिणाम नहीं', noMatchSub:'कुछ और खोजें या फ़िल्टर हटाएं।',
  offTitle:'ऑफर और कूपन', offSub:'बचत पक्की — चेकआउट पर लगाएं', copyBtn:'कॉपी', applyBtn:'लगाएं', appliedBtn:'लागू ✓',
  ordTitle:'मेरे ऑर्डर', ordEmpty:'अभी कोई ऑर्डर नहीं', ordEmptySub:'पहली कार्ट से स्वादिष्ट सफर शुरू करें।', ordStart:'खरीदारी शुरू करें', ordItems:'आइटम', ordTrack:'ऑर्डर ट्रैक करें', ordReorder:'फिर से मंगाएं',
  st0:'ऑर्डर मिला', st1:'तैयार हो रहा', st2:'भेज दिया', st3:'रास्ते में', st4:'डिलीवर',
  cartTitle:'आपकी कार्ट', wishTitle:'विशलिस्ट', cartEmpty:'कार्ट खाली है', cartEmptySub:'कुछ स्वादिष्ट जोड़ें।', cartBrowse:'प्रोडक्ट देखें', couponPh:'कूपन कोड', apply:'लगाएं', remove:'हटाएं',
  couponLbl:'कूपन', subtotal:'सबटोटल', delivery:'डिलीवरी', free:'मुफ़्त', freeWon:'मुफ़्त डिलीवरी पा ली!', addMore:'मुफ़्त डिलीवरी के लिए और जोड़ें', tax:'टैक्स', saveMrp:'MRP पर बचत', total:'कुल', checkoutBtn:'चेकआउट करें →',
  pDeliverTo:'डिलीवरी', pReviews:'रेटिंग और रिव्यू', pWriteReview:'रिव्यू लिखें…', pPost:'पोस्ट', pAddCart:'कार्ट में जोड़ें',
  coAddr:'पता', coPay:'भुगतान', coDone:'हो गया', coName:'पूरा नाम', coPhone:'फ़ोन', coAddrLbl:'पता', coCity:'शहर', coPin:'पिनकोड', coContinue:'भुगतान पर आगे बढ़ें →', coPayable:'देय राशि', coBack:'← पीछे', coPlace:'ऑर्डर करें', coPlacing:'ऑर्डर हो रहा…',
  coTotal:'कुल', coItems:'आइटम', coDelTax:'डिलीवरी + टैक्स', coCoupon:'कूपन', coSuccess:'ऑर्डर हो गया!', coTrack:'ऑर्डर ट्रैक करें', coShop:'और खरीदें',
  payUpi:'UPI — तुरंत व मुफ़्त', payCard:'क्रेडिट / डेबिट कार्ड', payCod:'कैश ऑन डिलीवरी', payWallet:'वॉलेट',
  upiTitle:'UPI से भुगतान', upiIdPh:'yourname@upi', upiVerify:'वेरिफाई', upiVerifying:'जांच हो रही…', upiInvalid:'सही UPI ID डालें (जैसे name@okhdfc)', upiScan:'स्कैन करके भुगतान करें', upiScanSub:'कोई भी UPI ऐप इस्तेमाल करें', upiNote:'अपने UPI ऐप में पेमेंट अप्रूव करें', upiWait:'में अप्रूवल का इंतज़ार',
  selTitle:'सेलर सेंट्रल', selSub:'आपका बिज़नेस, एक डैशबोर्ड', selRevenue:'कुल कमाई', selOrders:'ऑर्डर', selProducts:'लाइव प्रोडक्ट', selRating:'औसत रेटिंग',
  selChart:'बिक्री — पिछले 7 दिन', selChartSub:'आपके ऑर्डर से लाइव', selRecent:'हाल के ऑर्डर', selAdvance:'आगे बढ़ाएं', selTop:'टॉप प्रोडक्ट', selAdd:'प्रोडक्ट जोड़ें', selEdit:'एडिट',
  selPayout:'पेमेंट', selAvail:'उपलब्ध बैलेंस', selNext:'अगला पेमेंट', selEmpty:'अभी कोई बिक्री नहीं — सैंपल ऑर्डर जोड़कर डैशबोर्ड देखें।', selSeed:'सैंपल ऑर्डर जोड़ें', selView:'स्टोर देखें',
  locTitle:'डिलीवरी लोकेशन चुनें', locSearchPh:'शहर या पिनकोड खोजें', locDetect:'मेरी करंट लोकेशन इस्तेमाल करें', locPop:'लोकप्रिय शहर', locHint:'जैसे Mumbai, 400001…',
  auWelcome:'नमस्ते', auLogin:'लॉगिन', auSignup:'साइन अप', auName:'नाम', auEmail:'ईमेल', auPhone:'फ़ोन', auLoginBtn:'लॉगिन', auCreateBtn:'अकाउंट बनाएं', auDemo:'डेमो लॉगिन — सिर्फ आपके ब्राउज़र में सेव।', auHi:'नमस्ते', auLogout:'लॉगआउट',
  ftShop:'खरीदें', ftCompany:'कंपनी', ftHelp:'मदद', ftAbout:'हमारे बारे में', ftCareers:'करियर', ftPartner:'पार्टनर बनें', ftGift:'गिफ्ट कार्ड', ftBlog:'ब्लॉग', ftHelpC:'हेल्प सेंटर', ftTrack:'ऑर्डर ट्रैक करें', ftReturns:'रिटर्न', ftTerms:'नियम व प्राइवेसी', ftCustom:'स्टोर कस्टमाइज़ करें', ftSeller:'सेलर सेंट्रल',
  notifTitle:'सूचनाएं', notifEmpty:'अभी कोई सूचना नहीं', notifEmptySub:'ऑर्डर अपडेट यहां दिखेंगे।', notifEnable:'पुश अलर्ट चालू करें', notifOn:'पुश अलर्ट चालू', notifClear:'सभी हटाएं',
  addrTitle:'मेरे पते', addrAdd:'नया पता जोड़ें', addrSave:'पता सेव करें', addrLabel:'लेबल', addrHome:'घर', addrWork:'ऑफिस', addrOther:'अन्य', addrSaveBook:'एड्रेस बुक में सेव करें', addrEmpty:'अभी कोई सेव पता नहीं', addrSaved:'सेव किए गए पते',
  retTitle:'रिटर्न / रिफंड', retReason:'रिटर्न का कारण', retDetail:'विवरण (वैकल्पिक)', retConfirm:'रिटर्न कन्फर्म करें', retStatus:'रिफंड स्टेटस',
  r0:'रिक्वेस्ट हुई', r1:'अप्रूव हुआ', r2:'पिकअप हुआ', r3:'रिफंड हुआ', retTo:'रिफंड जाएगा',
  mapEta:'पहुचेगा', mapRider:'आपका राइडर', mapStore:'स्टोर', mapHome:'घर',
  slotTitle:'डिलीवरी स्लॉट', slotFood:'खाने की डिलीवरी', slotASAP:'जल्दी · 30–40 मि.', slotSpeed:'डिलीवरी स्पीड', slotStd:'स्टैंडर्ड · 2–4 दिन', slotExp:'एक्सप्रेस · कल', slotSvc:'सर्विस विज़िट', slotToday:'आज', slotTomw:'कल',
  rateTitle:'राइडर को रेट करें', rateBtn:'राइडर रेट करें', rateThanks:'रेटिंग के लिए धन्यवाद!', rateHow:'डिलीवरी कैसी रही?', rateSubmit:'रेटिंग भेजें',
  giftTitle:'गिफ्ट बनाएं', giftWrap:'गिफ्ट रैप + मैसेज', giftOcc:'अवसर', giftMsg:'गिफ्ट मैसेज', giftMsgPh:'अपना मैसेज लिखें…', giftHide:'कीमतें छुपाएं (गिफ्ट रसीद)', giftFee:'गिफ्ट रैप',
  expFee:'एक्सप्रेस डिलीवरी',
  cloudTitle:'क्लाउड सिंक (Firebase)', cloudDesc:'फ्री Firebase डेटाबेस से ऑर्डर, प्रोडक्ट व सेटिंग सभी डिवाइस पर सिंक करें।', cloudUrl:'डेटाबेस URL', cloudConnect:'कनेक्ट', cloudOff:'हटाएं', cloudOn:'जुड़ा', cloudLocal:'सिर्फ लोकल', cloudSync:'अभी सिंक', cloudLast:'आखिरी सिंक',
  promoTitle:'प्रोमो बैनर', promoAdd:'बैनर जोड़ें', promoEmpty:'कोई बैनर नहीं — पहला जोड़ें!', promoEmoji:'इमोजी', promoSubT:'सबटाइटल', promoColor:'ग्रेडिएंट', promoCode:'कूपन कोड', promoTarget:'कैटेगरी खोलें', promoSave:'बैनर सेव करें', promoNone:'कोई कूपन नहीं',
  voiceListen:'सुन रहे हैं… बोलें', voiceNone:'यहां वॉइस सर्च नहीं है', voiceNoHit:'समझ नहीं आया — फिर बोलें',
  calList:'लिस्ट', calCal:'कैलेंडर', calPlaced:'ऑर्डर', calDelivery:'डिलीवरी', calService:'सर्विस विज़िट', calNone:'इस दिन कुछ नहीं', calToday:'आज',
  rzpTitle:'ऑनलाइन पेमेंट (Razorpay)', rzpDesc:'अपनी Razorpay key से UPI, कार्ड व नेटबैंकिंग लें। खाली रखें तो छिपा रहेगा।', rzpKey:'Razorpay Key ID', rzpSave:'की सेव करें', rzpRemove:'हटाएं', rzpPay:'Razorpay — UPI, कार्ड व और', rzpLoad:'Razorpay खुल रहा…', rzpWin:'Razorpay विंडो में पेमेंट करें', rzpFail:'पेमेंट असफल या रद्द',
  schedTitle:'डिलीवरी शेड्यूल करें', schedNow:'अभी मंगाएं', schedLater:'बाद के लिए शेड्यूल', schedDay:'दिन', schedTime:'समय चुनें', schedToday:'आज', schedTomw:'कल',
  schedSoon:'में', schedChip:'शेड्यूल्ड', schedRemind:'डिलीवरी रिमाइंडर', schedRemindSub:'आपका शेड्यूल्ड ऑर्डर जल्द आ रहा है',
  loyTitle:'लॉयल्टी वॉलेट', loyBal:'पॉइंट बैलेंस', loyEarn:'मिलेंगे', loyPts:'पॉइंट', loyUse:'लॉयल्टी पॉइंट इस्तेमाल करें', loyApplied:'लॉयल्टी छूट', loyHist:'हिस्ट्री', loyEmpty:'अभी कोई गतिविधि नहीं — ऑर्डर करके कमाएं!', loyRule:'₹10 पर 1 पॉइंट • 1 पॉइंट = ₹1 छूट', loyGot:'पॉइंट मिले!',
  splitTitle:'कई पतों पर भेजें', splitSub:'एक ही चेकआउट में सामान अलग-अलग पतों पर भेजें', splitTo:'डिलीवर होगा', splitNew:'चेकआउट वाला पता', splitOf:'/', splitShip:'पार्सल',
  subTitle:'मेरे सब्सक्रिप्शन', subBtn:'सब्सक्राइब', subEvery:'हर', subWeek:'सप्ताह', sub2Week:'2 सप्ताह', subMonth:'महीना', subSave:'सब्सक्राइब करें — 5% बचाएं', subEmpty:'अभी कोई सब्सक्रिप्शन नहीं — किसी प्रोडक्ट पेज से सब्सक्राइब करें!', subNext:'अगली डिलीवरी', subPause:'रोकें', subResume:'चालू करें', subCancel:'रद्द करें', subSkip:'अगली छोड़ें', subActive:'चालू', subPaused:'रुका', subDone:'सब्सक्रिप्शन ऑर्डर हो गया!',
  refTitle:'रेफर करें व कमाएं', refYou:'आपका रेफरल कोड', refShare:'शेयर', refCopied:'कोड कॉपी हुआ — शेयर करें!', refApply:'दोस्त का कोड लगाएं', refGo:'लगाएं', refOk:'रेफरल लगा! +50 पॉइंट', refBad:'गलत या इस्तेमाल किया कोड', refRule:'आपको +50, दोस्त को भी +50',
  trkSplit:'इस ऑर्डर के पार्सल', trkOpen:'ट्रैक', calSub:'सब्सक्रिप्शन',
  boxTitle:'ज़रूरी बॉक्स', boxSub:'चुने हुए किराना बॉक्स — एक बार सब्सक्राइब करें, ऑटो-डिलीवरी पाएं', boxItems:'सामान', boxGo:'बॉक्स सब्सक्राइब', boxIn:'इस बॉक्स में', boxActive:'बॉक्स सब्सक्राइब हुआ!',
  lbTitle:'रेफरल लीडरबोर्ड', lbYou:'आप', lbPts:'पॉइंट', lbDemo:'डेमो: दोस्त जुड़ा (+50)', lbRank:'आपकी रैंक',
  proofTitle:'डिलीवरी फोटो', proofSnap:'राइडर फोटो बनाएं', proofUpload:'फोटो अपलोड', proofNone:'अभी फोटो नहीं — डिलीवरी पर राइडर फोटो यहां दिखेगी।', proofBy:'डिलीवरी पर ली गई',
  buildTitle:'अपना बॉक्स बनाएं', buildName:'बॉक्स का नाम', buildNamePh:'जैसे मासिक राशन', buildFreq:'डिलीवरी हर', buildAdd:'सामान', buildGo:'कस्टम बॉक्स सब्सक्राइब', buildNeed:'कम से कम 1 सामान जोड़ें',
  giftSub:'गिफ्ट', giftToPh:'किसके लिए है?', giftMsgPh:'अपना फ्रेश बॉक्स एंजॉय करो! 🎁', giftStart:'शुरू होगा', giftSave:'गिफ्ट शेड्यूल करें', giftCancel:'रद्द करें', giftFor:'गिफ्ट —', giftSent:'गिफ्ट सब्सक्रिप्शन शेड्यूल हुआ!', giftD1:'कल', giftD3:'3 दिन में', giftD7:'7 दिन में', giftD30:'30 दिन में',
  tipTitle:'राइडर को टिप दें', tipSend:'टिप भेजें', tipThanks:'टिप के लिए धन्यवाद!', tipTotal:'टिप मिली', tipCustom:'कस्टम',
  giftWrapFirst:'पहली डिलीवरी गिफ्ट-रैप करें', tipBoard:'टॉप टिप वाले राइडर',
  reCycle:'आमतौर पर चलता', reDays:'दिन', spotTitle:'महीने का राइडर', spotWhy:'आपके इलाके का सबसे रेटेड + सबसे टिप पाने वाला', wrapTitle:'रैप स्टाइल',
  secReorder:'फिर से मंगाएं', secReorderSub:'खत्म हो रहा? एक टैप में वापस पाएं', reBought:'बार खरीदा', reLow:'खत्म हो रहा!',
}};

const RETURN_REASONS = [
  { en:'Damaged / defective item', hi:'टूटा / खराब सामान' },
  { en:'Wrong item delivered', hi:'गलत सामान आया' },
  { en:'Item missing from order', hi:'सामान गायब है' },
  { en:'Quality not as expected', hi:'क्वालिटी उम्मीद जैसी नहीं' },
  { en:'Ordered by mistake', hi:'गलती से ऑर्डर हुआ' },
  { en:'Late delivery', hi:'डिलीवरी लेट हुई' },
];

const RIDER_NAMES = ['Arjun','Ravi','Sana','Vikram','Ishaan','Meera','Kabir','Divya'];

const GIFT_FEE = 29, EXPRESS_FEE = 49;
const GIFT_OCCASIONS = [
  { en:'Birthday', hi:'जन्मदिन' }, { en:'Anniversary', hi:'सालगिरह' }, { en:'Wedding', hi:'शादी' },
  { en:'Thank You', hi:'धन्यवाद' }, { en:'Festival', hi:'त्योहार' }, { en:'Other', hi:'अन्य' },
];
const RATING_TAGS = [
  { en:'Polite', hi:'विनम्र' }, { en:'Superfast', hi:'बहुत तेज़' }, { en:'Careful packing', hi:'सावधानी से पैकिंग' },
  { en:'On time', hi:'समय पर' }, { en:'Friendly', hi:'मिलनसार' },
];
const SUB_FREQS = [7, 14, 30], SUB_SAVE_PCT = 5, REF_PTS = 50;
const SUB_BOXES = [
  { id:'bx1', en:'Breakfast Box', hi:'नाश्ता बॉक्स', e:'🥣', freq:7, items:[{pid:'g3',qty:2},{pid:'g4',qty:1},{pid:'g10',qty:1}] },
  { id:'bx2', en:'Monthly Staples', hi:'मासिक राशन', e:'🧺', freq:30, items:[{pid:'g5',qty:1},{pid:'g6',qty:1},{pid:'g9',qty:1}] },
  { id:'bx3', en:'Fresh Weekly', hi:'ताज़ा साप्ताहिक', e:'🥬', freq:7, items:[{pid:'g1',qty:1},{pid:'g2',qty:1},{pid:'g3',qty:2}] },
  { id:'bx4', en:'Snack Attack', hi:'स्नैक बॉक्स', e:'🍿', freq:14, items:[{pid:'g7',qty:1},{pid:'g8',qty:2}] },
];
const REF_BOARD = [
  { n:'Aarav', pts:480 }, { n:'Priya', pts:350 }, { n:'Kabir', pts:300 },
  { n:'Neha', pts:210 }, { n:'Rohan', pts:150 }, { n:'Isha', pts:90 }, { n:'Dev', pts:50 },
];
const TIP_AMOUNTS = [10, 20, 50, 100];
const TIP_BOARD = [
  { n:'Arjun', pts:1250 }, { n:'Sana', pts:980 }, { n:'Kabir', pts:720 },
  { n:'Meera', pts:540 }, { n:'Ravi', pts:310 }, { n:'Divya', pts:150 },
];
const GIFT_STYLES = [
  { id:'classic', e:'🎀', add:0, en:'Classic', hi:'क्लासिक' },
  { id:'birthday', e:'🎂', add:10, en:'Birthday', hi:'जन्मदिन' },
  { id:'festival', e:'🪔', add:10, en:'Festival', hi:'त्योहार' },
  { id:'premium', e:'✨', add:49, en:'Premium', hi:'प्रीमियम' },
];
