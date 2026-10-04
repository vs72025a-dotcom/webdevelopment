/**
 * The extended knowledge pack.
 *
 * The core corpus in `knowledge.ts` is deliberately small and about *this app*
 * first. This pack is the long tail: sixty entries of durable, checkable
 * material across machine learning systems, the web platform, security,
 * distributed data and science. It is indexed on top of the core corpus so the
 * engine has something real to cite instead of refusing, and it can be switched
 * off from Settings → Engine for people who want answers drawn only from their
 * own documents.
 *
 * Every entry is written to be self-contained and factual, because the engine
 * quotes these sentences verbatim as its answer.
 */

import type { KnowledgeEntry } from './knowledge';

export type PackGroupId = 'ml' | 'web' | 'sec' | 'sys' | 'sci' | 'life';

/** A pack entry knows which group it belongs to, so Settings can break it down. */
export interface PackEntry extends KnowledgeEntry {
  group: PackGroupId;
}

export interface PackGroup {
  id: string;
  label: string;
  blurb: string;
}

export const PACK_GROUPS: PackGroup[] = [
  { id: 'ml', label: 'Machine learning systems', blurb: 'Training, serving and evaluating models in practice' },
  { id: 'web', label: 'Web platform', blurb: 'Rendering, storage, performance and accessibility' },
  { id: 'sec', label: 'Security & cryptography', blurb: 'Authentication, transport and the classic web attacks' },
  { id: 'sys', label: 'Systems & data', blurb: 'Complexity, storage engines, distribution and caching' },
  { id: 'sci', label: 'Science & computing', blurb: 'Physics, biology and the machinery under your code' },
  { id: 'life', label: 'Practical life', blurb: 'Sleep, money, training, negotiation and notes' },
];

