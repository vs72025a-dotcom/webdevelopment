/**
 * A real mathematics engine.
 *
 * Hand-written tokenizer + recursive-descent parser + tree-walking evaluator.
 * Nothing here calls eval()/new Function(), so user (or model) supplied
 * expressions are inert data — the app can safely expose calculation as a tool.
 *
 * Supports: arithmetic, precedence, right-associative powers, implicit
 * multiplication, unary minus, postfix factorial and percent, comparisons,
 * boolean logic, ~50 functions, named constants, degrees/radians and a
 * variable scope for multi-step work.
 */

export type AngleMode = 'deg' | 'rad';

export interface EvalOptions {
  angleMode?: AngleMode;
  variables?: Record<string, number>;
  precision?: number;
}

export class MathError extends Error {
  constructor(message: string, public position: number) {
    super(message);
    this.name = 'MathError';
  }
}

type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

interface Tok {
  type: TokenType;
  value: string;
  num?: number;
  pos: number;
}

const UNICODE_FIX: Record<string, string> = {
  '\u00d7': '*', '\u00b7': '*', '\u22c5': '*',
  '\u00f7': '/', '\u2212': '-', '\u2013': '-', '\u2014': '-',
  '\u2044': '/', '\u03c0': 'pi', '\u03c4': 'tau', '\u03c6': 'phi',
  '\u221e': 'inf', '\u00b2': '^2', '\u00b3': '^3', '\u221a': 'sqrt',
  '\u2260': '!=', '\u2264': '<=', '\u2265': '>=', '\u2248': '==',
  '\u2227': '&&', '\u2228': '||', '\u00ac': '!',
};

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
  inf: Infinity,
  infinity: Infinity,
  nan: NaN,
  c: 299792458, // speed of light, m/s
  g: 9.80665, // standard gravity, m/s^2
  h: 6.62607015e-34, // Planck constant, J*s
  k: 1.380649e-23, // Boltzmann constant, J/K
  na: 6.02214076e23, // Avogadro
  q: 1.602176634e-19, // elementary charge, C
  au: 1.495978707e11, // astronomical unit, m
  ly: 9.4607304725808e15, // light year, m
};

