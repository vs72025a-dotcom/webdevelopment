# Aurora Mind — an advanced AI workspace that runs in your browser

A complete AI workbench built as a single Vite + React + TypeScript app with **zero runtime
dependencies** beyond React itself. It ships a real reasoning engine — intent routing, vector
retrieval, tool calling, citation and composition — that executes entirely on device, and it can
optionally hand the wheel to a frontier model when you paste an API key.

```bash
npm install
npm run dev        # http://localhost:5173 — binds 0.0.0.0
npm run build      # tsc -b && vite build
npm test           # typecheck + the jsdom runtime smoke test (79 assertions)
```

---

## The six surfaces

| View | What it actually does |
| --- | --- |
| **Chat** | Streaming answers with an expandable reasoning trace, tool cards showing the exact call and its output, inline `[n]` citations that open the source passage, per-message copy / read-aloud / regenerate / edit-and-rerun, and markdown with syntax-highlighted code. |
| **Documents** | Drop text files or paste notes; they are chunked (760/120 overlap) and embedded into 1024-d vectors *in the tab*. A retrieval tester runs the same hybrid search the engine runs and shows semantic vs lexical scores per hit. Settings can import a library back in from an export or any JSON file of title/text pairs — sources are re-embedded locally. |
| **Code Lab** | A gutter-numbered editor with a highlighter preview, deterministic static analysis from our own parser (structure, complexity, smells), and Explain / Review / Tests / Refactor through the engine. |
| **Prompt Studio** | A structured prompt compiles into a spec (style, palette, density, chaos, glow, grain, scale, per-term TF-IDF weights, negative terms) that drives a seeded renderer — value-noise nebulae, marching-squares topography, flow fields, circuits. Same seed, same pixels. Export PNG or save to the gallery. |
| **Agents** | A goal is decomposed into steps, each step names its tool and arguments, the tools really execute, and the report is written only from what they returned. Every step shows its own output and timing. |
| **Settings** | Theme and accent, motion and density, engine retrieval toggles, provider configuration with a live connection probe, voice, storage usage, JSON export, and **diagnostics that run live assertions** against the calculator, unit converter, colour engine, code analyser, retrieval index, grounding path and persistence. |

Global: `⌘K` command palette (also searches your conversations and documents), `⌘1–6` to jump
views, `⌘B` panel, `/` to focus the composer, `⌘⏎` to run in Code Lab and Agents.

## The engine

Nothing is mocked. `src/ai/` is the whole brain:

- **`tokenizer.ts`** — normalisation, stemming, stopword folding, British/American spelling
  folding, sentence splitting, and language detection across 20 languages.
- **`embeddings.ts`** — deterministic 1024-d hashed embeddings (unigram + bigram + character
  n-gram features, L2-normalised) and a hybrid score blending cosine similarity (0.62) with
  lexical overlap (0.38). Measured on a 54-question benchmark against the 50-entry corpus:
  **top-1 92.6 %, top-3 96.3 %, MRR 0.948**.
- **`vectorStore.ts`** — semantic chunking plus a flat cosine index. Brute force beats any
  approximate index at browser-corpus sizes.
- **`expression.ts`** — a recursive-descent maths parser with ~50 functions, implicit
  multiplication, right-associative `^`, `20% of 150`, variables and base prefixes. 66/66 on the
  regression suite.
- **`units.ts`** — 13 categories with joint from/to disambiguation, because `c` is both Celsius
  and the speed of light and `b` is both bit and byte.
- **`tools.ts`** — 16 tools with JSON schemas, usable both by the local planner and by a remote
  provider's function calling.
- **`analysis.ts`** — MMR extractive summarisation (λ = 0.72), TF-IDF keywords, sentiment,
  syllable-based readability.
- **`knowledge.ts`** — 53 hand-written core entries covering AI, this app, engineering practice and
  science; indexed at boot as retrievable, citable sources.
- **`pack.ts`** — the extended pack: 58 more entries across machine-learning systems, the web
  platform, security, distributed data, science and practical life. Indexed on top of the core
  corpus and switchable from Settings. Measured end to end on a 100-question set: answers whose
  top citation is the right entry go from **15.8 % → 78.9 %** on questions only the pack can
  answer, while core questions move **76.7 % → 74.4 %**. It also cuts ungrounded answers (8 → 3)
  and low-confidence answers (21 → 3), so it ships on by default.
