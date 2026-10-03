/**
 * Procedural art engine.
 *
 * The Prompt Studio builds a structured image prompt and then *renders* it. This
 * is not a text-to-image model — it is a deterministic generative renderer
 * seeded from the prompt hash, so the same prompt always produces the same
 * artwork and every knob visibly changes the output. That makes it genuinely
 * functional offline: prompt in, pixels out, reproducible.
 *
 * Techniques used are all real graphics programming: seeded value-noise with
 * fBm octaves, flow-field advection, marching-squares contours, layered radial
 * gradients, additive glow compositing and a luminance-matched grain pass.
 */

import { hash32, rng } from './embeddings';

export type ArtStyle = 'nebula' | 'aurora' | 'flowfield' | 'topographic' | 'geometric' | 'circuit' | 'wave' | 'bokeh';

export const ART_STYLES: Array<{ id: ArtStyle; label: string; hint: string }> = [
  { id: 'nebula', label: 'Nebula', hint: 'Layered fBm clouds with additive glow' },
  { id: 'aurora', label: 'Aurora', hint: 'Sine-composed light curtains over a horizon' },
  { id: 'flowfield', label: 'Flow field', hint: 'Particles advected through a noise vector field' },
  { id: 'topographic', label: 'Topographic', hint: 'Marching-squares contours of a height field' },
  { id: 'geometric', label: 'Geometric', hint: 'Nested rotating polygons and arcs' },
  { id: 'circuit', label: 'Circuit', hint: 'Orthogonal traces, vias and pads' },
  { id: 'wave', label: 'Interference', hint: 'Superposed sine waves with phase drift' },
  { id: 'bokeh', label: 'Bokeh', hint: 'Depth-of-field discs with soft falloff' },
];

export interface Palette {
  id: string;
  label: string;
  colors: string[];
  background: string;
}

export const PALETTES: Palette[] = [
  { id: 'aurora', label: 'Aurora', colors: ['#5ef0c8', '#7c8cff', '#a86bff', '#4ee0ff', '#f0f4ff'], background: '#05060e' },
  { id: 'abyss', label: 'Abyss', colors: ['#0affc7', '#0a7fbf', '#062a4a', '#8afff0', '#123a63'], background: '#01080f' },
  { id: 'ember', label: 'Ember', colors: ['#ff6b35', '#f7c59f', '#ff2e63', '#ffd23f', '#7a1f1f'], background: '#14060a' },
  { id: 'verdant', label: 'Verdant', colors: ['#8ecf6a', '#2f9e6b', '#d9f27e', '#1c6b4a', '#f2ffe9'], background: '#05130b' },
  { id: 'mono', label: 'Graphite', colors: ['#f4f6fb', '#c3c9d6', '#8b93a7', '#565e73', '#2a2f3d'], background: '#0b0d13' },
  { id: 'solar', label: 'Solar', colors: ['#ffd166', '#ff9f1c', '#fff3c4', '#f4732b', '#7c2d12'], background: '#120a04' },
  { id: 'glacier', label: 'Glacier', colors: ['#dff3ff', '#8fd3f4', '#4a90c2', '#b8e0ff', '#1f4e79'], background: '#04121c' },
  { id: 'phosphor', label: 'Phosphor', colors: ['#7dffa8', '#3dff94', '#c9ffe0', '#12a75a', '#0a5c30'], background: '#02110a' },
  { id: 'orchid', label: 'Orchid', colors: ['#ff7ad9', '#c56bff', '#8a7bff', '#ffd6f5', '#5b2a86'], background: '#0e0518' },
  { id: 'dawn', label: 'Dawn', colors: ['#ffd6a5', '#ffadad', '#fdffb6', '#a0c4ff', '#ffc6ff'], background: '#1a1114' },
];

export interface ArtSpec {
  prompt: string;
  negative: string;
  style: ArtStyle;
  paletteId: string;
  seed: number;
  density: number; // 0..1 — how many elements
  chaos: number; // 0..1 — noise frequency / randomness
  glow: number; // 0..1 — additive bloom strength
  grain: number; // 0..1 — film grain
  scale: number; // 0..1 — feature size
  weights: Record<string, number>; // emphasis terms, 0..2
}

export const DEFAULT_SPEC: Omit<ArtSpec, 'prompt' | 'seed'> = {
  negative: '',
  style: 'nebula',
  paletteId: 'aurora',
  density: 0.55,
  chaos: 0.4,
  glow: 0.6,
  grain: 0.18,
  scale: 0.5,
  weights: {},
};