/** Lanczos approximation — lets factorial/generalised gamma work on reals. */
function gamma(z: number): number {
  if (Number.isInteger(z) && z > 0) {
    let r = 1;
    for (let i = 2; i < z; i++) r *= i;
    return r;
  }
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function factorial(n: number): number {
  if (n < 0 && Number.isInteger(n)) throw new MathError('Factorial of a negative integer is undefined', 0);
  return gamma(n + 1);
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a: number, b: number): number {
  const g = gcd(a, b);
  return g === 0 ? 0 : Math.abs(Math.round(a) * Math.round(b)) / g;
}

type Fn = (args: number[], ctx: Required<Pick<EvalOptions, 'angleMode'>>) => number;

const toRad = (v: number, mode: AngleMode) => (mode === 'deg' ? (v * Math.PI) / 180 : v);
const fromRad = (v: number, mode: AngleMode) => (mode === 'deg' ? (v * 180) / Math.PI : v);

export const FUNCTIONS: Record<string, Fn> = {
  // trig (angle-mode aware)
  sin: ([x], c) => Math.sin(toRad(x, c.angleMode)),
  cos: ([x], c) => Math.cos(toRad(x, c.angleMode)),
  tan: ([x], c) => Math.tan(toRad(x, c.angleMode)),
  asin: ([x], c) => fromRad(Math.asin(x), c.angleMode),
  acos: ([x], c) => fromRad(Math.acos(x), c.angleMode),
  atan: ([x], c) => fromRad(Math.atan(x), c.angleMode),
  atan2: ([y, x], c) => fromRad(Math.atan2(y, x), c.angleMode),
  sec: ([x], c) => 1 / Math.cos(toRad(x, c.angleMode)),
  csc: ([x], c) => 1 / Math.sin(toRad(x, c.angleMode)),
  cot: ([x], c) => 1 / Math.tan(toRad(x, c.angleMode)),
  sinh: ([x]) => Math.sinh(x),
  cosh: ([x]) => Math.cosh(x),
  tanh: ([x]) => Math.tanh(x),
  asinh: ([x]) => Math.asinh(x),
  acosh: ([x]) => Math.acosh(x),
  atanh: ([x]) => Math.atanh(x),
  // exponential / logarithmic
  exp: ([x]) => Math.exp(x),
  ln: ([x]) => Math.log(x),
  log: ([x, b]) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)),
  log2: ([x]) => Math.log2(x),
  log10: ([x]) => Math.log10(x),
  log1p: ([x]) => Math.log1p(x),
  pow: ([a, b]) => Math.pow(a, b),
  sqrt: ([x]) => Math.sqrt(x),
  cbrt: ([x]) => Math.cbrt(x),
  root: ([x, n]) => Math.sign(x) * Math.pow(Math.abs(x), 1 / n),
  hypot: (args) => Math.hypot(...args),
  // rounding
  abs: ([x]) => Math.abs(x),
  floor: ([x]) => Math.floor(x),
  ceil: ([x]) => Math.ceil(x),
  round: ([x, p]) => {
    const f = Math.pow(10, p ?? 0);
    return Math.round(x * f) / f;
  },
  trunc: ([x]) => Math.trunc(x),
  sign: ([x]) => Math.sign(x),
  frac: ([x]) => x - Math.trunc(x),
  // statistics
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  sum: (args) => args.reduce((a, b) => a + b, 0),
  mean: (args) => args.reduce((a, b) => a + b, 0) / args.length,
  avg: (args) => args.reduce((a, b) => a + b, 0) / args.length,
  median: (args) => {
    const s = [...args].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  stdev: (args) => {
    const m = args.reduce((a, b) => a + b, 0) / args.length;
    return Math.sqrt(args.reduce((a, b) => a + (b - m) ** 2, 0) / (args.length - 1 || 1));
  },
  variance: (args) => {
    const m = args.reduce((a, b) => a + b, 0) / args.length;
    return args.reduce((a, b) => a + (b - m) ** 2, 0) / (args.length - 1 || 1);
  },
  // number theory / combinatorics
  gcd: (args) => args.reduce((a, b) => gcd(a, b)),
  lcm: (args) => args.reduce((a, b) => lcm(a, b)),
  mod: ([a, b]) => ((a % b) + b) % b,
  factorial: ([x]) => factorial(x),
  fact: ([x]) => factorial(x),
  gamma: ([x]) => gamma(x),
  ncr: ([n, r]) => factorial(n) / (factorial(r) * factorial(n - r)),
  npr: ([n, r]) => factorial(n) / factorial(n - r),
  binomial: ([n, r]) => factorial(n) / (factorial(r) * factorial(n - r)),
  isprime: ([x]) => {
    if (!Number.isInteger(x) || x < 2) return 0;
    if (x < 4) return 1;
    if (x % 2 === 0) return 0;
    for (let i = 3; i * i <= x; i += 2) if (x % i === 0) return 0;
    return 1;
  },
  // conversions
  deg: ([x]) => (x * 180) / Math.PI,
  rad: ([x]) => (x * Math.PI) / 180,
  clamp: ([x, lo, hi]) => Math.min(Math.max(x, lo), hi),
  lerp: ([a, b, t]) => a + (b - a) * t,
  random: () => Math.random(),
};

