/**
 * jsdom environment for the smoke test.
 *
 * This module must be imported *before* react-dom: React reads
 * `document.implementation.hasFeature` while it initialises to decide whether
 * it needs its legacy input-event polyfill, and jsdom has no `attachEvent`.
 * Import order is the whole point of this file existing separately.
 */
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const w = dom.window as unknown as Window & typeof globalThis & Record<string, unknown>;

// Canvas: jsdom has no 2D context, so hand the app a stub that records calls.
const ctxStub = new Proxy(
  {
    canvas: { width: 1280, height: 800 },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: (x: number, y: number, ww: number, hh: number) => ({
      data: new Uint8ClampedArray(Math.max(4, ww * hh * 4)),
      width: ww,
      height: hh,
    }),
    putImageData() {},
    measureText: () => ({ width: 8 }),
    createImageData: (ww: number, hh: number) => ({ data: new Uint8ClampedArray(ww * hh * 4), width: ww, height: hh }),
  } as Record<string, unknown>,
  {
    get(t, k) {
      if (k in t) return t[k as string];
      return () => undefined;
    },
    set(t, k, v) {
      t[k as string] = v;
      return true;
    },
  },
);

(w as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype.getContext =
  function getContext(this: { width: number; height: number }) {
    (ctxStub as Record<string, unknown>).canvas = this;
    return ctxStub;
  };
(w as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype.toDataURL =
  () => 'data:image/png;base64,iVBORw0KGgo=';

// jsdom's hasFeature() always answers false, which pushes React's change-event
// plugin down an IE-era attachEvent polyfill that jsdom lacks. Claim support so
// controlled inputs behave like they do in a real browser.
w.document.implementation.hasFeature = () => true;
(w.document as unknown as Record<string, unknown>).attachEvent = () => undefined;
(w.document as unknown as Record<string, unknown>).detachEvent = () => undefined;

w.matchMedia =
  w.matchMedia ??
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));

Object.defineProperty(w.navigator, 'language', { value: 'en-US', configurable: true });
(w as unknown as Record<string, unknown>).speechSynthesis = {
  speak() {},
  cancel() {},
  getVoices: () => [],
  addEventListener() {},
};
(w as unknown as Record<string, unknown>).devicePixelRatio = 1;
w.scrollTo = () => undefined;
(w.navigator as unknown as Record<string, unknown>).clipboard = { writeText: async () => undefined };
if (!w.requestAnimationFrame) {
  w.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;
  w.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

for (const key of [
  'window',
  'document',
  'navigator',
  'location',
  'HTMLElement',
  'HTMLCanvasElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'DragEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'matchMedia',
  'localStorage',
  'indexedDB',
  'IDBKeyRange',
  'speechSynthesis',
  'devicePixelRatio',
  'crypto',
]) {
  const v = (w as unknown as Record<string, unknown>)[key];
  if (v !== undefined) define(key, v);
}
define('window', w);
define('self', w);
define('IS_REACT_ACT_ENVIRONMENT', true);

/** Node 22 makes some globals getter-only, so define rather than assign. */
export function define(key: string, value: unknown): void {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

export const win = w;
