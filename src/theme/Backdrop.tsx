import { useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { getActivity, onActivity, type ActivityKind } from './themes';
import { rng } from '../ai/embeddings';

/**
 * The living backdrop.
 *
 * One canvas, four different simulations. All of them read the shared activity
 * bus every frame, so the background is a real-time visualisation of what the
 * engine is doing: brighter while it thinks, rippling as tokens stream, and
 * settling back to idle on its own.
 *
 * Performance notes: the aurora is composited into a 0.3× offscreen buffer and
 * upscaled, which is both cheaper than full-resolution gradients and gives the
 * soft bloom for free. The loop pauses when the tab is hidden and renders a
 * single static frame when motion is off.
 */
export function Backdrop(): JSX.Element {
  const { theme, motion } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme === 'phosphor') return; // CRT is pure CSS, no canvas needed.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let raf = 0;
    let running = true;
    let last = performance.now();
    let clock = 0;

    const lowRes = document.createElement('canvas');
    const lowCtx = lowRes.getContext('2d');

    interface Star { x: number; y: number; r: number; a: number; tw: number }
    interface Plankton { x: number; y: number; z: number; vx: number; vy: number; energy: number; hue: number; r: number }
    let stars: Star[] = [];
    let plankton: Plankton[] = [];

    const seedFor = (n: number) => rng(`${theme}:${n}`);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const s = seedFor(width + height);
      const starCount = Math.round((width * height) / 9000);
      stars = Array.from({ length: Math.max(60, starCount) }, () => ({
        x: s() * width,
        y: s() * height,
        r: 0.3 + s() * 1.3,
        a: 0.15 + s() * 0.75,
        tw: 0.4 + s() * 2.4,
      }));
      const p = seedFor(width * height);
      const planktonCount = Math.round(70 + (width * height) / 26000);
      plankton = Array.from({ length: Math.min(220, planktonCount) }, () => ({
        x: p() * width,
        y: p() * height,
        z: 0.25 + p() * 1,
        vx: (p() - 0.5) * 0.16,
        vy: -0.05 - p() * 0.22,
        energy: p() * 0.4,
        hue: p(),
        r: 0.8 + p() * 2.6,
      }));

      if (lowCtx) {
        lowRes.width = Math.max(2, Math.floor(width * 0.3));
        lowRes.height = Math.max(2, Math.floor(height * 0.3));
      }
    };

    // Flares: every streamed token lights up a handful of nearby organisms.
    const offActivity = onActivity((level: number, kind: ActivityKind) => {
      if (theme !== 'abyss') return;
      if (kind !== 'streaming' && kind !== 'tool') return;
      const count = Math.round(2 + level * 10);
      for (let i = 0; i < count; i++) {
        const p = plankton[Math.floor(Math.random() * plankton.length)];
        if (p) p.energy = Math.min(1.6, p.energy + 0.5 + Math.random() * 0.6);
      }
    });

    // ── renderers ─────────────────────────────────────────────────────────

    const drawStars = (alphaScale = 1) => {
      for (const st of stars) {
        const twinkle = 0.65 + 0.35 * Math.sin(clock * st.tw + st.x);
        ctx.globalAlpha = st.a * twinkle * alphaScale;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawAurora = (act: number) => {
      const c = lowCtx;
      if (!c) return;
      const w = lowRes.width;
      const h = lowRes.height;
      c.clearRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';

      const curtains = 5;
      const palette = ['#5ef0c8', '#7c8cff', '#a86bff', '#4ee0ff', '#8afff0'];
      const strength = 0.35 + act * 0.85;
      for (let i = 0; i < curtains; i++) {
        const baseY = h * (0.1 + (i / curtains) * 0.36);
        const amp = h * (0.05 + 0.05 * Math.sin(clock * 0.12 + i));
        const freq = 1.1 + i * 0.55;
        const phase = clock * (0.1 + i * 0.035) + i * 1.7;
        const thickness = h * (0.2 + 0.14 * Math.sin(clock * 0.08 + i * 2));
        const colour = palette[i % palette.length];

        c.beginPath();
        c.moveTo(-4, h + 4);
        const step = Math.max(2, w / 90);
        for (let x = -4; x <= w + 4; x += step) {
          const t = x / w;
          const y =
            baseY +
            Math.sin(t * freq * Math.PI * 2 + phase) * amp +
            Math.sin(t * freq * 2.7 + phase * 1.6) * amp * 0.4 +
            Math.sin(t * freq * 0.6 - phase * 0.7) * amp * 0.55;
          c.lineTo(x, y);
        }
        for (let x = w + 4; x >= -4; x -= step) {
          const t = x / w;
          const y =
            baseY + thickness +
            Math.sin(t * freq * Math.PI * 2 + phase) * amp +
            Math.sin(t * freq * 2.7 + phase * 1.6) * amp * 0.4;
          c.lineTo(x, y);
        }
        c.closePath();

        const grad = c.createLinearGradient(0, baseY - amp, 0, baseY + thickness + amp);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.3, hexA(colour, 0.16 * strength));
        grad.addColorStop(0.55, hexA(colour, 0.3 * strength));
        grad.addColorStop(0.8, hexA(colour, 0.12 * strength));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grad;
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(lowRes, 0, 0, width, height);
      ctx.restore();
    };

    const drawAbyss = (act: number, dt: number) => {
      // Light shafts from the surface.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = width * (0.12 + i * 0.24) + Math.sin(clock * 0.07 + i) * width * 0.03;
        const grad = ctx.createLinearGradient(x, 0, x + width * 0.08, height * 0.85);
        const a = 0.03 + act * 0.05;
        grad.addColorStop(0, `rgba(120,220,255,${a})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - width * 0.03, 0);
        ctx.lineTo(x + width * 0.05, 0);
        ctx.lineTo(x + width * 0.14, height * 0.9);
        ctx.lineTo(x - width * 0.06, height * 0.9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Plankton: depth-sorted, each with its own decaying bioluminescence.
      const sorted = [...plankton].sort((a, b) => a.z - b.z);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of sorted) {
        p.x += p.vx * p.z * dt * 60;
        p.y += p.vy * p.z * dt * 60;
        p.x += Math.sin(clock * 0.4 + p.y * 0.01) * 0.16 * p.z;
        if (p.y < -20) {
          p.y = height + 20;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        p.energy = Math.max(0.04, p.energy - dt * 0.55);

        const base = 0.1 + act * 0.2;
        const glow = Math.min(1.4, base + p.energy);
        const radius = p.r * p.z * (2 + glow * 7);
        const hue = p.hue < 0.5 ? '#0affc7' : p.hue < 0.8 ? '#8afff0' : '#4ee0ff';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, hexA(hue, Math.min(0.85, 0.16 * glow + p.energy * 0.5)));
        grad.addColorStop(0.35, hexA(hue, Math.min(0.4, 0.06 * glow + p.energy * 0.18)));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (p.energy > 0.6) {
          ctx.fillStyle = hexA('#eaffff', Math.min(0.9, p.energy * 0.5));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.z * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    const drawEclipse = (act: number) => {
      const cx = width * 0.5;
      const cy = height * 0.42;
      const R = Math.min(width, height) * (0.2 + act * 0.05);
      const rot = clock * 0.06;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Corona: a bright ring with radial spikes.
      const spikes = 90;
      for (let i = 0; i < spikes; i++) {
        const a = rot + (i / spikes) * Math.PI * 2;
        const len = R * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(i * 2.3 + clock * 0.5))) * (0.6 + act);
        const grad = ctx.createLinearGradient(
          cx + Math.cos(a) * R,
          cy + Math.sin(a) * R,
          cx + Math.cos(a) * (R + len),
          cy + Math.sin(a) * (R + len),
        );
        grad.addColorStop(0, `rgba(255,196,110,${0.1 + act * 0.12})`);
        grad.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
        ctx.stroke();
      }
      // Limb glow.
      const limb = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.3);
      limb.addColorStop(0, 'rgba(0,0,0,0)');
      limb.addColorStop(0.45, `rgba(255,190,110,${0.22 + act * 0.2})`);
      limb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = limb;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // The occluding disc: absolute black.
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.92, 0, Math.PI * 2);
      ctx.fill();

      drawStars(0.5 + act * 0.3);
    };

    const drawDaylight = (act: number) => {
      const blobs = [
        { x: 0.18, y: 0.12, r: 0.62, c: '#c9d8ff' },
        { x: 0.82, y: 0.2, r: 0.55, c: '#d7f0ff' },
        { x: 0.55, y: 0.88, r: 0.7, c: '#e8dcff' },
        { x: 0.1, y: 0.8, r: 0.5, c: '#dff7ec' },
      ];
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      blobs.forEach((b, i) => {
        const cx = (b.x + Math.sin(clock * 0.05 + i) * 0.03) * width;
        const cy = (b.y + Math.cos(clock * 0.04 + i * 1.7) * 0.03) * height;
        const r = b.r * Math.max(width, height) * 0.55;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, hexA(b.c, 0.5 + act * 0.2));
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      });
      ctx.restore();
    };

    const render = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const { level } = getActivity();

      ctx.clearRect(0, 0, width, height);
      if (theme === 'aurora') {
        drawStars(0.85);
        drawAurora(level);
      } else if (theme === 'abyss') {
        drawAbyss(level, dt);
      } else if (theme === 'eclipse') {
        drawEclipse(level);
      } else if (theme === 'daylight') {
        drawDaylight(level);
      }
      frame++;
      raf = requestAnimationFrame(render);
    };

    const renderStatic = () => {
      const { level } = getActivity();
      ctx.clearRect(0, 0, width, height);
      if (theme === 'aurora') {
        drawStars(0.85);
        drawAurora(0.25);
      } else if (theme === 'abyss') drawAbyss(0.2, 0.016);
      else if (theme === 'eclipse') drawEclipse(0.2);
      else drawDaylight(0.2);
      void level;
    };

    resize();
    window.addEventListener('resize', resize);
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (motion !== 'off') {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (motion === 'off') {
      renderStatic();
    } else {
      // Reduced motion keeps the scene but slows it to a near-still drift.
      if (motion === 'reduced') clock = 0;
      raf = requestAnimationFrame(render);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      offActivity();
    };
  }, [theme, motion]);

  if (theme === 'phosphor') {
    // The CRT is entirely CSS: scanlines, grille, flicker and a refresh band.
    return (
      <div className="backdrop crt" aria-hidden="true">
        <div className="crt-scanlines" />
        <div className="crt-grille" />
        <div className="crt-band" />
        <div className="crt-vignette" />
        <div className="crt-flicker" />
      </div>
    );
  }

  return (
    <div className="backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="backdrop-canvas" />
      <div className="backdrop-veil" />
    </div>
  );
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