function lex(src: string): Tok[] {
  let s = src;
  for (const [k, v] of Object.entries(UNICODE_FIX)) s = s.split(k).join(v);
  s = s.replace(/\bof\b/gi, '*').replace(/\bto the power of\b/gi, '^');

  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      if (ch === '0' && /[xXbBoO]/.test(s[i + 1] ?? '')) {
        i += 2;
        while (i < s.length && /[0-9a-fA-F_]/.test(s[i])) i++;
        const raw = s.slice(start, i).replace(/_/g, '');
        toks.push({ type: 'num', value: raw, num: Number(raw), pos: start });
        continue;
      }
      while (i < s.length && /[0-9_]/.test(s[i])) i++;
      if (s[i] === '.') {
        i++;
        while (i < s.length && /[0-9_]/.test(s[i])) i++;
      }
      if (/[eE]/.test(s[i] ?? '')) {
        const save = i;
        i++;
        if (/[+-]/.test(s[i] ?? '')) i++;
        if (/[0-9]/.test(s[i] ?? '')) {
          while (i < s.length && /[0-9]/.test(s[i])) i++;
        } else i = save;
      }
      const raw = s.slice(start, i).replace(/_/g, '');
      const num = Number(raw);
      if (Number.isNaN(num)) throw new MathError(`Cannot read number "${raw}"`, start);
      toks.push({ type: 'num', value: raw, num, pos: start });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      while (i < s.length && /[A-Za-z0-9_$]/.test(s[i])) i++;
      toks.push({ type: 'ident', value: s.slice(start, i).toLowerCase(), pos: start });
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '**'].includes(two)) {
      toks.push({ type: 'op', value: two === '**' ? '^' : two, pos: i });
      i += 2;
      continue;
    }
    if ('+-*/%^!<>=|'.includes(ch)) {
      toks.push({ type: 'op', value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '(' || ch === '[') {
      toks.push({ type: 'lparen', value: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      toks.push({ type: 'rparen', value: ')', pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      toks.push({ type: 'comma', value: ',', pos: i });
      i++;
      continue;
    }
    throw new MathError(`Unexpected character "${ch}"`, i);
  }
  toks.push({ type: 'eof', value: '', pos: s.length });
  return toks;
}

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'un'; op: string; arg: Node }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'post'; op: string; arg: Node }
  | { t: 'call'; name: string; args: Node[] }
  | { t: 'abs'; arg: Node };

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.p];
  }
  private next(): Tok {
    return this.toks[this.p++];
  }
  private eat(type: TokenType, value?: string): boolean {
    const t = this.peek();
    if (t.type === type && (value === undefined || t.value === value)) {
      this.p++;
      return true;
    }
    return false;
  }

  parse(): Node {
    const node = this.parseOr();
    if (this.peek().type !== 'eof') {
      throw new MathError(`Unexpected "${this.peek().value}"`, this.peek().pos);
    }
    return node;
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.peek().type === 'op' && this.peek().value === '||') {
      this.next();
      left = { t: 'bin', op: '||', l: left, r: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseEquality();
    while (this.peek().type === 'op' && this.peek().value === '&&') {
      this.next();
      left = { t: 'bin', op: '&&', l: left, r: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseComparison();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '==' || t.value === '!=')) {
        this.next();
        left = { t: 'bin', op: t.value, l: left, r: this.parseComparison() };
      } else return left;
    }
  }

  private parseComparison(): Node {
    let left = this.parseAdditive();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && ['<', '>', '<=', '>='].includes(t.value)) {
        this.next();
        left = { t: 'bin', op: t.value, l: left, r: this.parseAdditive() };
      } else return left;
    }
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next();
        left = { t: 'bin', op: t.value, l: left, r: this.parseMultiplicative() };
      } else return left;
    }
  }

  /**
   * Does the next token begin a new operand, i.e. should we insert an implicit
   * multiplication ("2pi", "3(4+1)")?
   *
   * Unary +/- must NOT count: otherwise "2 + 3" parses as 2 * (+3). They are
   * handled by parseAdditive, which runs at lower precedence.
   */
  private startsOperand(): boolean {
    const t = this.peek();
    return t.type === 'num' || t.type === 'ident' || t.type === 'lparen';
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        // Disambiguate modulo from postfix percent: "50%" (end) vs "10 % 3".
        if (t.value === '%') {
          const after = this.toks[this.p + 1];
          const isModulo =
            after &&
            !(after.type === 'ident' && after.value === 'of') &&
            (after.type === 'num' || after.type === 'ident' || after.type === 'lparen');
          if (!isModulo) {
            this.next();
            left = { t: 'post', op: '%', arg: left };
            continue;
          }
        }
        this.next();
        left = { t: 'bin', op: t.value === '%' ? 'mod' : t.value, l: left, r: this.parseUnary() };
      } else if (this.startsOperand() && t.type !== 'eof') {
        // Implicit multiplication: 2pi, 3(4+1), (2)(3), 4x
        left = { t: 'bin', op: '*', l: left, r: this.parseUnary() };
      } else return left;
    }
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t.type === 'op' && (t.value === '-' || t.value === '+' || t.value === '!')) {
      this.next();
      return { t: 'un', op: t.value, arg: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePostfix();
    const t = this.peek();
    if (t.type === 'op' && t.value === '^') {
      this.next();
      // Right associative, and binds tighter than unary minus: -2^2 = -(2^2)
      return { t: 'bin', op: '^', l: base, r: this.parseUnary() };
    }
    return base;
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.type === 'op' && t.value === '!') {
        this.next();
        node = { t: 'post', op: '!', arg: node };
      } else break;
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.next();
    if (t.type === 'num') return { t: 'num', v: t.num ?? 0 };
    if (t.type === 'op' && t.value === '|') {
      const inner = this.parseOr();
      if (!this.eat('op', '|')) throw new MathError('Missing closing |', t.pos);
      return { t: 'abs', arg: inner };
    }
    if (t.type === 'lparen') {
      const inner = this.parseOr();
      if (!this.eat('rparen')) throw new MathError('Missing closing parenthesis', t.pos);
      return inner;
    }
    if (t.type === 'ident') {
      const name = t.value;
      if (this.peek().type === 'lparen') {
        this.next();
        const args: Node[] = [];
        if (!this.eat('rparen')) {
          for (;;) {
            args.push(this.parseOr());
            if (this.eat('comma')) continue;
            if (this.eat('rparen')) break;
            throw new MathError('Expected , or ) in argument list', this.peek().pos);
          }
        }
        if (!FUNCTIONS[name]) throw new MathError(`Unknown function "${name}"`, t.pos);
        return { t: 'call', name, args };
      }
      if (name in CONSTANTS) return { t: 'num', v: CONSTANTS[name] };
      return { t: 'var', name };
    }
    throw new MathError(`Unexpected "${t.value || 'end of input'}"`, t.pos);
  }
}