// ─────────────────────────────── noise ───────────────────────────────

/** Seeded 2D value noise with smoothstep interpolation and fBm octaves. */
class Noise {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rand = rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }

  noise2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];
    const x1 = lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
    return (lerp(x1, x2, v) + 1) / 2;
  }

  fbm(x: number, y: number, octaves = 5, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

// ─────────────────────────────── colour helpers ───────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))})`;
}

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Bias palette + parameters from the prompt text, so wording changes the image. */
export function paletteForPrompt(prompt: string, explicitId?: string): Palette {
  if (explicitId) return paletteById(explicitId);
  const p = prompt.toLowerCase();
  if (/night|aurora|neon|cyber|electric|glow/.test(p)) return paletteById('aurora');
  if (/sea|ocean|deep|water|abyss|marine|underwater/.test(p)) return paletteById('abyss');
  if (/fire|ember|sunset|lava|warm|autumn|desert/.test(p)) return paletteById('ember');
  if (/forest|jungle|plant|leaf|green|garden|moss/.test(p)) return paletteById('verdant');
  if (/mono|greyscale|grayscale|black and white|noir|minimal/.test(p)) return paletteById('mono');
  if (/sun|solar|gold|amber|light/.test(p)) return paletteById('solar');
  if (/ice|snow|glacier|frost|cold|winter|arctic/.test(p)) return paletteById('glacier');
  if (/terminal|retro|crt|hacker|matrix|phosphor/.test(p)) return paletteById('phosphor');
  if (/dream|vapor|pink|orchid|pastel|soft/.test(p)) return paletteById('orchid');
  if (/dawn|morning|sunrise|blush/.test(p)) return paletteById('dawn');
  return PALETTES[0];
}

/** Negative prompts genuinely move parameters — they are not decorative. */
export function applyNegative(spec: ArtSpec): ArtSpec {
  const n = spec.negative.toLowerCase();
  if (!n) return spec;
  const out = { ...spec };
  if (/grain|noise|texture/.test(n)) out.grain = clamp(out.grain * 0.25);
  if (/busy|clutter|crowd|dense|complex/.test(n)) out.density = clamp(out.density * 0.5);
  if (/glow|bloom|blur|halo/.test(n)) out.glow = clamp(out.glow * 0.25);
  if (/chaos|random|messy|wild/.test(n)) out.chaos = clamp(out.chaos * 0.4);
  if (/sharp|hard|edge|angular/.test(n)) out.style = out.style === 'geometric' ? 'nebula' : out.style;
  if (/big|large|huge/.test(n)) out.scale = clamp(out.scale * 0.6);
  return out;
}

// ─────────────────────────────── renderer ───────────────────────────────

export interface RenderResult {
  seed: number;
  palette: Palette;
  style: ArtStyle;
  elements: number;
  ms: number;
}

export function renderArt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: ArtSpec,
  time = 0,
): RenderResult {
  const t0 = performance.now();
  const applied = applyNegative(spec);
  const palette = paletteForPrompt(spec.prompt, spec.paletteId);
  const seed = spec.seed || hash32(`${spec.prompt}|${spec.style}|${spec.paletteId}`);
  const rand = rng(seed);
  const noise = new Noise(seed);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  // Vignette base so every style sits in a lit field rather than flat colour.
  const bg = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
  bg.addColorStop(0, rgba(palette.colors[1], 0.22));
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  let elements = 0;
  switch (applied.style) {
    case 'nebula': elements = drawNebula(ctx, width, height, applied, palette, noise, rand); break;
    case 'aurora': elements = drawAurora(ctx, width, height, applied, palette, rand, time); break;
    case 'flowfield': elements = drawFlowField(ctx, width, height, applied, palette, noise, rand); break;
    case 'topographic': elements = drawTopographic(ctx, width, height, applied, palette, noise); break;
    case 'geometric': elements = drawGeometric(ctx, width, height, applied, palette, rand, time); break;
    case 'circuit': elements = drawCircuit(ctx, width, height, applied, palette, rand); break;
    case 'wave': elements = drawWaves(ctx, width, height, applied, palette, rand, time); break;
    case 'bokeh': elements = drawBokeh(ctx, width, height, applied, palette, rand); break;
  }

  if (applied.grain > 0.001) addGrain(ctx, width, height, applied.grain, seed);
  addVignette(ctx, width, height);
  ctx.restore();

  return {
    seed,
    palette,
    style: applied.style,
    elements,
    ms: Math.round(performance.now() - t0),
  };
}

