/**
 * Theme registry and the activity bus.
 *
 * Four night themes, each with a different *mechanism*, not just a different
 * palette:
 *
 *   aurora    — a living canvas aurora whose brightness tracks engine activity
 *   abyss     — drifting bioluminescent plankton that flare as tokens arrive
 *   phosphor  — a CRT: scanlines, barrel vignette, flicker and text afterglow
 *   eclipse   — true-black OLED with a single rotating solar-corona ring
 *   daylight  — the day theme (also what Auto switches to between sunrise/sunset)
 *
 * The activity bus is what makes the night modes feel connected to the AI:
 * anything that is thinking or streaming calls `pushActivity()`, and the canvas
 * backdrops read the decaying value every frame.
 */

export type ThemeId = 'aurora' | 'abyss' | 'phosphor' | 'eclipse' | 'daylight';
export type ThemeChoice = ThemeId | 'auto';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  tagline: string;
  description: string;
  night: boolean;
  /** Preview swatches for the theme picker. */
  swatch: [string, string, string, string];
  features: string[];
  accent: string;
  /** Backdrop implementation. */
  backdrop: 'canvas-aurora' | 'canvas-abyss' | 'css-crt' | 'canvas-eclipse' | 'canvas-daylight';
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'aurora',
    label: 'Aurora Mesh',
    tagline: 'A sky that reacts to the model',
    description:
      'Animated aurora curtains composited additively over a starfield, behind frosted-glass panels. Intensity is driven by engine activity — the sky brightens while the model thinks and settles when it stops.',
    night: true,
    swatch: ['#05060e', '#5ef0c8', '#7c8cff', '#a86bff'],
    features: ['Activity-reactive brightness', 'Additive glow compositing', 'Starfield parallax', 'Reduced-motion aware'],
    accent: '#7c8cff',
    backdrop: 'canvas-aurora',
  },
  {
    id: 'abyss',
    label: 'Abyssal Bioluminescence',
    tagline: 'Deep water, lit from within',
    description:
      'A slow drift of glowing plankton in deep water. Each streamed token makes nearby organisms flare, so the response literally lights up the dark as it is written.',
    night: true,
    swatch: ['#01080f', '#0affc7', '#0a7fbf', '#8afff0'],
    features: ['Token-triggered bioluminescent flares', 'Depth-sorted parallax', 'Caustic light shafts'],
    accent: '#0affc7',
    backdrop: 'canvas-abyss',
  },
  {
    id: 'phosphor',
    label: 'Phosphor CRT',
    tagline: 'A terminal that remembers',
    description:
      'Monochrome green phosphor on a curved glass tube: scanlines, aperture-grille stripes, a slow vertical refresh band, subtle flicker, and an afterglow that decays behind moving text.',
    night: true,
    swatch: ['#02110a', '#7dffa8', '#3dff94', '#12a75a'],
    features: ['Scanline + aperture grille', 'Phosphor afterglow', 'Refresh band and flicker', 'Barrel vignette'],
    accent: '#7dffa8',
    backdrop: 'css-crt',
  },
  {
    id: 'eclipse',
    label: 'Eclipse Obsidian',
    tagline: 'True black, one corona',
    description:
      'A #000 OLED background so unlit pixels draw no power, with a single slowly rotating solar-corona ring as the only light source and razor-sharp contrast for night reading.',
    night: true,
    swatch: ['#000000', '#ffd166', '#ff9f1c', '#f4f6fb'],
    features: ['Pure #000 OLED black', 'Rotating corona ring', 'Zero background noise', 'Maximum contrast'],
    accent: '#ffd166',
    backdrop: 'canvas-eclipse',
  },
  {
    id: 'daylight',
    label: 'Daylight',
    tagline: 'Paper-white, low glare',
    description:
      'A soft cool-white day theme with a barely-there gradient mesh. Auto mode switches to it between your local sunrise and sunset.',
    night: false,
    swatch: ['#f4f6fb', '#4b5bd7', '#0a7fbf', '#111827'],
    features: ['Low-glare off-white', 'Same layout metrics as night', 'Used by Auto during the day'],
    accent: '#4b5bd7',
    backdrop: 'canvas-daylight',
  },
];

export const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

export function themeMeta(id: string): ThemeMeta {
  return THEME_MAP.get(id as ThemeId) ?? THEMES[0];
}

export const ACCENT_CHOICES: Array<{ id: string; label: string; value: string }> = [
  { id: 'theme', label: 'Match theme', value: '' },
  { id: 'indigo', label: 'Indigo', value: '#7c8cff' },
  { id: 'mint', label: 'Mint', value: '#5ef0c8' },
  { id: 'amber', label: 'Amber', value: '#ffb454' },
  { id: 'rose', label: 'Rose', value: '#ff6b9d' },
  { id: 'cyan', label: 'Cyan', value: '#4ee0ff' },
  { id: 'lime', label: 'Lime', value: '#a3e635' },
];

// ─────────────────────────────── activity bus ───────────────────────────────

type Listener = (level: number, kind: ActivityKind) => void;
export type ActivityKind = 'idle' | 'thinking' | 'streaming' | 'tool' | 'done';

let level = 0;
let kind: ActivityKind = 'idle';
let lastPulse = 0;
const listeners = new Set<Listener>();

/** Decay constant — how quickly the glow falls back to idle. */
const DECAY_PER_SECOND = 0.85;

export function pushActivity(k: ActivityKind, amount = 1): void {
  kind = k;
  lastPulse = performance.now();
  level = Math.min(1, level + amount);
  notify();
}

export function setActivity(k: ActivityKind, value?: number): void {
  kind = k;
  lastPulse = performance.now();
  if (value !== undefined) level = Math.max(0, Math.min(1, value));
  else if (k === 'idle') level = 0;
  else if (k === 'done') level = Math.min(1, level + 0.35);
  notify();
}

export function getActivity(): { level: number; kind: ActivityKind } {
  // Decay based on elapsed time so the value is correct even if nobody reads it
  // for a while (e.g. the tab was backgrounded).
  const now = performance.now();
  const dt = (now - lastPulse) / 1000;
  if (dt > 0.05 && kind !== 'thinking' && kind !== 'streaming') {
    level = Math.max(0, level - DECAY_PER_SECOND * dt);
    lastPulse = now;
  }
  return { level, kind };
}

export function onActivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn(level, kind);
}

/** True when the user asked the OS to reduce animation. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