function evalNode(node: Node, vars: Record<string, number>, angleMode: AngleMode): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'var': {
      if (node.name in vars) return vars[node.name];
      if (node.name in CONSTANTS) return CONSTANTS[node.name];
      throw new MathError(`Unknown variable "${node.name}"`, 0);
    }
    case 'abs':
      return Math.abs(evalNode(node.arg, vars, angleMode));
    case 'un': {
      const v = evalNode(node.arg, vars, angleMode);
      if (node.op === '-') return -v;
      if (node.op === '+') return v;
      return v ? 0 : 1;
    }
    case 'post': {
      const v = evalNode(node.arg, vars, angleMode);
      if (node.op === '!') return factorial(v);
      return v / 100;
    }
    case 'call': {
      const args = node.args.map((a) => evalNode(a, vars, angleMode));
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new MathError(`Unknown function "${node.name}"`, 0);
      return fn(args, { angleMode });
    }
    case 'bin': {
      const l = evalNode(node.l, vars, angleMode);
      // Short-circuit boolean operators.
      if (node.op === '&&') return l !== 0 && evalNode(node.r, vars, angleMode) !== 0 ? 1 : 0;
      if (node.op === '||') return l !== 0 || evalNode(node.r, vars, angleMode) !== 0 ? 1 : 0;
      const r = evalNode(node.r, vars, angleMode);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/':
          if (r === 0) throw new MathError('Division by zero', 0);
          return l / r;
        case 'mod':
          if (r === 0) throw new MathError('Modulo by zero', 0);
          return l % r;
        case '^': return Math.pow(l, r);
        case '==': return Number(Math.abs(l - r) < 1e-12);
        case '!=': return Number(Math.abs(l - r) >= 1e-12);
        case '<': return Number(l < r);
        case '>': return Number(l > r);
        case '<=': return Number(l <= r);
        case '>=': return Number(l >= r);
        default: throw new MathError(`Unknown operator "${node.op}"`, 0);
      }
    }
  }
}

/**
 * Evaluate a mathematical expression. Supports several statements separated by
 * `;` or newlines — the last value is the result and earlier ones become
 * variables when written as `name = expr`.
 */
export function evaluate(input: string, options: EvalOptions = {}): {
  value: number;
  formatted: string;
  steps: string[];
} {
  const angleMode = options.angleMode ?? 'rad';
  const vars: Record<string, number> = { ...(options.variables ?? {}) };
  const statements = input
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!statements.length) throw new MathError('Empty expression', 0);

  const steps: string[] = [];
  let value = NaN;

  for (const stmt of statements) {
    const assign = stmt.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?!=)(.+)$/);
    if (assign) {
      const v = evalNode(new Parser(lex(assign[2])).parse(), vars, angleMode);
      vars[assign[1].toLowerCase()] = v;
      steps.push(`${assign[1]} = ${formatNumber(v)}`);
      value = v;
      continue;
    }
    value = evalNode(new Parser(lex(stmt)).parse(), vars, angleMode);
    steps.push(`${stmt}  =  ${formatNumber(value)}`);
  }

  return { value, formatted: formatNumber(value), steps };
}