function drawNebula(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec,
  palette: Palette, noise: Noise, rand: () => number,
): number {
  const clouds = Math.round(6 + spec.density * 26);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < clouds; i++) {
    const cx = rand() * w;
    const cy = rand() * h;
    const r = (0.08 + rand() * 0.42) * Math.min(w, h) * (0.4 + spec.scale * 1.6);
    const colour = palette.colors[Math.floor(rand() * palette.colors.length)];
    const turb = noise.fbm(cx / (w * (0.2 + spec.chaos)), cy / (h * (0.2 + spec.chaos)), 4);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, rgba(colour, 0.16 + spec.glow * 0.34 * turb));
    grad.addColorStop(0.45, rgba(colour, 0.06 + spec.glow * 0.1 * turb));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Star field, density-scaled.
  const stars = Math.round(120 + spec.density * 900);
  for (let i = 0; i < stars; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand();
    const size = a > 0.985 ? 1.9 : a > 0.9 ? 1.2 : 0.7;
    ctx.fillStyle = rgba(a > 0.93 ? palette.colors[0] : '#ffffff', 0.18 + a * 0.7);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return clouds + stars;
}

function drawAurora(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec,
  palette: Palette, rand: () => number, time: number,
): number {
  const curtains = Math.round(3 + spec.density * 7);
  ctx.globalCompositeOperation = 'lighter';
  for (let c = 0; c < curtains; c++) {
    const colour = palette.colors[c % palette.colors.length];
    const baseY = h * (0.18 + rand() * 0.4);
    const amp = h * (0.05 + rand() * 0.16) * (0.5 + spec.chaos);
    const freq = (1.2 + rand() * 2.6) * (0.5 + spec.chaos * 2);
    const phase = rand() * Math.PI * 2 + time * 0.0006;
    const thickness = h * (0.1 + spec.scale * 0.35);

    ctx.beginPath();
    ctx.moveTo(-20, h + 20);
    const step = Math.max(4, w / 220);
    for (let x = -20; x <= w + 20; x += step) {
      const t = x / w;
      const y =
        baseY +
        Math.sin(t * freq * Math.PI * 2 + phase) * amp +
        Math.sin(t * freq * 3.7 + phase * 1.7) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    for (let x = w + 20; x >= -20; x -= step) {
      const t = x / w;
      const y =
        baseY + thickness +
        Math.sin(t * freq * Math.PI * 2 + phase) * amp +
        Math.sin(t * freq * 3.7 + phase * 1.7) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, baseY - amp, 0, baseY + thickness + amp);
    grad.addColorStop(0, rgba(colour, 0));
    grad.addColorStop(0.35, rgba(colour, 0.1 + spec.glow * 0.3));
    grad.addColorStop(0.65, rgba(colour, 0.06 + spec.glow * 0.18));
    grad.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = grad;
    ctx.fill();
  }
  // Horizon stars.
  const stars = Math.round(80 + spec.density * 400);
  for (let i = 0; i < stars; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = rgba('#ffffff', 0.1 + rand() * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, rand() > 0.94 ? 1.4 : 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return curtains + stars;
}

function drawFlowField(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec,
  palette: Palette, noise: Noise, rand: () => number,
): number {
  const lines = Math.round(120 + spec.density * 1400);
  const steps = Math.round(24 + spec.scale * 90);
  const zoom = 0.0016 + spec.chaos * 0.006;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < lines; i++) {
    let x = rand() * w;
    let y = rand() * h;
    const colour = palette.colors[Math.floor(rand() * palette.colors.length)];
    ctx.strokeStyle = rgba(colour, 0.05 + rand() * 0.2);
    ctx.lineWidth = 0.4 + rand() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const angle = noise.fbm(x * zoom, y * zoom, 3) * Math.PI * 4 * (1 + spec.chaos);
      x += Math.cos(angle) * 2.6;
      y += Math.sin(angle) * 2.6;
      if (x < -10 || x > w + 10 || y < -10 || y > h + 10) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  return lines;
}

function drawTopographic(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec, palette: Palette, noise: Noise,
): number {
  const levels = Math.round(6 + spec.density * 26);
  const cell = Math.max(3, Math.round(8 - spec.scale * 5));
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const zoom = (0.6 + spec.chaos * 3.2) / Math.max(w, h) * 4;

  // Height field.
  const field = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      field[y * cols + x] = noise.fbm(x * cell * zoom, y * cell * zoom, 5);
    }
  }

  ctx.lineJoin = 'round';
  let count = 0;
  for (let l = 0; l < levels; l++) {
    const threshold = (l + 1) / (levels + 1);
    const colour = palette.colors[l % palette.colors.length];
    ctx.strokeStyle = rgba(colour, 0.35 + spec.glow * 0.4);
    ctx.lineWidth = 0.7 + (l / levels) * 1.3;
    ctx.beginPath();
    // Marching squares: emit the boundary segment for each cell crossing.
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const tl = field[y * cols + x];
        const tr = field[y * cols + x + 1];
        const br = field[(y + 1) * cols + x + 1];
        const bl = field[(y + 1) * cols + x];
        let idx = 0;
        if (tl > threshold) idx |= 8;
        if (tr > threshold) idx |= 4;
        if (br > threshold) idx |= 2;
        if (bl > threshold) idx |= 1;
        if (idx === 0 || idx === 15) continue;
        const px = x * cell;
        const py = y * cell;
        const interp = (a: number, b: number) => clamp((threshold - a) / (b - a || 1e-6));
        const top = [px + interp(tl, tr) * cell, py];
        const right = [px + cell, py + interp(tr, br) * cell];
        const bottom = [px + interp(bl, br) * cell, py + cell];
        const left = [px, py + interp(tl, bl) * cell];
        const segs: number[][] = SEGMENT_TABLE[idx] ?? [];
        for (const [a, b] of segs) {
          const p1 = [top, right, bottom, left][a];
          const p2 = [top, right, bottom, left][b];
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          count++;
        }
      }
    }
    ctx.stroke();
  }
  return count;
}