export const KNOWLEDGE_PACK: PackEntry[] = [
  // ─────────────────────────────── machine learning systems ───────────────────────────────
  {
    id: 'p-finetune-vs-prompt',
    title: 'Fine-tuning versus prompting',
    tags: ['fine tuning', 'finetune', 'prompting', 'adaptation', 'when to fine tune'],
    group: 'ml',
    body: `Prompting changes behaviour without touching weights, and it is the right first move because it is instant, free and reversible. Fine-tuning continues training a pre-trained model on your own examples, which is worth it when you must teach a format or style the model cannot be talked into, when you need to shrink a prompt that is padding every request, or when a smaller tuned model is cheaper than a larger prompted one. Fine-tuning is poor at adding fresh facts; retrieval handles knowledge, while tuning handles behaviour. Most teams should exhaust prompt engineering and retrieval first, then run a supervised fine-tune on a few thousand high-quality examples, and evaluate against the un-tuned baseline before shipping.`,
  },
  {
    id: 'p-lora',
    title: 'LoRA and QLoRA adapters',
    tags: ['lora', 'qlora', 'peft', 'adapter', 'low rank adaptation', 'fine tuning'],
    group: 'ml',
    body: `Low-Rank Adaptation freezes the original weights and learns two small matrices whose product is added to the output of each target layer. With rank 8 to 64 that is well under one percent of the parameters, so a 7B model can be tuned on a single consumer GPU and the adapter ships as a file of tens of megabytes. QLoRA goes further: it quantises the frozen base model to 4-bit, usually NF4, and keeps the adapters in bfloat16, cutting memory roughly fourfold with a small quality cost. At inference an adapter can be merged back into the base weights for zero overhead, or left separate so one server can swap many adapters against one shared base.`,
  },
  {
    id: 'p-quantization',
    title: 'Model quantisation',
    tags: ['quantization', 'quantisation', 'int8', 'int4', 'gguf', 'gptq', 'awq', 'compression'],
    group: 'ml',
    body: `Quantisation stores weights, and sometimes activations, at lower precision. Going from 16-bit to 8-bit typically halves memory with almost no measurable quality loss; 4-bit halves it again and is usually acceptable, though degradation shows up first in reasoning, arithmetic and rare languages rather than in fluent prose. Post-training methods such as GPTQ and AWQ choose per-channel or per-group scales from a small calibration set, while GGUF's k-quants mix precisions per tensor and are popular for local CPU and GPU inference. Outliers matter: a handful of very large activation values can wreck naive per-tensor scaling, which is why keeping outliers in higher precision, or using rotation-based methods like QuaRot, helps so much.`,
  },
  {
    id: 'p-tokenization',
    title: 'Tokenisation and byte-pair encoding',
    tags: ['tokenizer', 'tokenization', 'bpe', 'vocabulary', 'tokens', 'context'],
    group: 'ml',
    body: `Language models do not read characters or words; they read tokens produced by a subword algorithm. Byte-pair encoding starts from single bytes and repeatedly merges the most frequent adjacent pair, building a vocabulary of tens of thousands of pieces. Frequent words become one token, rare words split into several, and because coverage is over bytes, any input can be encoded, including emoji and unseen scripts. This explains why models miscount letters, why a trailing space changes a token, and why the same sentence costs different numbers of tokens in English and in a language that is under-represented in the training data. Pricing, context limits and latency are all measured in tokens, not words.`,
  },
  {
    id: 'p-context-window',
    title: 'Context windows and long-context limits',
    tags: ['context window', 'context length', 'long context', 'lost in the middle', 'kv cache'],
    group: 'ml',
    body: `The context window is the maximum number of tokens a model can condition on at once: prompt, retrieved documents, conversation history and its own reply. Attention cost grows with the square of the sequence length, and the key-value cache grows linearly, so long contexts are expensive in both compute and memory. Quality is not uniform across the window either; recall is strongest at the beginning and end, an effect known as lost in the middle, so the most relevant evidence belongs at the start, immediately before the question, or both. RoPE scaling, sliding-window attention, ring attention and retrieval-based selection are the common ways to serve long inputs without simply paying for them.`,
  },
  {
    id: 'p-sampling',
    title: 'Sampling parameters',
    tags: ['temperature', 'top p', 'top k', 'sampling', 'determinism', 'seed', 'repetition penalty'],
    group: 'ml',
    body: `Generation samples from a probability distribution over the next token, and the sampling parameters change its shape. Temperature divides the logits: zero is greedy and fully deterministic, around 0.2 to 0.4 suits extraction and code, and 0.8 to 1.1 suits brainstorming. Top-k keeps the k most likely tokens and top-p keeps the smallest set whose probabilities sum to p, typically 0.9; use one, not both, to avoid double truncation. A repetition penalty discourages tokens already present. Even at temperature zero, output can differ between runs because floating-point reduction order and batching vary, so treat determinism as a goal rather than a guarantee and pin a seed where the API supports one.`,
  },
  {
    id: 'p-embedding-models',
    title: 'Embedding models and similarity',
    tags: ['embeddings', 'similarity', 'cosine', 'dot product', 'cross encoder', 'bi encoder'],
    group: 'ml',
    body: `An embedding maps text to a vector so that meaning becomes geometry. Bi-encoders embed the query and the documents independently, which allows pre-computation and fast approximate search; cross-encoders read the query and document together and are far more accurate but cannot be pre-computed, so they are used to re-rank a shortlist of perhaps fifty candidates. Cosine similarity ignores magnitude and is the default for normalised vectors, where it equals the dot product; un-normalised dot products also reward length. Matryoshka embeddings are trained so that the first 256 or 512 dimensions of a 1536-dimension vector remain useful, letting you trade recall for storage. Always evaluate an embedding model on your own queries rather than trusting a leaderboard.`,
  },
  {
    id: 'p-vector-db',
    title: 'Vector indexes and hybrid search',
    tags: ['vector database', 'hnsw', 'ivf', 'product quantization', 'ann', 'hybrid search', 'rerank'],
    group: 'ml',
    body: `Exact nearest-neighbour search over a million vectors means a million similarity computations, so production systems use approximate indexes. HNSW builds a navigable small-world graph with a tunable efSearch parameter balancing recall against latency; IVF clusters vectors and probes only the nearest cells; product quantisation compresses vectors into short codes to fit memory, at some cost in recall. Roughly ten thousand vectors fit comfortably in a flat exact index, which is why a browser app can brute-force without embarrassment. Pure vector search is weak on names, error codes and rare acronyms, so most good retrieval systems run a lexical search such as BM25 alongside it and merge the two rankings, then re-rank the top candidates.`,
  },
  {
    id: 'p-rag-chunking',
    title: 'Chunking and query rewriting for retrieval',
    tags: ['chunking', 'overlap', 'chunk size', 'query rewriting', 'hyde', 'retrieval quality'],
    group: 'ml',
    body: `Retrieval quality is decided mostly before the model is involved. Chunks of roughly 300 to 800 tokens with 10 to 20 percent overlap keep a single idea intact while staying small enough for the embedding to be specific; fixed character splits cut sentences in half and lose meaning, so split on paragraphs and headings first. Prepending the document title or section path to each chunk gives the embedding context it otherwise lacks. Query rewriting closes the vocabulary gap between how users ask and how documents are written: expand acronyms, add synonyms, generate a hypothetical answer and embed that, or ask the model for three paraphrases and search all of them. Then re-rank the merged results; the first stage should optimise recall, the second precision.`,
  },
  {
    id: 'p-hallucination-mitigation',
    title: 'Reducing hallucination',
    tags: ['hallucination', 'grounding', 'citations', 'abstention', 'verification'],
    group: 'ml',
    body: `Hallucination is fluent output that is not supported by any source. Mitigations stack. Ground the model in retrieved passages and require it to cite the passage for each claim, so an unsupported sentence is visible rather than hidden inside a confident paragraph. Give it permission to abstain, and make abstention the cheap path by instructing it to answer only from context and say so when the context is silent. Constrain decoding with a schema or a grammar where the output must be structured. Verify afterwards: check that every citation exists, that quoted spans really appear in the source, and that numbers in the answer match numbers in the evidence. Finally, calibrate: a model that reports low confidence on weak evidence is more useful than one that never does.`,
  },
  {
    id: 'p-rlhf-dpo',
    title: 'RLHF, DPO and preference tuning',
    tags: ['rlhf', 'dpo', 'preference', 'alignment', 'ppo', 'reward model'],
    group: 'ml',
    body: `Preference tuning turns human comparisons into a training signal. In classic reinforcement learning from human feedback, annotators rank candidate responses, a reward model is trained on those rankings, and policy optimisation, usually PPO with a KL penalty to stay near the reference model, maximises the reward. Direct Preference Optimization removes the reward model and the RL loop entirely: it is a supervised loss on pairs of preferred and rejected responses that implicitly optimises the same objective, which is simpler and far more stable to run. Variants such as IPO, KTO and ORPO adjust the loss or drop the reference model. All of them shape style, safety and helpfulness; none of them reliably add new knowledge.`,
  },
  {
    id: 'p-diffusion',
    title: 'Diffusion models',
    tags: ['diffusion', 'stable diffusion', 'denoising', 'latent', 'sampler', 'image generation', 'cfg'],
    group: 'ml',
    body: `Diffusion models learn to reverse a noising process. Training adds Gaussian noise to an image over a thousand steps and teaches a network to predict the noise that was added; generation starts from pure noise and removes it step by step, which is why the same prompt with a different seed gives a different picture. Latent diffusion does the same in the compressed latent space of a variational autoencoder, which is what makes high-resolution generation affordable on consumer hardware, and a text encoder such as CLIP conditions each denoising step on the prompt. Classifier-free guidance interpolates between conditional and unconditional predictions; higher guidance follows the prompt more literally at the cost of variety and sometimes contrast. Samplers trade steps for quality.`,
  },
  {
    id: 'p-multimodal',
    title: 'Multimodal models',
    tags: ['multimodal', 'vision language', 'clip', 'speech', 'tts', 'transcription', 'audio'],
    group: 'ml',
    body: `Multimodal models put different media into one shared representation. CLIP is the canonical example: image and text encoders are trained contrastively so that a picture and its caption land near each other, which enables zero-shot classification and image search without any labels. Vision-language models go further by feeding image patches, projected into the language model's embedding space, alongside text tokens, so the model can answer questions about a screenshot or a chart. Speech systems split into automatic speech recognition, which maps audio to text, and text-to-speech, which synthesises waveform or codec tokens. The browser exposes both through the Web Speech API, and WebGPU is making local inference of small vision and speech models practical.`,
  },
  {
    id: 'p-distillation',
    title: 'Distillation, pruning and speculative decoding',
    tags: ['distillation', 'pruning', 'sparsity', 'speculative decoding', 'efficiency', 'inference'],
    group: 'ml',
    body: `Three complementary ways to make inference cheaper. Distillation trains a small student to match a large teacher's output distribution, not just its hard labels, which transfers the teacher's dark knowledge about near-miss answers; the student can be several times smaller with most of the quality. Pruning removes weights or whole attention heads that matter least, often structured so the result is actually faster on real hardware rather than merely sparser. Speculative decoding attacks latency instead of size: a small draft model proposes several tokens, the large model verifies them in one parallel pass, and accepted tokens are free, giving two to three times the throughput at identical output distribution.`,
  },
  {
    id: 'p-prompt-injection',
    title: 'Prompt injection',
    tags: ['prompt injection', 'jailbreak', 'security', 'untrusted input', 'guardrails'],
    group: 'ml',
    body: `Prompt injection is the SQL injection of language models: untrusted text, such as a web page, an email or a retrieved document, contains instructions the model then follows. Direct injection is a user typing an override; indirect injection hides the instruction in content the model reads on the user's behalf, which is what makes tool-using agents dangerous, because the injected text can ask the agent to exfiltrate data or call a destructive tool. There is no complete fix at the prompt layer. Practical defences are architectural: treat model output as untrusted input, never let retrieved text grant new authority, require explicit confirmation for state-changing tools, restrict what credentials the agent holds, delimit and label untrusted spans so the model can tell data from instructions, and log every tool call.`,
  },
  {
    id: 'p-eval',
    title: 'Evaluating model output',
    tags: ['evaluation', 'evals', 'benchmark', 'regression', 'llm as judge', 'testing'],
    group: 'ml',
    body: `An eval is a test suite for behaviour that has no single correct answer. Build a set of real inputs with reference answers or graded rubrics, keep a held-out slice you never tune against, and run it on every prompt, model or retrieval change, because these systems regress silently. Exact match and F1 work for extraction; for generation use pairwise comparison, human grading or a model judge with a detailed rubric. Judges are cheap and correlate reasonably with humans, but they carry position and verbosity biases, so randomise the order of compared answers, ask for a reason before the score, and spot-check against human labels. Track cost and latency in the same table as quality, and report confidence intervals rather than single numbers.`,
  },

  // ─────────────────────────────── web platform ───────────────────────────────
  {
    id: 'p-http-caching',
    title: 'HTTP caching',
    tags: ['cache control', 'etag', 'caching', 'browser cache', 'stale while revalidate'],
    group: 'web',
    body: `Caching is negotiated with headers. Cache-Control: max-age sets freshness in seconds; immutable tells the browser never to revalidate a URL, which is safe when the filename contains a content hash; no-store forbids caching entirely; private keeps a response out of shared proxies. Once a response is stale, ETag or Last-Modified enables revalidation, and a 304 Not Modified costs a round trip but no body. Stale-while-revalidate serves the stale copy immediately and refreshes in the background, which hides latency from the user, and stale-if-error serves it when the origin is down. The standard recipe is a short max-age on HTML, plus one-year immutable caching on hashed asset filenames.`,
  },
  {
    id: 'p-core-web-vitals',
    title: 'Core Web Vitals',
    tags: ['performance', 'lcp', 'inp', 'cls', 'web vitals', 'speed'],
    group: 'web',
    body: `Core Web Vitals measure what users actually feel. Largest Contentful Paint times the biggest visible element, and the good threshold is 2.5 seconds; the usual culprits are a slow server response, render-blocking CSS, and hero images without width and height or without preload. Interaction to Next Paint replaces First Input Delay and measures the worst interaction latency up to 200 milliseconds, dominated by long tasks, so break work into chunks and yield. Cumulative Layout Shift scores unexpected movement, and the target is 0.1; always set dimensions on images, iframes and ads, and never inject content above the fold. Measure in the field with the web-vitals library, because lab numbers under Lighthouse rarely match real devices.`,
  },
  {
    id: 'p-event-loop',
    title: 'The JavaScript event loop',
    tags: ['event loop', 'javascript', 'microtask', 'async', 'promise', 'rendering'],
    group: 'web',
    body: `JavaScript runs on one thread with an event loop. Each turn takes one macrotask, such as a timer callback or a message, runs it to completion, then drains the entire microtask queue, which is where promise callbacks and queueMicrotask land, and only then may the browser style, lay out and paint. Microtasks added while draining are processed in the same turn, so a recursive promise loop starves rendering and can lock the tab. requestAnimationFrame callbacks run before paint in a rendering opportunity, and setTimeout with zero delay still waits for the next turn. A long macrotask blocks everything, which is why heavy parsing or hashing belongs in a worker rather than in an event handler.`,
  },
  {
    id: 'p-react-rendering',
    title: 'How React renders',
    tags: ['react', 'reconciliation', 'virtual dom', 'keys', 'memo', 'hooks', 'state'],
    group: 'web',
    body: `React keeps a tree of elements and, on a state change, re-renders the affected component and everything below it in the tree, producing a new element tree that is diffed against the previous one, and only the differences are applied to the DOM. Keys tell the diff which children are the same item across renders; using an array index as a key breaks that identity when the list reorders and causes state to jump between rows. State updates are batched within a turn and are shallow-merged for objects, so updater functions are the safe way to derive new state from old. Memoisation with memo and useMemo skips work only when props are referentially equal, which is why callbacks need useCallback to survive a memo boundary.`,
  },
  {
    id: 'p-browser-storage',
    title: 'Browser storage options',
    tags: ['indexeddb', 'localstorage', 'cache api', 'opfs', 'quota', 'storage'],
    group: 'web',
    body: `localStorage stores a few megabytes of strings, is synchronous, and blocks the main thread, so it suits small preferences only. IndexedDB is an asynchronous transactional store that can hold hundreds of megabytes, supports indexes, cursors and binary values, and is the right home for structured records such as conversations and vectors. The Cache API stores request and response pairs for service workers, and the Origin Private File System provides a real file hierarchy for large binaries with synchronous access inside a worker. Quotas are per-origin and typically a share of free disk; navigator.storage.estimate reports usage and quota, and persistent storage, requested with navigator.storage.persist, is exempt from automatic eviction under pressure.`,
  },
  {
    id: 'p-web-workers',
    title: 'Web Workers and offloading',
    tags: ['web worker', 'worker', 'off main thread', 'wasm', 'transferable'],
    group: 'web',
    body: `A worker runs JavaScript on its own thread with no access to the DOM, communicating by message passing. Anything CPU-heavy belongs there: parsing large files, computing embeddings, image processing, or running WebAssembly. Structured-clone copies most values, but ArrayBuffer can be transferred instead, which moves ownership with no copy, and SharedArrayBuffer allows true sharing when cross-origin isolation headers are present. Workers are the only place to get reliable parallelism in the browser, and they also unlock OffscreenCanvas for rendering off the main thread. Keep the message protocol coarse: one message with a batch of work costs far less than a thousand tiny messages.`,
  },
  {
    id: 'p-webgpu',
    title: 'WebGPU and WebGL',
    tags: ['webgpu', 'webgl', 'shader', 'compute', 'gpu', 'canvas'],
    group: 'web',
    body: `WebGL exposes an OpenGL ES-like pipeline with vertex and fragment shaders only. WebGPU is the modern successor: it maps to Vulkan, Metal and Direct3D 12, has explicit pipelines, bind groups and command buffers, supports compute shaders with storage buffers, and greatly reduces driver overhead through render bundles and parallel command encoding. For visual effects on a page, WebGL is still smaller and universally supported; WebGPU is worth it for compute, for large numbers of draw calls, and for running small neural networks locally. Both draw into a canvas, and shader code is written in WGSL for WebGPU versus GLSL for WebGL.`,
  },
  {
    id: 'p-http3',
    title: 'HTTP/2 and HTTP/3',
    tags: ['http2', 'http3', 'quic', 'tcp', 'head of line', 'protocol'],
    group: 'web',
    body: `HTTP/1.1 sends one request at a time per connection, so browsers opened six connections per origin. HTTP/2 multiplexes many streams over one TCP connection, compresses headers with HPACK and supports server push, but a single lost packet still stalls every stream because TCP delivers bytes in order. HTTP/3 replaces TCP with QUIC over UDP, giving each stream independent delivery so a loss blocks only its own stream, and it folds the TLS 1.3 handshake into the transport so a new connection takes one round trip and a resumption can take zero. QUIC also survives network changes, which is why it is popular on mobile, where addresses change between Wi-Fi and cellular.`,
  },
  {
    id: 'p-cors',
    title: 'CORS explained',
    tags: ['cors', 'cross origin', 'preflight', 'same origin', 'fetch'],
    group: 'web',
    body: `Browsers enforce the same-origin policy: a page may read responses only from its own origin. CORS loosens that by letting the server opt in with Access-Control-Allow-Origin. A simple request, roughly GET or POST with safe headers, is sent directly and the browser withholds the response unless the headers permit it. Anything else triggers a preflight OPTIONS request carrying Access-Control-Request-Method, and the server must answer with the allowed method, headers and origin before the real request is sent. Credentials require an explicit origin rather than a wildcard and Access-Control-Allow-Credentials: true. Errors are deliberately vague in JavaScript, so the detail is always in the network panel, and the server is what must change, never the client.`,
  },
  {
    id: 'p-csp',
    title: 'Content Security Policy',
    tags: ['csp', 'content security policy', 'xss', 'security header', 'nonce'],
    group: 'web',
    body: `A Content Security Policy is an allowlist of where a page may load code and data from, and it is the strongest practical defence after escaping. A strict policy uses a per-response nonce or a hash for the few inline scripts that are genuinely needed, forbids unsafe-inline and eval, restricts script-src, img-src and connect-src to known origins, and sets frame-ancestors to prevent clickjacking. object-src 'none' and base-uri 'self' close two classic holes. Roll it out with Content-Security-Policy-Report-Only first, collect violations at a report-uri or report-to endpoint, then enforce. Trusted Types goes further, making the DOM sinks that convert strings to HTML refuse untyped input.`,
  },
  {
    id: 'p-service-workers',
    title: 'Service workers and offline apps',
    tags: ['service worker', 'offline', 'pwa', 'cache strategy', 'install'],
    group: 'web',
    body: `A service worker is a script that sits between the page and the network, so it can serve cached responses when offline. It has no DOM, lives on its own thread, and has a lifecycle: registration, installation where you precache the app shell, activation where you clean old caches, then fetch handling for every request the page makes. Common strategies are cache-first for hashed assets, network-first with a cache fallback for APIs, and stale-while-revalidate for content that must be fast and reasonably fresh. A new worker waits until every tab is closed unless you call skipWaiting and clients.claim, which is a trade: instant updates versus the risk of mixing asset versions. Serve the worker from the origin root and over HTTPS.`,
  },
  {
    id: 'p-accessibility',
    title: 'Web accessibility',
    tags: ['accessibility', 'a11y', 'wcag', 'aria', 'screen reader', 'focus', 'contrast'],
    group: 'web',
    body: `Accessibility is mostly about using the right element. A button that is a div needs role, tabindex, key handling and focus styling, while a real button has all of that already, so the first rule of ARIA is not to use ARIA. Every interactive element must be reachable by keyboard in a sensible order and show a visible focus ring; focus must move into a dialog and return to the trigger when it closes. Text needs a contrast ratio of at least 4.5 to 1 for body copy and 3 to 1 for large text. Images need alt text that conveys purpose, decorative ones need empty alt, and form fields need real labels rather than placeholder text. Announce dynamic changes with a polite live region, and honour prefers-reduced-motion.`,
  },

  // ─────────────────────────────── security & cryptography ───────────────────────────────
  {
    id: 'p-hash-vs-encrypt',
    title: 'Hashing versus encryption',
    tags: ['hash', 'encryption', 'hashing', 'sha256', 'hmac', 'salt', 'one way'],
    group: 'sec',
    body: `Hashing is one-way and fixed-length: any input maps to a digest, and you cannot go back. Encryption is reversible with a key. Hashing answers "is this the same as before?" and encryption answers "can only the holder read this?". A salt, unique per user, is stored alongside the hash so identical passwords do not produce identical digests and precomputed rainbow tables stop working; a pepper is a secret key mixed in and kept outside the database. For integrity and authentication use an HMAC, which is a keyed hash, rather than a bare digest, because plain SHA-256 of a message can be recomputed by anyone. Modern general-purpose hashes are SHA-256 and BLAKE3; for passwords use a deliberately slow memory-hard function instead.`,
  },
  {
    id: 'p-password-storage',
    title: 'Storing passwords safely',
    tags: ['password', 'argon2', 'bcrypt', 'scrypt', 'salt', 'credential'],
    group: 'sec',
    body: `Passwords must be stored with a slow, salted, memory-hard key-derivation function. Argon2id is the current recommendation, with parameters tuned so one hash takes roughly 50 to 100 milliseconds on your hardware and needs tens of megabytes; bcrypt with a cost of at least 10 and scrypt with large N are acceptable, while plain SHA-256 or MD5 are not, because a GPU can try billions per second. Never truncate or cap password length below 64 characters, never silently strip whitespace, and check new passwords against a breach corpus. Compare digests with a constant-time function to avoid timing leaks, and add a second factor. If the hash database leaks, the cost function is the only thing standing between the attacker and the plaintext.`,
  },
  {
    id: 'p-web-attacks',
    title: 'XSS, CSRF and SSRF',
    tags: ['xss', 'csrf', 'ssrf', 'injection', 'web security', 'attack'],
    group: 'sec',
    body: `Cross-site scripting injects executable content into a page that other users load, stealing sessions or acting as them. The fix is contextual output encoding, a Content Security Policy, and never interpolating user input into HTML, attributes, URLs or script. Cross-site request forgery makes a logged-in user's browser send a state-changing request to your site; the defences are SameSite=Lax or Strict cookies, a token that only your origin can read, and requiring re-authentication for sensitive actions. Server-side request forgery tricks your server into fetching an attacker-chosen URL, reaching internal metadata services or private networks; block private address ranges, allowlist destinations, never follow redirects blindly, and use a dedicated egress proxy.`,
  },
  {
    id: 'p-oauth',
    title: 'OAuth 2.0 and OpenID Connect',
    tags: ['oauth', 'oidc', 'pkce', 'authorization code', 'scopes', 'login'],
    group: 'sec',
    body: `OAuth 2.0 is an authorization framework: it lets a user grant an application limited access to a resource without sharing a password, and the result is an access token. OpenID Connect adds an identity layer on top, returning an ID token that says who the user is. The authorization code flow exchanges a short-lived code for tokens at the token endpoint, and for public clients such as single-page apps and mobile apps it must use PKCE, where the client sends a hash of a random verifier up front and the verifier itself when redeeming the code, which stops an intercepted code from being useful. Keep access tokens short-lived, store refresh tokens where scripts cannot read them, request the narrowest scopes that work, and treat the implicit flow and the resource-owner password grant as legacy.`,
  },
  {
    id: 'p-jwt',
    title: 'JSON Web Tokens',
    tags: ['jwt', 'token', 'claims', 'signature', 'session'],
    group: 'sec',
    body: `A JSON Web Token is three base64url parts: a header naming the algorithm, a payload of claims, and a signature over the first two. Because the payload is only encoded, never encrypted, it must not contain secrets. The signature guarantees integrity and, for asymmetric algorithms, who issued it, so a server can verify a token without a database lookup, which is why JWTs suit stateless services. The catch is revocation: a valid token stays valid until it expires, so keep lifetimes short, use refresh tokens, and maintain a denylist for the rare forced logout. Always verify the algorithm rather than trusting the header, reject none, and compare issuer, audience and expiry claims.`,
  },
  {
    id: 'p-tls',
    title: 'TLS and certificate trust',
    tags: ['tls', 'https', 'certificate', 'handshake', 'encryption in transit'],
    group: 'sec',
    body: `TLS protects data in transit with a handshake that authenticates the server and agrees on keys. In TLS 1.3 the client sends a key share and supported parameters, the server replies with its certificate and its own share, both derive the same secret with ephemeral Diffie-Hellman, and everything after that is encrypted with AEAD ciphers such as AES-GCM or ChaCha20-Poly1305, giving forward secrecy because the ephemeral keys are discarded. The certificate binds a public key to a name and is signed by a certificate authority, and the browser trusts it only if the chain reaches a root it already trusts, the name matches, and the dates are valid. Cipher suites that are not AEAD, such as CBC with MAC-then-encrypt, are legacy and should be disabled.`,
  },
  {
    id: 'p-2fa',
    title: 'Two-factor authentication and passkeys',
    tags: ['2fa', 'mfa', 'totp', 'passkey', 'webauthn', 'phishing'],
    group: 'sec',
    body: `A second factor should be something you have or are, not another password. SMS codes are better than nothing but are vulnerable to SIM swapping and interception. Time-based one-time passwords, computed from a shared secret and the current 30-second window, are a solid step up, though a real-time phishing proxy can still relay them. WebAuthn passkeys are the strongest common option: the private key never leaves the authenticator, the browser signs a challenge bound to the origin, and because the signature is origin-bound, a lookalike domain cannot reuse it, which makes passkeys inherently phishing resistant. Offer passkeys first, TOTP second, SMS last, and give every account recovery codes that are single-use.`,
  },
  {
    id: 'p-supply-chain',
    title: 'Software supply chain risk',
    tags: ['supply chain', 'dependencies', 'lockfile', 'sbom', 'typosquatting', 'audit'],
    group: 'sec',
    body: `Most of the code you ship was written by someone else, so the attack surface includes your dependency tree. Typosquatting registers a name one character away from a popular package, and dependency confusion publishes a public package with the same name as an internal one, hoping a misconfigured resolver picks it up. Defences: commit the lockfile and install from it in CI so builds are reproducible, pin or at least floor versions and review diffs on upgrade, disable install scripts where the ecosystem allows, scan for known vulnerabilities, generate a software bill of materials so you can answer "are we affected?" in minutes, and prefer packages with few transitive dependencies. A dependency is a permanent liability, not just a one-time convenience.`,
  },

  // ─────────────────────────────── systems & data ───────────────────────────────
  {
    id: 'p-big-o',
    title: 'Big-O notation',
    tags: ['big o', 'complexity', 'algorithm', 'performance', 'asymptotic'],
    group: 'sys',
    body: `Big-O describes how cost grows with input size, ignoring constants and lower-order terms. Constant, logarithmic and linear are comfortable; n log n is the floor for comparison sorting; quadratic is fine to a few thousand items and then painful; exponential is only viable with pruning or tiny inputs. Amortised analysis describes the average over a sequence of operations, which is how a dynamic array can append in constant time even though resizing occasionally costs linear time. Constants still matter in practice: at n equals 50, a clean O(n squared) loop can beat a cache-hostile O(n log n) structure, and the fastest algorithm you can write is often the one that does not allocate.`,
  },
  {
    id: 'p-hash-tables',
    title: 'Hash tables',
    tags: ['hash table', 'hashmap', 'collision', 'load factor', 'open addressing'],
    group: 'sys',
    body: `A hash table maps a key to a bucket with a hash function, giving average constant-time lookup. Collisions are resolved by chaining, where each bucket holds a list, or by open addressing, where a probe sequence finds the next free slot; open addressing is more cache friendly but degrades sharply as the table fills, so it is kept below a load factor of about 0.7 and resized by doubling and rehashing. A poor hash function that maps many keys to few buckets turns every operation into a linear scan, and if an attacker can choose keys, as in a web form, they can force that deliberately, which is why hash-flooding protection seeds the hash per process. Iteration order is unspecified in most implementations.`,
  },
  {
    id: 'p-btree-lsm',
    title: 'B-trees and LSM trees',
    tags: ['b tree', 'lsm tree', 'sstable', 'database', 'storage engine', 'compaction'],
    group: 'sys',
    body: `B-trees keep sorted keys in pages with a high branching factor, so a lookup touches only three or four pages; updates modify pages in place and are fast and predictable, which suits read-heavy transactional workloads. Log-structured merge trees buffer writes in memory, flush them to immutable sorted files, and merge files in the background; writes are sequential and very fast, but reads must check several levels, so engines keep a Bloom filter per file to skip irrelevant ones, and compaction must be tuned or write amplification and space amplification get out of hand. PostgreSQL and MySQL use B-trees; Cassandra, RocksDB, LevelDB and most modern key-value stores use LSM trees.`,
  },
  {
    id: 'p-cap',
    title: 'CAP, PACELC and consistency',
    tags: ['cap theorem', 'consistency', 'availability', 'partition', 'quorum', 'eventual consistency'],
    group: 'sys',
    body: `The CAP theorem says that when a network partition occurs, a distributed system must choose consistency, meaning every node refuses to answer rather than return stale data, or availability, meaning every node answers but may return stale data. Partitions are not optional, so the real design question is what to do when they happen. PACELC extends this: else, when the system is running normally, there is still a trade between latency and consistency, because agreeing across regions costs round trips. Practical systems pick a point on a spectrum from linearisable through sequential and causal to eventual consistency, and quorums let you tune per operation by requiring reads and writes to overlap, as when R plus W exceeds N.`,
  },
  {
    id: 'p-idempotency',
    title: 'Idempotency and exactly-once delivery',
    tags: ['idempotency', 'retry', 'exactly once', 'at least once', 'duplicate', 'outbox'],
    group: 'sys',
    body: `Networks fail ambiguously: a request can succeed while the response is lost, so any retry may be a duplicate. Idempotency means applying an operation twice has the same effect as applying it once, which makes retries safe. The standard implementation is a client-generated idempotency key stored with the result, so a repeat request returns the stored response instead of charging the card again. True exactly-once delivery is impossible across a network; what you build instead is at-least-once delivery plus idempotent handling, which is functionally once. For side effects that span a database and a queue, write the event in the same transaction as the state change and publish it from a relay, the transactional outbox pattern, rather than trying to commit to both at once.`,
  },
  {
    id: 'p-backpressure',
    title: 'Backpressure, rate limiting and circuit breakers',
    tags: ['backpressure', 'rate limit', 'circuit breaker', 'queue', 'overload', 'timeout'],
    group: 'sys',
    body: `Every queue is a buffer for a mismatch between arrival and service rate, and an unbounded queue turns overload into unbounded latency and then memory exhaustion. Backpressure pushes the signal upstream: refuse, slow down, or shed load explicitly, and always bound your queues. Rate limiting protects a service with a token bucket or sliding window, returning 429 with a Retry-After header so well-behaved clients back off. A circuit breaker stops calling a failing dependency after a threshold of errors, failing fast for a cooldown period, which prevents a thread pool from being consumed by requests that were going to fail anyway. Pair these with deadlines that propagate, so a request that has already timed out is not still being worked on downstream.`,
  },
  {
    id: 'p-crdt',
    title: 'CRDTs and operational transforms',
    tags: ['crdt', 'operational transform', 'collaboration', 'eventual consistency', 'conflict'],
    group: 'sys',
    body: `Collaborative editing needs concurrent changes to converge without a central lock. Operational transformation transforms each incoming operation against the ones already applied, which preserves intent but requires a central server to order operations and is notoriously tricky to get right. Conflict-free replicated data types instead design the data structure so merges are commutative, associative and idempotent: counters that keep per-replica increments, grow-only and two-phase sets, last-writer-wins registers with logical clocks, and sequence CRDTs whose characters carry unique identifiers and always sort the same way. CRDTs tolerate offline editing and peer-to-peer sync naturally, at the cost of metadata overhead and more complex garbage collection.`,
  },
  {
    id: 'p-caching-strategies',
    title: 'Cache strategies and invalidation',
    tags: ['caching', 'cache aside', 'invalidation', 'stampede', 'ttl', 'cdn'],
    group: 'sys',
    body: `Cache-aside, where the application checks the cache, misses, loads from the database and writes the value back, is the default because it is simple and only caches what is used. Write-through updates the cache in the same path as the write for consistency at the cost of latency; write-behind batches writes and risks loss. Invalidation is the hard part: prefer short time-to-live values plus explicit eviction on write, and remember that key namespaces are the only reliable way to invalidate a group. Two failure modes to design for are the stampede, where a popular key expires and thousands of requests hit the origin at once, solved by request coalescing or jittered expiry, and the cold start after a deploy, solved by warming the cache before taking traffic.`,
  },

  // ─────────────────────────────── science & computing ───────────────────────────────
  {
    id: 'p-gc',
    title: 'Garbage collection',
    tags: ['garbage collection', 'gc', 'memory', 'heap', 'reference counting'],
    group: 'sci',
    body: `Garbage collection reclaims memory that is no longer reachable. Tracing collectors start from roots such as the stack and globals, mark everything reachable, and sweep or compact the rest, which handles cycles correctly; reference counting frees as soon as a count hits zero but leaks cycles unless it also runs a cycle detector. Generational collectors exploit the weak generational hypothesis, that most objects die young, by collecting a small nursery frequently and promoting survivors. Pauses come from the work required, so modern collectors do most of it concurrently, and JavaScript engines like V8 use a mark-sweep-compact collector with incremental marking to keep pauses in the low milliseconds.`,
  },
  {
    id: 'p-jit',
    title: 'Compilers and JIT engines',
    tags: ['compiler', 'jit', 'interpreter', 'bytecode', 'inline cache', 'optimization'],
    group: 'sci',
    body: `A language toolchain typically lexes to tokens, parses to a syntax tree, lowers that to an intermediate representation, optimises, and emits bytecode or machine code. Interpreters run the intermediate form directly and start instantly; a just-in-time compiler watches which functions are hot, compiles them to machine code with type feedback gathered at runtime, and can then inline calls, unbox numbers and eliminate redundant checks. That speculation is what makes a dynamic language fast, and it is also why performance is workload dependent: if the assumed shape changes, the optimised code deoptimises and execution falls back to the interpreter until a new version is compiled, which is why object shapes should stay stable in hot loops.`,
  },
  {
    id: 'p-floating-point',
    title: 'Floating point and money',
    tags: ['floating point', 'ieee 754', 'precision', 'rounding', 'decimal', 'money'],
    group: 'sci',
    body: `IEEE 754 doubles store a sign, an 11-bit exponent and a 52-bit mantissa, representing about 15 to 17 significant decimal digits. Values that are not sums of negative powers of two, such as 0.1 and 0.2, are rounded, so their sum is 0.30000000000000004 rather than 0.3. Never compare floats with equality; compare the absolute or relative difference against a tolerance. Catastrophic cancellation happens when subtracting nearly equal large numbers, which destroys precision, so rearrange formulas to avoid it. For money, store integer minor units, such as paise or cents, or use a decimal type, and define an explicit rounding rule at each step, because rounding half-up repeatedly is not the same as rounding once at the end.`,
  },
  {
    id: 'p-regex-redos',
    title: 'Regular expressions and ReDoS',
    tags: ['regex', 'regexp', 'redos', 'backtracking', 'catastrophic'],
    group: 'sci',
    body: `Most regex engines backtrack: on failure they retry alternative paths, and a pattern with nested quantifiers such as (a+)+ against a long non-matching string can take exponential time, a denial-of-service vector known as ReDoS. Avoid nested quantifiers over overlapping character classes, prefer specific classes to dot-star, anchor patterns, and consider possessive quantifiers or atomic groups, which are not available in every engine. Linear-time engines based on finite automata, such as RE2 and Rust's regex crate, cannot backtrack and therefore cannot blow up. In JavaScript, keep user-supplied patterns away from the main thread, and remember that the global flag makes lastIndex stateful between calls.`,
  },
  {
    id: 'p-quantum',
    title: 'Quantum computing',
    tags: ['quantum', 'qubit', 'superposition', 'entanglement', 'shor', 'error correction'],
    group: 'sci',
    body: `A qubit is a two-level quantum system whose state is a superposition of zero and one with complex amplitudes, and measurement collapses it to a single classical bit with probabilities given by those amplitudes. Interference is the real resource: algorithms arrange phases so wrong answers cancel and right ones add up. Entanglement correlates qubits so that measuring one constrains the other, which underpins teleportation and many protocols. Shor's algorithm factors integers in polynomial time, which threatens RSA and Diffie-Hellman once machines are large enough, which is why post-quantum key exchange is being deployed now. The central engineering problem is decoherence: physical qubits are noisy, so thousands are needed to encode one reliable logical qubit through error correction.`,
  },
  {
    id: 'p-relativity',
    title: 'Special and general relativity',
    tags: ['relativity', 'einstein', 'time dilation', 'speed of light', 'gravity', 'gps'],
    group: 'sci',
    body: `Special relativity follows from two postulates: the laws of physics are the same in every inertial frame, and the speed of light in a vacuum is the same for every observer. Those force space and time to mix: moving clocks run slow by the Lorentz factor, moving lengths contract, and simultaneity is frame dependent. Mass and energy are equivalent through E equals m c squared. General relativity extends this to accelerating frames and gravity, treating gravity not as a force but as the curvature of spacetime produced by energy and momentum, with objects following the straightest available path. Because GPS satellites move fast and sit higher in Earth's gravitational well, their clocks drift about 38 microseconds per day relative to the ground and must be corrected, or positions would be off by kilometres.`,
  },
  {
    id: 'p-black-holes',
    title: 'Black holes',
    tags: ['black hole', 'event horizon', 'singularity', 'hawking radiation', 'gravity'],
    group: 'sci',
    body: `A black hole is a region where spacetime curvature is so extreme that nothing, including light, can escape from inside the event horizon, whose radius for a non-rotating black hole is the Schwarzschild radius, about 3 kilometres per solar mass. Stellar-mass black holes form when a massive star exhausts its fuel and its core collapses; supermassive ones, millions to billions of solar masses, sit at the centres of galaxies and likely grew through mergers and sustained accretion. Matter spiralling in forms a hot accretion disk radiating across the spectrum, and the 2019 Event Horizon Telescope image of M87 showed the shadow against that glow. Hawking radiation arises when quantum field fluctuations near the horizon produce one partner that escapes and one that falls in, giving a temperature inversely proportional to mass, so black holes evaporate, unimaginably slowly for large ones.`,
  },
  {
    id: 'p-crispr',
    title: 'CRISPR gene editing',
    tags: ['crispr', 'gene editing', 'cas9', 'dna', 'biotechnology', 'base editing'],
    group: 'sci',
    body: `CRISPR-Cas9 is an adaptive bacterial immune system repurposed as a programmable editor. A guide RNA of about 20 bases pairs with a matching DNA sequence, and the Cas9 nuclease cuts both strands there, after which the cell's own repair either disables the gene through error-prone non-homologous end joining or, with a supplied template, rewrites it through homology-directed repair. Base editors fuse a deaminase to a catalytically impaired Cas9 to change a single letter without cutting both strands, and prime editing writes short new sequences directly. Applications include sickle-cell disease, where editing a regulatory element restores foetal haemoglobin, and agricultural traits. Off-target edits and heritable changes raise serious ethical questions, which is why clinical work focuses on somatic cells.`,
  },

  // ─────────────────────────────── practical life ───────────────────────────────
  {
    id: 'p-sleep',
    title: 'Sleep and circadian rhythm',
    tags: ['sleep', 'circadian', 'melatonin', 'caffeine', 'rest', 'health'],
    group: 'life',
    body: `Sleep cycles through roughly 90-minute stages, deep slow-wave sleep dominating early in the night and REM later, so cutting the night short costs REM disproportionately. The circadian rhythm is set mainly by light: bright morning light advances the clock, and blue-rich light late in the evening delays it, which is why screens and lamps matter. Caffeine has a half-life of about five hours, so an afternoon coffee still leaves a quarter of its dose active at bedtime. Alcohol shortens the time to fall asleep but fragments the second half of the night. Consistent wake times, a cool dark room, and avoiding long late naps do more than any supplement; adults generally need seven to nine hours.`,
  },
  {
    id: 'p-compound-interest',
    title: 'Compound interest, loans and the rule of 72',
    tags: ['compound interest', 'loan', 'emi', 'apr', 'apy', 'mortgage', 'savings', 'finance'],
    group: 'life',
    body: `Compound interest pays returns on previous returns, so growth is exponential rather than linear. The rule of 72 estimates doubling time: divide 72 by the percentage annual return, so 8 percent doubles in about nine years. The annual percentage rate is the nominal rate, while the annual percentage yield includes compounding, which is why two loans with the same quoted rate can cost different amounts. A loan repayment installs a fixed monthly payment covering interest first and principal second, so in a long mortgage the early years are mostly interest and prepaying works best early. On debt, the highest-rate balance costs the most per rupee, so clearing it first is mathematically optimal, while the snowball method of clearing the smallest balance first works better for people who need the motivation.`,
  },
  {
    id: 'p-nutrition',
    title: 'Macronutrients and energy balance',
    tags: ['nutrition', 'protein', 'carbohydrate', 'fat', 'calories', 'fibre', 'diet'],
    group: 'life',
    body: `Energy balance decides weight change over time; macronutrient composition decides body composition and how you feel while getting there. Protein provides about 4 kilocalories per gram, carbohydrate 4, fat 9, and alcohol 7. Protein needs rise with training and age, roughly 1.6 to 2.2 grams per kilogram of body weight per day for people building muscle, spread across three or four meals, because each dose has a saturating effect on synthesis. Fat is needed for hormones and absorbing fat-soluble vitamins, so keep it around 20 to 35 percent of energy. Fibre, 25 to 35 grams a day, improves satiety and gut health. Micronutrients, hydration and sleep underpin all of it, and no single food is the problem or the solution.`,
  },
  {
    id: 'p-training',
    title: 'Strength training principles',
    tags: ['training', 'strength', 'hypertrophy', 'progressive overload', 'recovery', 'exercise'],
    group: 'life',
    body: `Muscle and strength adapt to a demand that exceeds what the body is used to, so the organising principle is progressive overload: add weight, repetitions or sets over time, and track it, because untracked training drifts. Hypertrophy responds well to roughly 10 to 20 hard sets per muscle group per week, taken within a few repetitions of failure, and similar growth occurs across a wide range of loads as long as effort is high. Maximal strength favours heavier loads of one to five repetitions with long rests. Protein intake and sleep are the limiting factors for recovery, and soreness is a poor proxy for a good session. Deload every four to eight weeks, keep technique stable, and prefer a program you will actually repeat.`,
  },
  {
    id: 'p-negotiation',
    title: 'Negotiation basics',
    tags: ['negotiation', 'salary', 'batna', 'conflict', 'agreement'],
    group: 'life',
    body: `Negotiation goes better when you separate positions from interests: the position is what someone asks for, the interest is why, and interests usually leave room for a creative trade. Know your BATNA, the best alternative to a negotiated agreement; it is the source of your leverage, and improving it before you talk is worth more than any tactic at the table. Anchor deliberately, since the first number shapes the range, and if the other side anchors absurdly, counter with a specific well-reasoned figure rather than a round one. Ask calibrated questions, let silence do work, and never trade a concession without naming what you get in return. Aim for the zone of possible agreement rather than victory, because a deal the other side resents will be renegotiated or quietly sabotaged.`,
  },
  {
    id: 'p-notes',
    title: 'Note-taking systems',
    tags: ['notes', 'zettelkasten', 'para', 'second brain', 'knowledge management'],
    group: 'life',
    body: `A note system earns its keep when you can find and reuse what you wrote. The Zettelkasten method keeps atomic notes, one idea per note, written in your own words, each linked to related notes so that structure emerges from links rather than folders. PARA organises by actionability instead: projects with a deadline, areas of ongoing responsibility, resources by topic, and an archive, which suits people who think in terms of current work. Progressive summarisation layers highlights over time, so a note becomes denser as it proves useful. Whichever you pick, write notes for your future self, record why the idea matters rather than only what it says, and keep an index note as the entry point; a system that is beautiful but unused is worth less than plain searchable text.`,
  },
];

/** Fast lookup by id, used by tests and the capability answers. */
export const PACK_BY_ID = new Map(KNOWLEDGE_PACK.map((k) => [k.id, k]));