/** Human-friendly number formatting with float-noise cleanup. */
export function formatNumber(value: number, precision = 12): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  if (abs >= 1e21 || (abs < 1e-9 && abs > 0)) {
    return value.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e');
  }
  if (Number.isInteger(value) && abs < 1e15) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // Snap values that are floating-point noise away from a clean number.
  const rounded = Number(value.toPrecision(precision));
  const snapped = Math.abs(rounded - Math.round(rounded)) < 1e-9 ? Math.round(rounded) : rounded;
  if (Number.isInteger(snapped) && Math.abs(snapped) < 1e15) {
    return snapped.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  const out = snapped.toLocaleString('en-US', { maximumFractionDigits: precision });
  return out.replace(/\.?0+$/, '') || '0';
}

/** Recognise exact symbolic forms (pi multiples, roots, e) for pretty output. */
export function symbolicForm(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const candidates: Array<[string, number]> = [
    ['\u03c0', Math.PI], ['e', Math.E], ['\u03c4', Math.PI * 2], ['\u03c6', (1 + Math.sqrt(5)) / 2],
    ['\u221a2', Math.SQRT2], ['\u221a3', Math.sqrt(3)], ['\u221a5', Math.sqrt(5)],
    ['1/\u03c0', 1 / Math.PI], ['\u03c0/2', Math.PI / 2], ['\u03c0/3', Math.PI / 3],
    ['\u03c0/4', Math.PI / 4], ['\u03c0/6', Math.PI / 6], ['2\u03c0', Math.PI * 2],
  ];
  for (const [name, base] of candidates) {
    if (Math.abs(value - base) < 1e-12) return name;
    const ratio = value / base;
    for (let n = 1; n <= 24; n++) {
      if (Math.abs(ratio - n) < 1e-10) return n === 1 ? name : `${n}${name}`;
      if (Math.abs(ratio - 1 / n) < 1e-10) return `${name}/${n}`;
    }
  }
  return null;
}

/** Is this string plausibly a math expression? Used by intent routing. */
export function looksLikeMath(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 240) return false;
  if (/[A-Za-z]{3,}/.test(t.replace(/\b(what|is|calculate|compute|solve|equals|equal|plus|minus|times|divided|by|percent|of|sqrt|sin|cos|tan|log|ln|how|much|the|value|result)\b/gi, ''))) {
    return false;
  }
  const hasMath = /[-+*/^%]|\b(sqrt|sin|cos|tan|log|ln|exp|abs|pi)\b/.test(t);
  const hasDigits = /\d/.test(t);
  return hasMath && hasDigits;
}

/** Convert spoken math ("12 plus 7 times 3") into an expression. */
export function spokenToExpression(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bwhat(?:'s| is)?\b|\bcalculate\b|\bcompute\b|\bevaluate\b|\bsolve\b|\bhow much is\b|\bequals?\b|\?/g, ' ')
    .replace(/\bplus\b|\band\b|\badded to\b/g, '+')
    .replace(/\bminus\b|\bsubtract(ed by)?\b|\bless\b/g, '-')
    .replace(/\btimes\b|\bmultiplied by\b|\bx\b(?=\s*\d)/g, '*')
    .replace(/\bdivided by\b|\bover\b/g, '/')
    .replace(/\bto the power of\b|\braised to\b/g, '^')
    .replace(/\bsquared\b/g, '^2')
    .replace(/\bcubed\b/g, '^3')
    .replace(/\bsquare root of\b/g, 'sqrt')
    .replace(/\bcube root of\b/g, 'cbrt')
    .replace(/\bpercent of\b/g, '% *')
    .replace(/\bpercent\b/g, '%')
    .replace(/\bmod(?:ulo)?\b/g, '%')
    .replace(/[^0-9a-z+\-*/^%().,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