const SEGMENT_TABLE: Record<number, number[][]> = {
  1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[1, 0]], 5: [[3, 0], [1, 2]],
  6: [[2, 0]], 7: [[3, 0]], 8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]],
  11: [[0, 1]], 12: [[1, 3]], 13: [[1, 2]], 14: [[2, 3]],
};

function drawGeometric(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec,
  palette: Palette, rand: () => number, time: number,
): number {
  const shapes = Math.round(4 + spec.density * 22);
  const cx = w / 2;
  const cy = h / 2;
  let count = 0;
  for (let i = 0; i < shapes; i++) {
    const sides = 3 + Math.floor(rand() * 7);
    const radius = (0.08 + rand() * 0.55) * Math.min(w, h) * (0.4 + spec.scale * 1.4);
    const rot = rand() * Math.PI * 2 + (time * 0.00008 * (rand() > 0.5 ? 1 : -1)) * (1 + spec.chaos * 3);
    const colour = palette.colors[i % palette.colors.length];
    const ox = cx + (rand() - 0.5) * w * 0.28 * spec.chaos;
    const oy = cy + (rand() - 0.5) * h * 0.28 * spec.chaos;

    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const a = rot + (s / sides) * Math.PI * 2;
      const x = ox + Math.cos(a) * radius;
      const y = oy + Math.sin(a) * radius;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(colour, 0.28 + spec.glow * 0.5);
    ctx.lineWidth = 0.8 + rand() * 2.2;
    ctx.stroke();
    if (rand() < 0.35 + spec.glow * 0.3) {
      ctx.fillStyle = rgba(colour, 0.03 + spec.glow * 0.07);
      ctx.fill();
    }
    // Inscribed arcs.
    if (rand() < 0.5) {
      ctx.beginPath();
      ctx.arc(ox, oy, radius * (0.35 + rand() * 0.5), rot, rot + Math.PI * (0.5 + rand()));
      ctx.strokeStyle = rgba(palette.colors[(i + 2) % palette.colors.length], 0.2 + spec.glow * 0.35);
      ctx.lineWidth = 0.6 + rand();
      ctx.stroke();
    }
    count += 2;
  }
  return count;
}

