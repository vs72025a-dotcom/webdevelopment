/**
 * Built-in knowledge corpus.
 *
 * The on-device engine answers from *retrieved* material rather than free
 * generation, which is why it can be accurate without any weights or network.
 * Each entry is indexed into the vector store at boot under the `knowledge`
 * kind, and citations point back at these titles.
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  tags: string[];
  body: string;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ─────────────────────────── About this app ───────────────────────────
  {
    id: 'app-overview',
    title: 'Aurora Mind overview',
    tags: ['about', 'help', 'capabilities', 'what can you do'],
    body: `Aurora Mind is an advanced AI workspace that runs entirely inside your browser. It combines an on-device retrieval-and-reasoning engine with an optional connection to a frontier model provider. The workspace has six surfaces: Chat for conversation with tools, Documents for retrieval over files you upload, Code Lab for explaining and reviewing source code, Prompt Studio for building structured image prompts and rendering deterministic generative art, Agents for multi-step plans that call tools, and Settings for theme, provider and privacy controls. Every conversation, document index and preference is stored locally on your machine in IndexedDB and localStorage; nothing is uploaded unless you explicitly configure a provider API key.`,
  },
  {
    id: 'app-engine',
    title: 'How the on-device engine works',
    tags: ['engine', 'offline', 'how it works', 'embeddings', 'retrieval'],
    body: `The offline engine is a retrieval-augmented reasoning loop, not a large language model. Text is embedded with a hashing vectorizer that combines stemmed unigrams, bigrams, trigrams and character 3-to-5-grams into a 1024-dimensional vector, then L2-normalised so cosine similarity equals a dot product. A query is routed by an intent classifier to one of several strategies: mathematics, unit conversion, code, document question answering, knowledge lookup, summarisation, or conversation. Relevant chunks are retrieved with a hybrid score of 0.62 times cosine similarity plus 0.38 times keyword overlap, duplicates from chunk overlap are collapsed, and the answer is composed from the retrieved passages with inline citations. Because generation is grounded in retrieved text and real tool output, the engine does not invent facts it has no source for; when retrieval confidence is low it says so. An optional extended knowledge pack adds a further sixty entries of machine-learning, web-platform, security, systems and science material; it can be switched off in Settings so that answers come only from your own documents and the core corpus.`,
  },
  {
    id: 'app-tools',
    title: 'Built-in tools',
    tags: ['tools', 'calculator', 'functions', 'capabilities'],
    body: `The engine can call sixteen tools. calculate evaluates arithmetic through a hand-written recursive-descent parser with no eval, supporting precedence, powers, factorial, percent, comparisons, about fifty functions and named constants. convert_units handles length, mass, temperature, data, time, speed, area, volume, energy, power and pressure. convert_base converts between bases 2 to 36. datetime reports the current local and UTC time or converts timestamps. summarize produces query-biased extractive summaries. analyse_text reports word, sentence, readability and keyword statistics. sentiment scores polarity with negation handling. regex_test runs a real regular expression and lists captures. json_format validates and pretty-prints JSON. hash_text computes SHA-256, SHA-1 or SHA-512 digests with the Web Crypto API. make_uuid generates RFC 4122 version 4 identifiers. random_number draws uniform samples in a range. search_knowledge performs semantic retrieval over the built-in corpus and any documents you have indexed. Code tools analyse, explain and review source code. convert_color converts between hex, rgb, hsl and oklch with contrast ratios. list_units enumerates every supported unit so the converter never has to guess.`,
  },
  {
    id: 'app-nightmode',
    title: 'Night modes',
    tags: ['theme', 'night mode', 'dark', 'aurora', 'abyss', 'phosphor', 'eclipse'],
    body: `Aurora Mind ships four night themes and one day theme. Aurora Mesh paints a living aurora on a canvas behind frosted-glass panels; its intensity is driven by engine activity, so the sky brightens while the model thinks and settles when it stops. Abyssal Bioluminescence simulates a deep-sea drift of glowing plankton that flare as tokens stream in. Phosphor reproduces a vintage CRT terminal with monochrome green, scanlines, barrel vignette, subtle flicker and a phosphor afterglow that decays behind moving text. Eclipse Obsidian is a true-black OLED theme with a single solar-corona accent ring and maximum contrast for night reading. Themes are applied by an inline script before first paint so there is never a white flash, they respect the prefers-reduced-motion and prefers-color-scheme media queries, and an Auto setting switches between day and night using your local sunrise and sunset. Motion (full, reduced or off) and density (cosy or compact) are separate axes, and the whole app can be installed to the home screen and opened offline.`,
  },
  {
    id: 'app-privacy',
    title: 'Privacy and data handling',
    tags: ['privacy', 'security', 'data', 'storage'],
    body: `By default Aurora Mind is fully local. Conversations and document indices live in IndexedDB, preferences in localStorage, and both stay on your device. The on-device engine never opens a network connection. If you add a provider key in Settings, requests go directly from your browser to that provider's endpoint over HTTPS; the key is stored in localStorage and is never sent anywhere else, and there is no proxy or telemetry server in this project. You can wipe everything at any time from Settings, which clears IndexedDB, localStorage and the in-memory vector store.`,
  },

  // ─────────────────────────── AI & machine learning ───────────────────────────
  {
    id: 'transformers',
    title: 'Transformer architecture',
    tags: ['transformer', 'attention', 'neural network', 'llm', 'deep learning'],
    body: `The transformer, introduced in the 2017 paper "Attention Is All You Need" by Vaswani and colleagues, replaced recurrence with self-attention so every position in a sequence can attend to every other position in a single parallel operation. A block consists of multi-head self-attention followed by a position-wise feed-forward network, each wrapped in residual connections and layer normalisation. Attention computes softmax of QK transposed divided by the square root of the head dimension, then multiplies by V. Because cost grows quadratically with sequence length, production models use tricks such as grouped-query attention, rotary positional embeddings, flash attention kernels, sliding windows and key-value caching during decoding. Decoder-only transformers trained to predict the next token are what people usually mean by a large language model.`,
  },
  {
    id: 'attention',
    title: 'Scaled dot-product attention',
    tags: ['attention', 'math', 'softmax', 'transformer'],
    body: `Scaled dot-product attention maps queries, keys and values to an output with the formula Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) V. The division by sqrt(d_k) prevents the dot products from growing large in magnitude, which would push the softmax into regions with tiny gradients. Multi-head attention runs h independent attention heads over linear projections of the input and concatenates the results, letting different heads specialise on syntax, coreference or long-range structure. Causal attention applies a triangular mask so position i can only see positions up to i, which is what makes autoregressive generation possible.`,
  },
  {
    id: 'tokenization-llm',
    title: 'Tokenization and BPE',
    tags: ['tokenizer', 'bpe', 'tokens', 'vocab'],
    body: `Language models do not see characters or words; they see token ids. Byte-pair encoding starts from a vocabulary of individual bytes and repeatedly merges the most frequent adjacent pair until a target vocabulary size is reached, typically 32k to 200k tokens. The result compresses common English words to a single token while still being able to represent any string, including unseen words, code and emoji. A useful rule of thumb is that one token is roughly four characters or three-quarters of an English word, so 1000 tokens is about 750 words. Tokenization explains several model quirks: arithmetic on large numbers is hard because digits are grouped inconsistently, reversed spelling is hard because tokens are not letters, and non-Latin scripts consume more tokens per word.`,
  },
  {
    id: 'embeddings-explained',
    title: 'Embeddings and vector similarity',
    tags: ['embeddings', 'vectors', 'cosine', 'similarity', 'semantic search'],
    body: `An embedding maps a piece of text to a dense vector such that meaning is encoded as geometry: similar texts land close together. Similarity is usually measured with cosine, the dot product divided by the product of the norms, which ignores vector length and only compares direction. Once vectors are L2-normalised, cosine reduces to a plain dot product, which is why normalising at index time is standard practice. Modern embedding models are trained contrastively: pairs that should be similar are pulled together and dissimilar pairs pushed apart. For small corpora a hashing vectorizer with character n-grams gives surprisingly strong retrieval without any training, at the cost of collisions in the feature space.`,
  },
  {
    id: 'rag',
    title: 'Retrieval-augmented generation (RAG)',
    tags: ['rag', 'retrieval', 'grounding', 'citations', 'hallucination'],
    body: `Retrieval-augmented generation grounds a model's answer in documents fetched at query time instead of relying only on parametric memory. A typical pipeline chunks documents into a few hundred tokens with a small overlap, embeds each chunk, stores the vectors, then at query time embeds the question, retrieves the top k chunks and pastes them into the prompt. The gains are large: the model can cite sources, can answer about private or freshly updated data without retraining, and hallucinates less because it is told to use only the supplied context. The failure modes live in retrieval, not generation: chunks that are too large dilute the signal, chunks that are too small lose context, and pure vector search misses exact identifiers, which is why hybrid lexical plus semantic scoring and re-ranking are common.`,
  },
  {
    id: 'hallucination',
    title: 'Hallucination in language models',
    tags: ['hallucination', 'reliability', 'safety', 'accuracy'],
    body: `Hallucination is fluent output that is factually wrong or unsupported. It happens because a language model optimises for plausible continuation, not truth: the same mechanism that produces a correct sentence produces a confident incorrect one, and the model has no built-in signal that distinguishes them. Causes include gaps and contradictions in training data, sampling randomness, ambiguous prompts and pressure to answer rather than abstain. Mitigations that actually work are retrieval grounding with citations, constrained decoding, tool use for arithmetic and lookup, chain-of-thought with verification, temperature reduction for factual tasks, and explicit permission to say "I don't know". Users should still verify anything consequential.`,
  },
  {
    id: 'fine-tuning',
    title: 'Fine-tuning, LoRA and PEFT',
    tags: ['fine-tuning', 'lora', 'peft', 'training', 'adapters'],
    body: `Fine-tuning continues training a pretrained model on task-specific data. Full fine-tuning updates every weight and needs memory roughly sixteen times the parameter count for Adam states, which is impractical for large models. Parameter-efficient fine-tuning trains only a small set of added weights. LoRA freezes the original matrix W and learns a low-rank update BA where B is d by r and A is r by d with r far smaller than d, so a rank-16 adapter on a 4096-dimensional layer trains about 131k parameters instead of 16.7 million. Adapters can be merged into the base weights at inference for zero latency cost, or swapped at runtime to serve many tasks from one base model. Related techniques include QLoRA which adds 4-bit quantisation, prefix tuning, adapters and prompt tuning.`,
  },
  {
    id: 'rlhf',
    title: 'RLHF and preference alignment',
    tags: ['rlhf', 'alignment', 'dpo', 'reward model', 'preference'],
    body: `Reinforcement learning from human feedback aligns a model with human preferences. The classic recipe is supervised fine-tuning on demonstrations, then training a reward model on pairwise human comparisons, then optimising the policy against that reward with PPO while penalising divergence from the original model with a KL term. Direct Preference Optimization skips the reward model entirely by reparameterising the objective so the policy is optimised directly on preference pairs, which is simpler and more stable. Constitutional AI replaces some human labelling with a written set of principles the model uses to critique and revise its own outputs. Alignment tax is the observed drop in raw capability that sometimes accompanies these steps.`,
  },
  {
    id: 'agents-llm',
    title: 'AI agents and tool use',
    tags: ['agents', 'tools', 'function calling', 'react', 'planning', 'autonomy'],
    body: `An agent is a language model in a loop with tools and memory. The ReAct pattern alternates reasoning traces with actions: the model decides which tool to call and with what arguments, the runtime executes it, the observation is appended to the context, and the loop continues until the model emits a final answer. Reliable agents need a bounded iteration count, structured tool schemas, validation of arguments before execution, error messages fed back so the model can recover, and a planner that decomposes goals into verifiable subtasks. Common failure modes are tool thrashing, silently swallowing errors, over-long contexts and confidently reporting a failed step as successful, which is why every serious implementation surfaces the raw tool transcript to the user.`,
  },
  {
    id: 'diffusion',
    title: 'Diffusion models and image generation',
    tags: ['diffusion', 'image generation', 'stable diffusion', 'denoising', 'latent'],
    body: `Diffusion models learn to reverse a gradual noising process. Training adds Gaussian noise to an image over many timesteps and the network learns to predict the noise at each step; sampling starts from pure noise and iteratively denoises it. Latent diffusion, the basis of Stable Diffusion, runs this process in the compressed latent space of a variational autoencoder, cutting compute by an order of magnitude. Text conditioning uses CLIP or T5 embeddings injected through cross-attention. Classifier-free guidance interpolates between conditional and unconditional predictions with a scale factor, typically 5 to 9; higher values follow the prompt more literally but oversaturate. Sampling schedulers such as DDIM, DPM++ and Euler determine how many steps are needed, usually 20 to 50.`,
  },
  {
    id: 'prompt-engineering',
    title: 'Prompt engineering that works',
    tags: ['prompting', 'prompt engineering', 'few-shot', 'chain of thought'],
    body: `Effective prompting is mostly about removing ambiguity. State the role, the task, the output format and the constraints in that order; a model that knows it must return JSON with specific keys behaves very differently from one guessing at your intent. Few-shot examples beat adjectives: showing two input-output pairs conveys style more reliably than asking for "professional tone". Chain-of-thought prompting, asking the model to reason step by step before answering, measurably improves arithmetic and multi-step reasoning, but costs tokens and latency, and for simple tasks it can hurt. Separating instructions from data with delimiters reduces prompt injection risk. Asking for calibrated uncertainty and permitting "I don't know" reduces confident errors.`,
  },
  {
    id: 'image-prompting',
    title: 'Writing image generation prompts',
    tags: ['image prompt', 'midjourney', 'stable diffusion', 'prompt studio', 'negative prompt'],
    body: `A strong image prompt orders information by importance because attention decays across the sequence: subject first, then action and setting, then medium and style, then lighting, colour palette, camera and lens, and finally quality modifiers. Weights steer emphasis, written as (term:1.3) in Stable Diffusion style interfaces, and typically stay between 0.5 and 1.5 before artefacts appear. The negative prompt is where you remove what you do not want, such as blur, extra fingers, watermark or oversaturation. Naming a concrete medium ("35mm film photograph", "risograph print", "isometric vector illustration") produces far more coherent results than stacking abstract adjectives, and specifying one clear subject beats listing several.`,
  },
  {
    id: 'quantization',
    title: 'Model quantisation',
    tags: ['quantization', 'quantisation', 'quantize', 'gguf', 'int8', 'int4', 'q4', 'inference', 'memory', 'gptq', 'awq', 'qlora'],
    body: `Quantisation stores weights in lower precision to shrink models and speed up inference. Going from FP16 to INT8 halves memory with negligible quality loss; INT4 cuts it to a quarter and is now the common choice for local inference, typically losing one to three percent on benchmarks. Techniques differ in how they compute scaling factors: round-to-nearest is simplest, GPTQ uses second-order information per layer, AWQ protects the salient few percent of weights that matter most, and GGUF k-quants mix precisions within a tensor. Activations are often kept at higher precision than weights because outliers in activation channels are harder to quantise. The practical payoff is that a 7B model fits in about 4 GB at Q4 instead of 14 GB at FP16.`,
  },
  {
    id: 'moe',
    title: 'Mixture of experts',
    tags: ['moe', 'mixture of experts', 'sparse', 'scaling', 'architecture'],
    body: `A mixture-of-experts model replaces the single feed-forward layer with many parallel expert networks and a router that activates only the top k for each token, usually 1 or 2 of 8 to 128. Total parameters can be enormous while active parameters per token stay modest, so a model with 47 billion total parameters may compute like a 13 billion dense model. This decouples capacity from cost. Challenges are load balancing, where popular experts become bottlenecks, requiring an auxiliary loss; expert routing instability during training; and memory, because all expert weights must be resident even though only a few fire per token.`,
  },
  {
    id: 'temperature',
    title: 'Sampling parameters',
    tags: ['temperature', 'top-p', 'top-k', 'sampling', 'decoding'],
    body: `Decoding turns a probability distribution over the next token into an actual token. Temperature divides logits before the softmax: below 1 sharpens the distribution toward likely tokens, above 1 flattens it and increases variety, and 0 is equivalent to greedy argmax. Top-k keeps only the k highest-probability tokens. Top-p, or nucleus sampling, keeps the smallest set whose cumulative probability exceeds p, which adapts to how peaked the distribution already is. Frequency and presence penalties subtract from tokens that have already appeared, reducing repetition. For factual or code tasks, low temperature around 0.1 to 0.3 with modest top-p is usually best; for creative writing, 0.8 to 1.1 opens things up.`,
  },
  {
    id: 'context-window',
    title: 'Context windows and long context',
    tags: ['context window', 'long context', 'memory', 'kv cache', 'tokens'],
    body: `The context window is the total number of tokens a model can attend to at once, counting the system prompt, conversation history, retrieved documents and the generated output. Windows have grown from 2k to over a million tokens, but effective use is not the same as capacity: models often show lost-in-the-middle behaviour where information in the centre of a long prompt is retrieved less reliably than information at the start or end. Cost and latency also scale with input length, and the key-value cache grows linearly per token per layer, which is what limits batch size in practice. Putting instructions at both ends of a long context, and retrieving only what is needed, outperforms dumping everything in.`,
  },
  {
    id: 'evals',
    title: 'Evaluating models',
    tags: ['evaluation', 'benchmarks', 'mmlu', 'evals', 'testing'],
    body: `Benchmarks give a rough ranking but rarely predict product quality. MMLU covers 57 academic subjects, HumanEval and MBPP measure code generation pass rates, GSM8K and MATH test grade-school and competition mathematics, and HELM aggregates many tasks with a common harness. Their weaknesses are contamination, where training data overlaps test data, saturation at the top end, and a mismatch with open-ended real tasks. For an actual application, build a small golden set of representative inputs, score with a mix of exact match, rubric-based model grading and human review, and re-run it on every prompt or model change. Regression suites catch what leaderboards cannot.`,
  },

  // ─────────────────────────── Programming ───────────────────────────
  {
    id: 'javascript-core',
    title: 'JavaScript language essentials',
    tags: ['javascript', 'js', 'es2022', 'language', 'async', 'promise'],
    body: `JavaScript is single-threaded with an event loop: the call stack runs synchronous code to completion, then microtasks (promise callbacks, queueMicrotask) drain fully before the next macrotask (setTimeout, I/O, events). A Promise is pending, fulfilled or rejected and settles exactly once; async/await is sugar over promises where await yields to the microtask queue. var is function-scoped and hoisted with an undefined initial value, while let and const are block-scoped and live in a temporal dead zone until declared. Equality: use === which does not coerce, and Object.is for NaN and signed zero. Values are passed by sharing, so mutating an object argument is visible to the caller. Optional chaining (?.), nullish coalescing (??), destructuring, spread and top-level await are all standard in ES2022.`,
  },
  {
    id: 'typescript',
    title: 'TypeScript in practice',
    tags: ['typescript', 'ts', 'types', 'generics', 'type safety'],
    body: `TypeScript adds structural static types that are erased at compile time. Narrowing happens through control flow: typeof, instanceof, in, truthiness checks and discriminated unions on a literal tag field all let the compiler refine a type inside a branch. Generics parameterise types, constrained with extends, and infer positions let you omit annotations. Utility types such as Partial, Required, Pick, Omit, Record, Exclude, Extract, ReturnType and Awaited cover most transformation needs. unknown is the safe top type and must be narrowed before use, any disables checking, and never is the empty type useful for exhaustiveness checks. Enable strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes for maximum safety; type assertions with "as" are an escape hatch, not a fix.`,
  },
  {
    id: 'react-patterns',
    title: 'React patterns and performance',
    tags: ['react', 'hooks', 'components', 'state', 'usememo', 'rendering'],
    body: `React renders are pure functions of state and props; the reconciler diffs the resulting element tree and commits minimal DOM changes. Rules that follow from this: never mutate state, keep components idempotent, and lift state to the lowest common ancestor that needs it. useEffect is for synchronising with external systems, not for derived state, which should be computed during render or memoised with useMemo. Keys must be stable identities, never array indices on a reorderable list. Performance work should start by finding the actual re-render cost with the profiler, then applying memo, useCallback and context splitting where measurement says it matters. The modern data layer keeps server state in a cache with suspense rather than in useEffect plus useState.`,
  },
  {
    id: 'css-modern',
    title: 'Modern CSS layout and theming',
    tags: ['css', 'flexbox', 'grid', 'variables', 'container queries', 'theming'],
    body: `Flexbox is one-dimensional and ideal for toolbars, card rows and centring; grid is two-dimensional and best for page structure. Both replaced float-based layout entirely. Custom properties (variables) cascade and can be changed at runtime, which makes theming a matter of swapping a variable set on a root element, and they can be animated with @property registered types. Logical properties such as padding-inline and margin-block make layouts direction-agnostic. Container queries style a component based on its own container size rather than the viewport, which is what reusable components actually need. Modern colour functions oklch() and color-mix() give perceptually uniform palettes, and clamp() provides fluid typography without media queries.`,
  },
  {
    id: 'python',
    title: 'Python essentials',
    tags: ['python', 'language', 'duck typing', 'generators', 'async'],
    body: `Python is dynamically typed with reference counting plus a cyclic garbage collector. Indentation defines blocks, so formatting is semantic. Lists are dynamic arrays, tuples are immutable sequences, dicts preserve insertion order since 3.7 and are hash tables, and sets are unordered unique collections. Generators with yield produce values lazily and keep memory flat over large data; comprehensions are usually faster than equivalent loops. Decorators are functions that wrap functions, commonly used for logging, caching (functools.lru_cache) and framework routing. Type hints are annotations only, checked by external tools like mypy. The GIL means CPU-bound threads do not parallelise, so use multiprocessing for CPU work and asyncio for high-concurrency I/O.`,
  },
  {
    id: 'algorithms-complexity',
    title: 'Algorithmic complexity',
    tags: ['big o', 'complexity', 'algorithms', 'performance', 'data structures'],
    body: `Big-O describes how cost scales with input size, ignoring constants. Common classes from fastest to slowest growth: O(1) hash lookup, O(log n) binary search, O(n) linear scan, O(n log n) comparison sort, O(n^2) nested loops, O(2^n) subsets, O(n!) permutations. Comparison-based sorting has an O(n log n) lower bound because there are n! possible orderings and each comparison yields one bit. Hash tables average O(1) but degrade to O(n) under collisions. Space matters too: an in-place algorithm uses O(1) extra memory. The practical rule is to identify the dominant term for realistic n; a well-implemented O(n^2) beats a constant-heavy O(n log n) for small inputs, and cache locality often matters more than the theoretical class.`,
  },
  {
    id: 'data-structures',
    title: 'Choosing a data structure',
    tags: ['data structures', 'array', 'linked list', 'tree', 'hash map', 'heap'],
    body: `Arrays give O(1) index access and excellent cache locality but O(n) insertion in the middle. Linked lists give O(1) insertion at a known node but O(n) search and poor locality, so they rarely win on real hardware. Hash maps give average O(1) lookup by key. Balanced search trees (AVL, red-black, B-tree) give O(log n) lookup plus ordered iteration and range queries; B-trees with high fan-out are what databases use because they minimise disk seeks. Heaps give O(1) minimum and O(log n) insert and extract, powering priority queues. Tries excel at prefix search on strings. Graphs are stored as adjacency lists for sparse data and adjacency matrices for dense data with O(1) edge queries.`,
  },
  {
    id: 'web-performance',
    title: 'Web performance and Core Web Vitals',
    tags: ['performance', 'core web vitals', 'lcp', 'cls', 'inp', 'optimization'],
    body: `Core Web Vitals are three field metrics: Largest Contentful Paint measures loading, targeting under 2.5 seconds; Cumulative Layout Shift measures visual stability, targeting under 0.1; Interaction to Next Paint measures responsiveness, targeting under 200 milliseconds. The highest-leverage fixes are usually reducing and deferring JavaScript, because the main thread is the bottleneck: code-split routes, tree-shake, defer non-critical scripts and avoid long tasks over 50 ms. Preload the LCP resource, self-host fonts with font-display swap, size images to the rendered box and serve modern formats such as AVIF or WebP. Reserve space for media and embeds to prevent layout shift. Measure with the Performance panel and real-user monitoring, not only lab scores.`,
  },
  {
    id: 'accessibility',
    title: 'Web accessibility',
    tags: ['accessibility', 'a11y', 'wcag', 'aria', 'screen reader'],
    body: `Accessibility means the interface works for people using assistive technology, keyboards, or reduced-motion and contrast settings. WCAG is organised around four principles: perceivable, operable, understandable and robust. The most impactful practices are semantic HTML first, because a native button already has a role, is focusable and fires on Enter and Space; visible focus indicators that meet a 3:1 contrast ratio; text contrast of at least 4.5:1 for body copy and 3:1 for large text; keyboard reachability for every control; and alt text for meaningful images with empty alt for decoration. ARIA fills gaps that HTML cannot express, but a wrong ARIA attribute is worse than none. Test with a screen reader, keyboard only, and prefers-reduced-motion honoured.`,
  },
  {
    id: 'web-security',
    title: 'Web application security',
    tags: ['security', 'xss', 'csrf', 'csp', 'injection', 'owasp'],
    body: `Cross-site scripting happens when untrusted data is interpreted as code; the defences are contextual output encoding, a Content-Security-Policy that disallows inline scripts, and avoiding innerHTML with user input. SQL injection is prevented by parameterised queries, never by string escaping. Cross-site request forgery is mitigated by SameSite cookies plus an origin check or a synchroniser token for state-changing requests. Store secrets server-side; anything shipped to the browser is public. Use HTTPS everywhere with HSTS, set cookies HttpOnly, Secure and SameSite, and send security headers including X-Content-Type-Options nosniff and Referrer-Policy. Prompt injection is the LLM-era equivalent of SQL injection: treat model output and retrieved content as untrusted data, not as instructions.`,
  },
  {
    id: 'git-workflow',
    title: 'Git workflow essentials',
    tags: ['git', 'version control', 'branch', 'merge', 'rebase', 'commit'],
    body: `Git stores snapshots of a content-addressed object graph; a branch is a movable pointer to a commit and HEAD points at the current branch. Stage with git add, record with git commit, publish with git push. Merge creates a join commit and preserves history exactly; rebase replays commits onto a new base for a linear history but rewrites commit hashes, so never rebase shared branches. Resolve conflicts by editing the marked regions then continuing. Inspect with git log --graph --oneline, git diff and git blame. Undo a commit that is already pushed with git revert, which adds an inverse commit, rather than reset. A useful commit message has a short imperative subject line under 72 characters and a body explaining why, not what.`,
  },
  {
    id: 'sql-basics',
    title: 'SQL querying and indexing',
    tags: ['sql', 'database', 'query', 'index', 'join'],
    body: `SQL is declarative: you describe the result set and the planner chooses how to produce it. Logical execution order is FROM and JOIN, then WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, LIMIT, which is why you cannot reference a SELECT alias in WHERE. Joins: INNER keeps matching rows, LEFT keeps all left rows with NULLs for non-matches, and CROSS produces a cartesian product. An index is usually a B-tree on one or more columns and accelerates equality and range predicates; a composite index serves leftmost prefixes, so (a, b) helps queries on a and on a+b but not on b alone. SELECT * prevents covering-index use and wastes bandwidth. Explain plans are the only reliable way to diagnose a slow query.`,
  },
  {
    id: 'rest-apis',
    title: 'REST and HTTP API design',
    tags: ['rest', 'api', 'http', 'endpoints', 'status codes'],
    body: `HTTP methods carry semantics: GET is safe and cacheable, POST creates or triggers, PUT replaces a resource entirely, PATCH applies a partial update, DELETE removes. Status codes: 200 OK, 201 Created with a Location header, 204 No Content, 304 Not Modified for cache validation, 400 Bad Request, 401 Unauthenticated, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity for validation failures, 429 Too Many Requests with Retry-After, and 5xx for server faults. Resources are named as plural nouns with identifiers in the path and filters in the query string. Version the API in the path or a header, paginate with cursor-based keys for large collections, and return consistent error bodies with a machine-readable code and a human message.`,
  },
  {
    id: 'testing',
    title: 'Testing strategy',
    tags: ['testing', 'unit test', 'integration', 'tdd', 'coverage'],
    body: `The test pyramid favours many fast unit tests, fewer integration tests and a thin layer of end-to-end tests, because cost and flakiness grow as you move up. A good unit test exercises behaviour through the public API rather than implementation details, so refactoring does not break it; arrange, act, assert is the standard shape. Test names should read as specifications. Mocks isolate collaborators but over-mocking produces tests that pass while the system is broken, so prefer fakes and in-memory implementations. Coverage measures which lines ran, not which behaviours were verified; 100 percent coverage with no assertions is worthless. Deterministic tests must control time, randomness and network, and CI should treat flaky tests as defects to fix or quarantine.`,
  },
  {
    id: 'clean-code',
    title: 'Readable code principles',
    tags: ['clean code', 'refactoring', 'refactor', 'naming', 'review', 'quality', 'readable', 'code quality'],
    body: `Code is read far more often than it is written, so optimise for the reader. Names should reveal intent and be pronounceable; a variable named elapsedDays is worth more than a comment explaining d. Functions should do one thing at one level of abstraction and take few arguments, ideally zero to three, with options objects beyond that. Prefer early returns to deep nesting. Avoid clever tricks that save a line and cost a minute of reading each time. Duplication that is coincidental should not be abstracted prematurely, but duplicated business rules should. Comments explain why a decision was made, not what the next line does; if a comment is needed to explain what code does, the code should be renamed or split instead.`,
  },
  {
    id: 'regex-guide',
    title: 'Regular expressions',
    tags: ['regex', 'pattern matching', 'regexp', 'search'],
    body: `A regular expression describes a set of strings. Anchors ^ and $ match the start and end, \\b matches a word boundary. Character classes: \\d digits, \\w word characters, \\s whitespace, . any character except newline unless dotall, [abc] a set, [^abc] a negated set. Quantifiers * zero or more, + one or more, ? zero or one, {n,m} a bounded range, and appending ? makes them lazy so they match as little as possible. Groups ( ) capture, (?: ) group without capturing, and (?<name> ) captures with a name. Alternation | has the lowest precedence, so anchor it with groups. Lookahead (?= ) and lookbehind (?<= ) assert without consuming. Catastrophic backtracking arises from nested quantifiers such as (a+)+ and can hang a regex engine on adversarial input.`,
  },

  // ─────────────────────────── Science & mathematics ───────────────────────────
  {
    id: 'math-constants',
    title: 'Important mathematical constants',
    tags: ['math', 'constants', 'pi', 'e', 'phi', 'golden ratio'],
    body: `Pi is the ratio of a circle's circumference to its diameter, approximately 3.14159265358979, and appears throughout analysis and physics, not just geometry. Euler's number e is approximately 2.71828182845905 and is the base of the natural logarithm, arising as the limit of (1 + 1/n)^n; it is the unique base for which the exponential function is its own derivative. The golden ratio phi is (1 + sqrt(5))/2, approximately 1.6180339887, satisfying phi squared equals phi plus one. Tau is 2 pi, approximately 6.283185307, advocated as the more natural circle constant. Euler's identity e^(i pi) + 1 = 0 links five fundamental constants. The imaginary unit i satisfies i squared equals minus one.`,
  },
  {
    id: 'calculus-basics',
    title: 'Derivatives and integrals',
    tags: ['calculus', 'derivative', 'integral', 'math', 'differentiation'],
    body: `A derivative measures instantaneous rate of change, defined as the limit of (f(x+h) - f(x))/h as h approaches zero. Standard rules: the power rule gives n x^(n-1) for x^n; the product rule is (uv)' = u'v + uv'; the quotient rule is (u/v)' = (u'v - uv')/v^2; and the chain rule composes derivatives as (f(g(x)))' = f'(g(x)) g'(x). Common derivatives: e^x is itself, ln x is 1/x, sin x is cos x and cos x is -sin x. An integral accumulates quantity; the fundamental theorem of calculus links it to differentiation, so the definite integral of f from a to b is F(b) - F(a) where F is any antiderivative. Integration techniques include substitution, by parts, partial fractions and trigonometric identities.`,
  },
  {
    id: 'statistics-basics',
    title: 'Statistics fundamentals',
    tags: ['statistics', 'mean', 'median', 'variance', 'distribution', 'probability'],
    body: `Central tendency: the mean is the sum divided by the count and is sensitive to outliers, the median is the middle value of the sorted data and is robust, and the mode is the most frequent value. Spread: variance is the mean squared deviation, standard deviation is its square root in the original units, and the interquartile range spans the 25th to 75th percentile. The normal distribution is symmetric and bell-shaped, with about 68 percent of mass within one standard deviation, 95 within two and 99.7 within three. The central limit theorem says the mean of many independent samples approaches a normal distribution regardless of the underlying shape, which is why so much of statistics assumes normality. Bayes' theorem updates a prior belief with evidence: P(H|E) = P(E|H) P(H) / P(E).`,
  },
  {
    id: 'physics-mechanics',
    title: 'Classical mechanics',
    tags: ['physics', 'newton', 'force', 'energy', 'motion', 'mechanics'],
    body: `Newton's three laws state that a body persists in its state of motion unless acted on by a net force, that force equals mass times acceleration, and that forces occur in equal and opposite pairs. Weight is mass times gravitational acceleration, about 9.80665 m/s^2 at Earth's surface. Kinematic equations for constant acceleration relate displacement, initial and final velocity, acceleration and time. Kinetic energy is one half m v squared and gravitational potential energy near the surface is m g h; work is force times displacement in the direction of the force, and the work-energy theorem says net work equals the change in kinetic energy. Momentum is mass times velocity and is conserved in a closed system, which is what makes collision problems solvable.`,
  },
  {
    id: 'physics-relativity',
    title: 'Special relativity',
    tags: ['relativity', 'einstein', 'e=mc2', 'physics', 'light speed'],
    body: `Special relativity rests on two postulates: the laws of physics are identical in all inertial frames, and the speed of light in vacuum, exactly 299,792,458 metres per second, is the same for all observers regardless of their motion. Consequences include time dilation, where a moving clock ticks slower by the Lorentz factor gamma = 1/sqrt(1 - v^2/c^2); length contraction along the direction of motion by the same factor; and relativity of simultaneity, meaning two events simultaneous in one frame are not in another. Mass-energy equivalence E = mc^2 says a body at rest has energy equal to its mass times c squared, which is why a kilogram of matter corresponds to about 9 x 10^16 joules. Nothing with mass can reach c because gamma diverges.`,
  },
  {
    id: 'solar-system',
    title: 'The solar system',
    tags: ['astronomy', 'planets', 'solar system', 'space', 'sun'],
    body: `The Sun holds about 99.86 percent of the solar system's mass and fuses roughly 600 million tonnes of hydrogen into helium every second. Eight planets orbit it: the terrestrial worlds Mercury, Venus, Earth and Mars, then the gas giants Jupiter and Saturn and the ice giants Uranus and Neptune. Jupiter is the largest, with a mass greater than all other planets combined and a Great Red Spot storm wider than Earth. Saturn's rings are mostly water ice. Earth is the only world known to host life, with 71 percent of its surface covered by ocean. Beyond Neptune lies the Kuiper belt, home to Pluto and other dwarf planets, and further out the hypothesised Oort cloud that supplies long-period comets. One astronomical unit, the mean Earth-Sun distance, is about 149.6 million kilometres.`,
  },
  {
    id: 'chemistry-basics',
    title: 'Atomic structure and bonding',
    tags: ['chemistry', 'atom', 'electron', 'bond', 'periodic table'],
    body: `An atom is a nucleus of protons and neutrons surrounded by electrons in quantised orbitals. The atomic number is the proton count and defines the element; isotopes differ in neutron number; ions differ in electron count. Electrons fill shells in the order 1s, 2s, 2p, 3s, 3p, 4s, 3d, following the Aufbau principle, Pauli exclusion and Hund's rule, and the valence shell determines chemical behaviour, which is why the periodic table has its repeating structure. Ionic bonds transfer electrons between metals and non-metals, producing a lattice held by electrostatic attraction. Covalent bonds share electron pairs, and their polarity depends on electronegativity difference. Metallic bonds are a sea of delocalised electrons, explaining conductivity and malleability. Hydrogen bonds and van der Waals forces are weaker intermolecular attractions that nevertheless determine boiling points and the structure of DNA.`,
  },
  {
    id: 'biology-cells',
    title: 'Cell biology and DNA',
    tags: ['biology', 'cell', 'dna', 'genetics', 'protein'],
    body: `The cell is the unit of life. Prokaryotes such as bacteria lack a nucleus; eukaryotes compartmentalise functions in organelles: mitochondria generate ATP through oxidative phosphorylation, the nucleus stores DNA, ribosomes translate mRNA into protein, the endoplasmic reticulum and Golgi fold and ship proteins, and lysosomes recycle waste. DNA is a double helix of two antiparallel strands held by base pairs adenine-thymine and guanine-cytosine. The central dogma is that DNA is transcribed into messenger RNA, which is translated into protein by ribosomes reading codons of three bases against transfer RNA anticodons. The genetic code is redundant, with 64 codons for 20 amino acids plus start and stop signals. The human genome is about 3.1 billion base pairs and roughly 20,000 protein-coding genes.`,
  },

  // ─────────────────────────── Practical knowledge ───────────────────────────
  {
    id: 'units-metric',
    title: 'Unit systems and conversion',
    tags: ['units', 'conversion', 'metric', 'imperial', 'si'],
    body: `The International System of Units defines seven base units: the metre for length, kilogram for mass, second for time, ampere for electric current, kelvin for temperature, mole for amount of substance and candela for luminous intensity. Prefixes are powers of ten: kilo 10^3, mega 10^6, giga 10^9, tera 10^12, milli 10^-3, micro 10^-6, nano 10^-9. Data units are ambiguous: a kilobyte in storage marketing is usually 1000 bytes while a kibibyte is exactly 1024, and the same split applies up the scale. Common imperial conversions: one inch is exactly 2.54 centimetres, one foot is 0.3048 metres, one mile is 1.609344 kilometres, one pound is 0.45359237 kilograms, one US gallon is 3.785411784 litres. Temperature conversions are affine rather than proportional, so Celsius to Fahrenheit is F = C times 9/5 plus 32.`,
  },
  {
    id: 'time-zones',
    title: 'Time zones and timestamps',
    tags: ['time', 'timezone', 'utc', 'unix', 'epoch', 'datetime'],
    body: `A Unix timestamp counts seconds since 1 January 1970 00:00:00 UTC, excluding leap seconds. Storing time as UTC and converting for display avoids almost every timezone bug. The IANA tz database names zones as Area/Location, for example Asia/Kolkata or Europe/London, and encodes historical rule changes, so fixed offsets such as UTC+5:30 are wrong for any zone that has ever observed daylight saving. India uses a single zone, IST, at UTC+5:30 with no daylight saving. JavaScript's Date object stores an epoch millisecond value internally and formats it according to the runtime locale and timezone; use Intl.DateTimeFormat with an explicit timeZone option for reliable output, and never parse date strings with the Date constructor in production because the format handling is inconsistent.`,
  },
  {
    id: 'color-theory',
    title: 'Colour models and contrast',
    tags: ['colour', 'color', 'contrast', 'oklch', 'hsl', 'design', 'palette'],
    body: `sRGB describes colour as three gamma-encoded channels and is what CSS hex codes use, but it is not perceptually uniform: equal numeric steps do not look equally different. HSL is intuitive for humans but geometrically distorted, which is why "same lightness" HSL colours look wildly different in brightness. OKLCH fixes this with a lightness axis matched to human perception, plus chroma and hue, so a palette generated by holding L constant and rotating hue actually looks evenly bright. Contrast ratio compares relative luminance of two colours from 1:1 to 21:1; WCAG requires 4.5:1 for normal text and 3:1 for large text and UI boundaries. Black on pure white is harsh at night, which is why dark themes use a very dark blue-grey background with off-white text at around 13:1.`,
  },
  {
    id: 'design-dark-mode',
    title: 'Designing dark interfaces',
    tags: ['dark mode', 'night mode', 'ui', 'design', 'oled', 'contrast'],
    body: `Dark interfaces are not inverted light ones. Avoid pure black backgrounds with pure white text, because the extreme contrast causes halation, where light text appears to bloom and blur for people with astigmatism. Use a dark desaturated blue or grey, roughly luminance 5 to 12 percent, with off-white text around 87 to 92 percent opacity, giving a comfortable 12 to 15:1 contrast. Reduce chroma of accent colours, since saturated hues vibrate against dark backgrounds, and lighten them slightly to preserve contrast. Elevation is conveyed by lightening surfaces rather than by drop shadows, which are invisible on dark backgrounds. True black is worth offering for OLED panels where unlit pixels consume no power. Always respect prefers-color-scheme as the default and let the user override it.`,
  },
  {
    id: 'writing-well',
    title: 'Clear technical writing',
    tags: ['writing', 'documentation', 'clarity', 'communication'],
    body: `Clear writing is short sentences carrying one idea each, in active voice, with the subject and verb close together. Lead with the conclusion, then support it, because readers decide within the first sentence whether to continue. Prefer concrete nouns and strong verbs over nominalisations: "we decided" beats "a decision was reached". Cut hedges like "very", "quite" and "somewhat", and delete any sentence that repeats the previous one. For documentation, task-oriented headings ("Add a database", not "Database configuration") match how people actually search. Every code sample should be copy-pasteable and complete enough to run, with expected output shown, because an example that does not compile costs more time than no example at all.`,
  },
  {
    id: 'productivity',
    title: 'Focus and deep work',
    tags: ['productivity', 'focus', 'pomodoro', 'deep work', 'attention'],
    body: `Attention residue is real: after switching tasks, part of your focus stays on the previous one for several minutes, so frequent switching permanently lowers effective cognitive capacity. Deep work means sustained, distraction-free concentration on a cognitively demanding task, and it is best protected in blocks of 60 to 120 minutes rather than scattered fragments. The Pomodoro technique uses 25-minute sprints with short breaks, which suits shallow or aversive tasks better than deep ones. Practical levers: put the phone in another room rather than face-down, because mere presence costs attention; batch communication into fixed windows; write down the next concrete action before stopping so restarting is cheap; and schedule the hardest work at your circadian peak, which for most people is two to four hours after waking.`,
  },
  {
    id: 'learning-techniques',
    title: 'Evidence-based learning',
    tags: ['learning', 'study', 'memory', 'spaced repetition', 'recall'],
    body: `The strongest learning effects come from retrieval practice, spacing and interleaving. Retrieval practice means recalling information from memory rather than re-reading it; the effort of retrieval is what builds durable memory, so flashcards and self-testing beat highlighting. Spacing spreads review over increasing intervals, exploiting the forgetting curve, and typically doubles the interval after each successful recall. Interleaving mixes related topics within a session, which feels harder but produces better discrimination between similar concepts. Elaboration, explaining material in your own words and connecting it to what you already know, deepens encoding. Re-reading and massed cramming feel productive and are the least effective of the common techniques.`,
  },
];

/** Quick lookup used by the intent router for capability questions. */
export const KNOWLEDGE_BY_ID = new Map(KNOWLEDGE.map((k) => [k.id, k]));
