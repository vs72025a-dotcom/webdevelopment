/**
 * Icon set — a single stroke-based sprite map, so icons cost one component and
 * inherit `currentColor`. 24×24 grid, 1.7 stroke, round caps.
 */
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.3-4A8.4 8.4 0 0 1 3.5 11 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6M14 4l-4 16',
  sparkles: 'M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5 16l.6 1.5L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.5z',
  bot: 'M12 2v3M8 8h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM9.5 13v1.5M14.5 13v1.5M9 17.5h6',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.2H3a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 4.4 8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  stop: 'M6 6h12v12H6z',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  check: 'M20 6L9 17l-5-5',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  pin: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  micOff: 'M1 1l22 22M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.9-.7M19 10v2a7 7 0 0 1-.6 2.8M12 19v4M8 23h8M5 10v2a7 7 0 0 0 10.9 6',
  volume: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14',
  volumeOff: 'M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6',
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 18l-6-6 6-6',
  x: 'M18 6L6 18M6 6l12 12',
  calc: 'M4 2h16v20H4zM8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h8',
  ruler: 'M3 15L15 3l6 6L9 21zM7 11l2 2M11 7l2 2M15 11l2 2',
  hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M3 3v18h18M7 15l3-4 3 3 5-7',
  gauge: 'M12 21a9 9 0 1 1 9-9M12 12l4.5-4.5',
  asterisk: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9',
  braces: 'M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  key: 'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7 7 5 5 0 0 1 7-7zm0 0L15 8m0 0l3 3 3-3-3-3',
  dice: 'M4 4h16v16H4zM9 9h.01M15 15h.01M12 12h.01M15 9h.01M9 15h.01',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  palette: 'M12 22a10 10 0 1 1 0-20c5 0 9 3.6 9 8 0 2.8-2.2 5-5 5h-1.8a1.8 1.8 0 0 0-1.3 3c.3.4.5.8.5 1.3A2.7 2.7 0 0 1 12 22zM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01',
  menu: 'M3 12h18M3 6h18M3 18h18',
  command: 'M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM20 5v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3',
  cpu: 'M6 6h12v12H6zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  terminal: 'M4 17l6-5-6-5M12 19h8',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  play: 'M6 3l14 9-14 9V3z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  wave: 'M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0M2 18c2-4 4-4 6 0',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  history: 'M3 3v6h6M3.5 13a9 9 0 1 0 2.6-6.4L3 9M12 7v5l4 2',
  quote: 'M6 17h3l2-4V6H4v7h3zM17 17h3l2-4V6h-7v7h3z',
  brain: 'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.9.4A2.5 2.5 0 0 1 5 17.5a2.5 2.5 0 0 1-.9-4A2.5 2.5 0 0 1 5 9a2.5 2.5 0 0 1 1.6-4.4A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.9.4A2.5 2.5 0 0 0 19 17.5a2.5 2.5 0 0 0 .9-4A2.5 2.5 0 0 0 19 9a2.5 2.5 0 0 0-1.6-4.4A2.5 2.5 0 0 0 14.5 2z',
};

export type IconName = keyof typeof P;

export function Icon({
  name,
  size = 16,
  style,
  className,
  fill = 'none',
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
  fill?: string;
}): JSX.Element {
  const d = P[name] ?? P.info;
  const solid = ['stop', 'play', 'dice', 'zap', 'bolt', 'pin'].includes(name);
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : fill}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export const Logo = ({ size = 26 }: { size?: number }): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--accent-2)" />
        <stop offset="55%" stopColor="var(--accent)" />
        <stop offset="100%" stopColor="var(--accent-3)" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#lg1)" opacity="0.22" />
    <path
      d="M10 41c6-9 12 4 19-3s12 6 21-5"
      fill="none"
      stroke="url(#lg1)"
      strokeWidth="4.4"
      strokeLinecap="round"
    />
    <path d="M13 50c6-6 11 3 17-2s11 5 18-3" fill="none" stroke="var(--accent-2)" strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />
    <circle cx="32" cy="26" r="7.5" fill="none" stroke="url(#lg1)" strokeWidth="3.4" />
    <circle cx="32" cy="26" r="2.4" fill="var(--accent-2)" />
  </svg>
);