function drawCircuit(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec, palette: Palette, rand: () => number,
): number {
  const traces = Math.round(20 + spec.density * 160);
  const grid = Math.max(8, Math.round(34 - spec.scale * 24));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let count = 0;
  for (let i = 0; i < traces; i++) {
    let x = Math.round(rand() * w / grid) * grid;
    let y = Math.round(rand() * h / grid) * grid;
    const colour = palette.colors[Math.floor(rand() * palette.colors.length)];
    ctx.strokeStyle = rgba(colour, 0.25 + spec.glow * 0.45);
    ctx.lineWidth = 0.8 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = Math.round(3 + rand() * 9 * (0.5 + spec.chaos));
    for (let s = 0; s < segs; s++) {
      const dir = Math.floor(rand() * 4);
      const len = grid * (1 + Math.floor(rand() * 4));
      if (dir === 0) x += len;
      else if (dir === 1) x -= len;
      else if (dir === 2) y += len;
      else y -= len;
      x = clamp(x, grid, w - grid);
      y = clamp(y, grid, h - grid);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Pad at the end of the trace.
    ctx.fillStyle = rgba(colour, 0.5 + spec.glow * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + rand() * 2.4, 0, Math.PI * 2);
    ctx.fill();
    count += 2;
  }
  return count;
}

function drawWaves(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec,
  palette: Palette, rand: () => number, time: number,
): number {
  const waves = Math.round(10 + spec.density * 60);
  ctx.globalCompositeOperation = 'lighter';
  let count = 0;
  for (let i = 0; i < waves; i++) {
    const colour = palette.colors[i % palette.colors.length];
    const amp = h * (0.01 + rand() * 0.12) * (0.4 + spec.scale * 1.6);
    const freq = (0.5 + rand() * 4) * (0.5 + spec.chaos * 2.5);
    const phase = rand() * Math.PI * 2 + time * 0.0008 * (0.4 + rand());
    const yBase = (i / waves) * h + Math.sin(phase) * amp * 0.4;
    ctx.beginPath();
    const step = Math.max(2, w / 300);
    for (let x = 0; x <= w; x += step) {
      const t = x / w;
      const y =
        yBase +
        Math.sin(t * freq * Math.PI * 2 + phase) * amp +
        Math.sin(t * freq * 2.3 * Math.PI * 2 + phase * 1.4) * amp * 0.4 * spec.chaos;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(colour, 0.1 + spec.glow * 0.32);
    ctx.lineWidth = 0.6 + rand() * 1.8;
    ctx.stroke();
    count++;
  }
  ctx.globalCompositeOperation = 'source-over';
  return count;
}

function drawBokeh(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: ArtSpec, palette: Palette, rand: () => number,
): number {
  const discs = Math.round(14 + spec.density * 120);
  ctx.globalCompositeOperation = 'lighter';
  const sorted = Array.from({ length: discs }, () => ({
    x: rand() * w,
    y: rand() * h,
    r: (0.01 + rand() * 0.14) * Math.min(w, h) * (0.4 + spec.scale * 1.8),
    c: palette.colors[Math.floor(rand() * palette.colors.length)],
    a: 0.05 + rand() * 0.3,
    depth: rand(),
  })).sort((p, q) => q.r - p.r); // far (large, soft) first

  for (const d of sorted) {
    const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    const edge = 0.55 + d.depth * 0.4;
    grad.addColorStop(0, rgba(d.c, d.a * (0.4 + spec.glow)));
    grad.addColorStop(edge, rgba(d.c, d.a * 0.5 * (0.4 + spec.glow)));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    if (d.depth > 0.82) {
      ctx.strokeStyle = rgba(d.c, 0.18 + spec.glow * 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  return discs;
}

/** Film grain applied via a pre-rendered tile, so it costs one draw call. */
function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number): void {
  const tile = 128;
  const off = document.createElement('canvas');
  off.width = tile;
  off.height = tile;
  const octx = off.getContext('2d');
  if (!octx) return;
  const img = octx.createImageData(tile, tile);
  const rand = rng(seed ^ 0x9e3779b9);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.round(amount * 46);
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(off, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function addVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Serialise a spec into the prompt string the studio displays. */
export function buildPromptText(spec: ArtSpec, palette: Palette): string {
  const bits = [spec.prompt.trim()]
    .filter(Boolean)
    .concat([
      `${spec.style} render`,
      `${palette.label.toLowerCase()} palette`,
      `density ${(spec.density * 100).toFixed(0)}%`,
      `chaos ${(spec.chaos * 100).toFixed(0)}%`,
      `glow ${(spec.glow * 100).toFixed(0)}%`,
      `scale ${(spec.scale * 100).toFixed(0)}%`,
      `grain ${(spec.grain * 100).toFixed(0)}%`,
      `seed ${spec.seed}`,
    ]);
  const weighted = Object.entries(spec.weights).filter(([, v]) => v !== 1);
  if (weighted.length) bits.push(weighted.map(([k, v]) => `(${k}:${v.toFixed(2)})`).join(' '));
  if (spec.negative.trim()) bits.push(`— negative: ${spec.negative.trim()}`);
  return bits.join(', ');
}

export { mix, hexToRgb };