- **`engine.ts`** — intent classification with a continuity rule for terse follow-ups, retrieval
  with query expansion, tool orchestration, and composition that cites what it used.
- **`markdown.ts` / `highlight.ts`** — an escape-first markdown renderer (tables, task lists,
  footnotes, citation chips, safe links) and a sticky-regex highlighter for 20 languages. Both
  hand-written to keep the dependency count at zero.
- **`providers.ts`** — OpenAI-compatible, Anthropic, Gemini and Ollama streaming, with SSE
  parsing, tool-call rounds and honest HTTP error descriptions.
- **`agent.ts`** — goal → step derivation → execution → evidenced report.
- **`art.ts`** — 8 renderers, 10 palettes, seeded value noise and fBm.

### Grounding and honesty

Hits are re-ranked by a title-and-tag overlap bonus, then classified by *source kind* rather than
by id prefix, so a built-in entry can never be quoted back as if you had uploaded it. Retrieval has
to clear two gates before a passage may be cited: a score floor of `0.74 × top` **and** at least one
shared content term with the query. If nothing clears the floor, the engine
says it could not find support rather than inventing an answer, and low-confidence answers carry a
visible badge. Every answer reports its confidence, its intent and its latency.

## The night modes

Four night themes and one day theme, each with its own backdrop implementation:

- **Aurora Mesh** — the signature. Additively composited aurora curtains over a parallax
  starfield whose brightness is driven by the engine's activity bus: the sky literally brightens
  while the model thinks and settles when it stops.
- **Abyssal Bioluminescence** — depth-sorted plankton drifting in dark water. Each streamed token
  makes nearby organisms flare.
- **Phosphor CRT** — monochrome green phosphor drawn entirely in CSS: scanlines, aperture grille,
  a slow refresh band, flicker, barrel vignette and afterglow.
- **Eclipse Obsidian** — true `#000` for OLED, with a single slowly rotating solar corona as the
  only light source.
- **Daylight** — low-glare cool white, used by **Auto** between your local sunrise and sunset
  (computed from solar position, refined by geolocation on request, estimated from your timezone
  otherwise).

Accent colour, motion (full / reduced / off) and density (cosy / compact) are independent axes.
The theme is applied by an inline script in `index.html` before first paint, so a night theme never
flashes white on load. `prefers-reduced-motion` is respected by default.

## Installable and offline

The app ships a web app manifest and a service worker, registered only in production builds so it
can never cache a dev-server module. The worker precaches the shell, serves hashed assets
cache-first, falls back to the cached shell for navigations when the network is gone, and passes
everything else through untouched — provider API calls, streams and WebSockets are never
intercepted. Install it from the browser's address bar and it opens offline as its own window.

## Privacy and persistence

Conversations, documents, embeddings, saved renders and preferences live in IndexedDB and
localStorage under this origin. Embeddings are persisted with their chunks, so a reload rehydrates
the index without re-embedding. No network call is made unless you configure a provider — and then
only your prompt, the retrieved context and the conversation history go to the base URL you chose.
Settings → Data shows live storage usage and exports or erases everything.

## Tests

`npm test` typechecks the whole tree and then runs `tests/smoke.tsx`, which mounts the real `<App/>`
in jsdom against `fake-indexeddb` and drives it like a user: it switches every view, sends a chat
turn and asserts the arithmetic answer (`12% of 4860 + √2025 = 628.2`) and its tool card, asks a
RAG question and asserts citations arrive with relevance scores, runs the retrieval tester, the code
analyser, the art renderer (checking the render stats overlay), an agent plan and report, every
theme including the CRT overlay, the settings diagnostics, and the command palette — finishing by
reading the conversation back out of IndexedDB. It also checks the extended pack is indexed and
labelled as knowledge rather than as a user document, toggles it off and on through the real
Settings switch, imports a library fixture and confirms it is retrievable, and verifies the shipped
manifest and service worker. 79 assertions, all passing.

The scratch harnesses under `.scratch/` (gitignored) cover the maths parser, unit conversion,
markdown safety, the highlighter, the retrieval benchmark, the extended-pack ablation study and
solar day-length accuracy. `bench3`/`e2e` are the scripts that decided the pack's default: they
measure top-citation accuracy with the pack off and on, including the effect on questions the core
corpus already answered.
