import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { ThemeChoice, ThemeId, themeMeta, prefersReducedMotion } from './themes';
import { estimatePosition, requestPosition, solarTimes, type GeoPosition } from './solar';
import { lsRaw, lsSetRaw } from '../store/db';

interface ThemeContextValue {
  choice: ThemeChoice;
  theme: ThemeId;
  meta: ReturnType<typeof themeMeta>;
  motion: 'full' | 'reduced' | 'off';
  density: 'cosy' | 'compact';
  accent: string;
  auto: {
    active: boolean;
    position: GeoPosition;
    sunrise: string;
    sunset: string;
    isDaylight: boolean;
  };
  setChoice: (c: ThemeChoice) => void;
  setMotion: (m: 'full' | 'reduced' | 'off') => void;
  setDensity: (d: 'cosy' | 'compact') => void;
  setAccent: (a: string) => void;
  refineLocation: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const VALID: ThemeChoice[] = ['aurora', 'abyss', 'phosphor', 'eclipse', 'daylight', 'auto'];

function readChoice(): ThemeChoice {
  const raw = lsRaw('am.theme') ?? 'aurora';
  return (VALID as string[]).includes(raw) ? (raw as ThemeChoice) : 'aurora';
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [motion, setMotionState] = useState<'full' | 'reduced' | 'off'>(() => {
    const stored = lsRaw('am.motion');
    if (stored === 'reduced' || stored === 'off' || stored === 'full') return stored;
    return prefersReducedMotion() ? 'reduced' : 'full';
  });
  const [density, setDensityState] = useState<'cosy' | 'compact'>(() => (lsRaw('am.density') === 'compact' ? 'compact' : 'cosy'));
  const [accent, setAccentState] = useState<string>(() => lsRaw('am.accent') ?? '');
  const [position, setPosition] = useState<GeoPosition>(() => estimatePosition());
  const [now, setNow] = useState(() => new Date());

  // Resolve Auto → a concrete theme using the local solar clock.
  const solar = useMemo(() => solarTimes(now, position), [now, position]);
  const resolved: ThemeId =
    choice === 'auto'
      ? solar
        ? solar.isDaylight
          ? 'daylight'
          : 'aurora'
        : new Date().getHours() >= 6 && new Date().getHours() < 18
          ? 'daylight'
          : 'aurora'
      : (choice as ThemeId);

  const meta = themeMeta(resolved);

  // Re-evaluate Auto once a minute — enough to catch sunrise and sunset.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (choice !== 'auto') return;
    timer.current = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [choice]);

  // Honour an OS-level reduced-motion change while the app is open.
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setMotionState(mq.matches ? 'reduced' : 'full');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Apply to <html>. Doing it here (as well as in the inline boot script) keeps
  // later changes in sync without a reload.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-night', meta.night ? 'true' : 'false');
    root.setAttribute('data-motion', motion);
    root.setAttribute('data-density', density);
    root.style.setProperty('--accent', accent || meta.accent);
    root.style.colorScheme = meta.night ? 'dark' : 'light';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', meta.swatch[0]);
  }, [resolved, meta, motion, density, accent]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    lsSetRaw('am.theme', c);
    if (c === 'auto') setNow(new Date());
  }, []);

  const setMotion = useCallback((m: 'full' | 'reduced' | 'off') => {
    setMotionState(m);
    lsSetRaw('am.motion', m);
  }, []);

  const setDensity = useCallback((d: 'cosy' | 'compact') => {
    setDensityState(d);
    lsSetRaw('am.density', d);
  }, []);

  const setAccent = useCallback((a: string) => {
    setAccentState(a);
    if (a) lsSetRaw('am.accent', a);
    else localStorage.removeItem('am.accent');
  }, []);

  const refineLocation = useCallback(async () => {
    const p = await requestPosition();
    setPosition(p);
    setNow(new Date());
  }, []);

  const value: ThemeContextValue = {
    choice,
    theme: resolved,
    meta,
    motion,
    density,
    accent: accent || meta.accent,
    auto: {
      active: choice === 'auto',
      position,
      sunrise: solar ? solar.sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—',
      sunset: solar ? solar.sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—',
      isDaylight: solar?.isDaylight ?? true,
    },
    setChoice,
    setMotion,
    setDensity,
    setAccent,
    refineLocation,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
