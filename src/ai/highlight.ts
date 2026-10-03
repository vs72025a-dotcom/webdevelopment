/**
 * Syntax highlighter.
 *
 * A single scanner driven by per-language rule tables. Rules use *sticky*
 * regular expressions (`y` flag) so the engine only ever tests at the current
 * offset — no substring slicing, no quadratic blow-up on large files.
 *
 * Every emitted character is HTML-escaped; the only markup this module produces
 * is its own <span class="tk-*"> wrappers, so highlighting can never become an
 * injection vector.
 */

import { Language } from './tokenizer';

export type TokenType =
  | 'com' | 'str' | 'num' | 'kw' | 'bi' | 'ty' | 'fn' | 'op' | 'pn'
  | 'pr' | 'tag' | 'att' | 'val' | 'rx' | 'bool' | 'var' | 'dec';

interface Rule {
  t: TokenType;
  re: RegExp;
}

const sticky = (src: string): RegExp => new RegExp(src, 'y');

function words(list: string): RegExp {
  return sticky(`\\b(?:${list.replace(/\s+/g, '|')})\\b`);
}

const C_KEYWORDS = 'if else for while do return break continue switch case default goto sizeof typedef struct union enum extern static const volatile inline register auto void char short int long float double signed unsigned bool true false null nullptr new delete class public private protected virtual override final template typename namespace using try catch throw friend operator this';
const JS_KEYWORDS = 'const let var function return if else for while do break continue switch case default class extends super new delete typeof instanceof in of void this yield await async import export from as try catch finally throw static get set';
const PY_KEYWORDS = 'def class return if elif else for while break continue pass import from as with try except finally raise lambda global nonlocal yield assert del async await match case';
const GO_KEYWORDS = 'package import func var const type struct interface map chan go defer return if else for range switch case default break continue goto select fallthrough nil true false iota make new len cap append copy delete close panic recover print println string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 bool byte rune error any';
const RS_KEYWORDS = 'fn let mut const static struct enum impl trait for while loop if else match break continue return use mod pub crate self super as where dyn ref move async await unsafe extern type default macro_rules true false None Some Ok Err Vec String str i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 f32 f64 usize isize bool char';
const SQL_KEYWORDS = 'select from where insert into values update set delete create table alter drop index view join inner left right full outer cross on group by order having limit offset distinct as and or not null is in between like exists union all case when then else end with recursive primary key foreign references unique check default constraint count sum avg min max coalesce cast';
const JAVA_KEYWORDS = 'public private protected class interface extends implements static final void int long double float boolean char byte short new return if else for while do break continue switch case default try catch finally throw throws import package this super abstract synchronized volatile transient instanceof null true false record var sealed permits';

const jsLike = (extraKw: string): Rule[] => [
  { t: 'com', re: sticky('\\/\\/[^\\n]*') },
  { t: 'com', re: sticky('\\/\\*[\\s\\S]*?(?:\\*\\/|$)') },
  { t: 'str', re: sticky('`(?:\\\\[\\s\\S]|[^\\\\`])*`') },
  { t: 'str', re: sticky('"(?:\\\\[\\s\\S]|[^"\\\\])*"?') },
  { t: 'str', re: sticky("'(?:\\\\[\\s\\S]|[^'\\\\])*'?") },
  { t: 'rx', re: sticky('\\/(?![*\\/])(?:\\\\.|\\[(?:\\\\.|[^\\]\\\\])*\\]|[^\\/\\\\\\n])+\\/[gimsuy]*(?=[\\s).,;\\]}]|$)') },
  { t: 'num', re: sticky('\\b0[xXbBoO][0-9a-fA-F_]+n?\\b|\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?n?\\b') },
  { t: 'bool', re: words('true false null undefined NaN Infinity') },
  { t: 'kw', re: words(`${JS_KEYWORDS} ${extraKw}`) },
  { t: 'bi', re: words('console window document Math JSON Object Array String Number Boolean Promise Map Set WeakMap WeakSet Symbol Proxy Reflect Date RegExp Error parseInt parseFloat isNaN setTimeout setInterval clearTimeout clearInterval fetch localStorage sessionStorage requestAnimationFrame Intl TextEncoder URL Blob File FormData crypto performance navigator') },
  { t: 'ty', re: sticky('\\b(?:string|number|boolean|any|unknown|void|never|object|symbol|bigint)\\b') },
  { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_$]*\\b') },
  { t: 'fn', re: sticky('\\b[A-Za-z_$][\\w$]*(?=\\s*\\()') },
  { t: 'pr', re: sticky('(?<=\\.)[A-Za-z_$][\\w$]*') },
  { t: 'op', re: sticky('=>|\\.\\.\\.|[+\\-*/%]=?|[<>!=]=?=?|&&=?|\\|\\|=?|\\?\\?=?|\\?\\.|[&|^~!]') },
  { t: 'pn', re: sticky('[{}()[\\];,.:]') },
];

const RULES: Partial<Record<Language, Rule[]>> = {
  javascript: jsLike(''),
  jsx: jsLike(''),
  typescript: jsLike('type interface enum implements declare readonly keyof infer namespace abstract as satisfies'),
  tsx: jsLike('type interface enum implements declare readonly keyof infer namespace abstract as satisfies'),
  python: [
    { t: 'com', re: sticky('#[^\\n]*') },
    { t: 'str', re: sticky('[fFrbRuU]{0,2}"""[\\s\\S]*?(?:"""|$)') },
    { t: 'str', re: sticky("[fFrbRuU]{0,2}'''[\\s\\S]*?(?:'''|$)") },
    { t: 'str', re: sticky('[fFrbBuU]?"(?:\\\\.|[^"\\\\\\n])*"?') },
    { t: 'str', re: sticky("[fFrbBuU]?'(?:\\\\.|[^'\\\\\\n])*'?") },
    { t: 'num', re: sticky('\\b0[xXbBoO][0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?[jJ]?\\b') },
    { t: 'dec', re: sticky('(?:^|(?<=\\n))\\s*@[\\w.]+') },
    { t: 'bool', re: words('True False None') },
    { t: 'kw', re: words(PY_KEYWORDS) },
    { t: 'bi', re: words('print len range list dict set tuple str int float bool complex bytes object type isinstance issubclass hasattr getattr setattr enumerate zip map filter sorted reversed sum min max abs round all any open super self cls iter next Exception ValueError TypeError KeyError IndexError RuntimeError') },
    { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_]*\\b') },
    { t: 'fn', re: sticky('\\b[A-Za-z_][\\w]*(?=\\s*\\()') },
    { t: 'op', re: sticky('\\*\\*=?|\\/\\/=?|[+\\-*/%]=?|[<>!=]=?|->|:=|[&|^~@]') },
    { t: 'pn', re: sticky('[{}()[\\];,.:]') },
  ],
  json: [
    { t: 'pr', re: sticky('"(?:\\\\.|[^"\\\\])*"(?=\\s*:)') },
    { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?') },
    { t: 'num', re: sticky('-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b') },
    { t: 'bool', re: words('true false null') },
    { t: 'pn', re: sticky('[{}\\[\\],:]') },
  ],
  css: [
    { t: 'com', re: sticky('\\/[\\s\\S]*?(?:\\*\\/|$)') },
    { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|\'(?:\\\\.|[^\'\\\\])*\'?') },
    { t: 'dec', re: sticky('@[\\w-]+') },
    { t: 'var', re: sticky('--[\\w-]+') },
    { t: 'bi', re: sticky('var\\(|calc\\(|clamp\\(|min\\(|max\\(|url\\(|rgba?\\(|hsla?\\(|oklch\\(|color-mix\\(|linear-gradient\\(|radial-gradient\\(') },
    { t: 'num', re: sticky('-?\\b\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|ch|ex|pt|cm|mm|in|s|ms|deg|rad|turn|fr)?\\b|#[0-9a-fA-F]{3,8}\\b') },
    { t: 'pr', re: sticky('(?<=[{;\\s])[a-z-]+(?=\\s*:)') },
    { t: 'ty', re: sticky(':[a-z-]+(?=\\s*[;,)])') },
    { t: 'fn', re: sticky('[.#][A-Za-z_-][\\w-]*|::?[a-z-]+') },
    { t: 'op', re: sticky('[~*+>]|=') },
    { t: 'pn', re: sticky('[{}();,:]') },
  ],
  html: [
    { t: 'com', re: sticky('<!--[\\s\\S]*?(?:-->|$)') },
    { t: 'com', re: sticky('<!DOCTYPE[^>]*>') },
    { t: 'tag', re: sticky('<\\/?[A-Za-z][\\w:-]*') },
    { t: 'att', re: sticky('[A-Za-z_:@#][\\w:.-]*(?=\\s*=)') },
    { t: 'str', re: sticky('"(?:[^"]*)"|\'(?:[^\']*)\'') },
    { t: 'op', re: sticky('=[{}]?') },
    { t: 'pn', re: sticky('\\/?>') },
  ],
  bash: [
    { t: 'com', re: sticky('#[^\\n]*') },
    { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|\'[^\']*\'?') },
    { t: 'var', re: sticky('\\$(?:\\{[^}]*\\}|[A-Za-z_][\\w]*|[0-9@*#?$!-])') },
    { t: 'num', re: sticky('\\b\\d+\\b') },
    { t: 'dec', re: sticky('^\\s*(?:#!)[^\\n]*') },
    { t: 'kw', re: words('if then else elif fi for while until do done case esac function in select time return break continue export local readonly declare typeset set unset shift source alias eval exec trap wait read echo printf test true false') },
    { t: 'bi', re: words('cd ls cat grep sed awk find xargs curl wget git npm npx yarn pnpm node python pip docker kubectl make cmake tar gzip chmod chown mkdir rm cp mv ssh scp apt brew systemctl journalctl') },
    { t: 'op', re: sticky('&&|\\|\\||>>?|<<?|[|&;]') },
    { t: 'pn', re: sticky('[(){}\\[\\]]') },
  ],
  sql: [
    { t: 'com', re: sticky('--[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)') },
    { t: 'str', re: sticky("'(?:''|[^'])*'?") },
    { t: 'num', re: sticky('\\b\\d+(?:\\.\\d+)?\\b') },
    { t: 'kw', re: sticky(`\\b(?:${SQL_KEYWORDS.split(' ').join('|')})\\b`) },
    { t: 'bi', re: words('count sum avg min max abs round cast coalesce nullif substring trim upper lower length replace concat now current_timestamp date_trunc extract row_number rank dense_rank partition over') },
    { t: 'bool', re: words('true false null') },
    { t: 'ty', re: sticky('\\b(?:int|integer|bigint|smallint|serial|text|varchar|char|boolean|date|timestamp|timestamptz|numeric|decimal|float|double|json|jsonb|uuid|blob)\\b') },
    { t: 'op', re: sticky('[<>!=]=?|\\|\\||::|[+\\-*/%]') },
    { t: 'pn', re: sticky('[(),;.]') },
  ],
  go: [
    { t: 'com', re: sticky('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)') },
    { t: 'str', re: sticky('`[^`]*`|"(?:\\\\.|[^"\\\\])*"?') },
    { t: 'rx', re: sticky("'(?:\\\\.|[^'\\\\])*'?") },
    { t: 'num', re: sticky('\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b') },
    { t: 'kw', re: words(GO_KEYWORDS) },
    { t: 'bool', re: words('true false nil') },
    { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_]*\\b') },
    { t: 'fn', re: sticky('\\b[A-Za-z_][\\w]*(?=\\s*\\()') },
    { t: 'op', re: sticky(':=|<-|&&|\\|\\||[<>!=]=?|[+\\-*/%&|^!]') },
    { t: 'pn', re: sticky('[{}()[\\];,.:]') },
  ],
  rust: [
    { t: 'com', re: sticky('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)') },
    { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|b?"[^"]*"') },
    { t: 'rx', re: sticky("'(?:\\\\.|[^'\\\\])'") },
    { t: 'dec', re: sticky('#!?\\[[^\\]]*\\]') },
    { t: 'num', re: sticky('\\b0[xXob][0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?(?:u|i|f)(?:8|16|32|64|128|size)?\\b') },
    { t: 'kw', re: words(RS_KEYWORDS) },
    { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_]*\\b') },
    { t: 'bi', re: words('println print format vec assert assert_eq dbg todo unimplemented unwrap expect clone into iter collect') },
    { t: 'fn', re: sticky('\\b[a-z_][\\w]*(?=\\s*[(<])') },
    { t: 'op', re: sticky('=>|->|::|&&|\\|\\||[<>!=]=?|[+\\-*/%&|^!?]') },
    { t: 'pn', re: sticky('[{}()[\\];,.:]') },
  ],
  java: [
    { t: 'com', re: sticky('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)') },
    { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?') },
    { t: 'rx', re: sticky("'(?:\\\\.|[^'\\\\])*'?") },
    { t: 'dec', re: sticky('@[A-Z][\\w]*') },
    { t: 'num', re: sticky('\\b\\d+(?:\\.\\d+)?[fFdDlL]?\\b|\\b0[xX][0-9a-fA-F]+[lL]?\\b') },
    { t: 'kw', re: words(JAVA_KEYWORDS) },
    { t: 'bi', re: words('System String Integer Double Boolean List Map Set ArrayList HashMap Optional Stream Collectors Math Object Override') },
    { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_]*\\b') },
    { t: 'fn', re: sticky('\\b[a-z_][\\w]*(?=\\s*\\()') },
    { t: 'op', re: sticky('->|::|[<>!=]=?|&&|\\|\\||[+\\-*/%&|^!]') },
    { t: 'pn', re: sticky('[{}()[\\];,.:]') },
  ],
  markdown: [
    { t: 'dec', re: sticky('^\\s{0,3}#{1,6}[^\\n]*') },
    { t: 'str', re: sticky('```[\\s\\S]*?(?:```|$)') },
    { t: 'rx', re: sticky('`[^`\\n]*`') },
    { t: 'kw', re: sticky('\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__') },
    { t: 'ty', re: sticky('\\*[^*\\n]+\\*|_[^_\\n]+_') },
    { t: 'fn', re: sticky('!?\\[[^\\]\\n]*\\]\\([^)\\n]*\\)') },
    { t: 'op', re: sticky('^\\s*(?:[-*+]|\\d+\\.)\\s') },
    { t: 'pn', re: sticky('^\\s*>') },
  ],
};

// C-family and other languages share one generic table.
const genericRules = (kw: string, extraBuiltins = ''): Rule[] => [
  { t: 'com', re: sticky('\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)|#[^\\n]*') },
  { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|\'(?:\\\\.|[^\'\\\\])*\'?') },
  { t: 'dec', re: sticky('^\\s*#[a-z]+[^\\n]*') },
  { t: 'num', re: sticky('\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[fFlLuU]*\\b') },
  { t: 'bool', re: words('true false null nil None TRUE FALSE NULL') },
  { t: 'kw', re: words(kw) },
  ...(extraBuiltins ? [{ t: 'bi' as const, re: words(extraBuiltins) }] : []),
  { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_]*\\b') },
  { t: 'fn', re: sticky('\\b[A-Za-z_][\\w]*(?=\\s*\\()') },
  { t: 'op', re: sticky('->|=>|::|[<>!=]=?|&&|\\|\\||[+\\-*/%&|^!~?]') },
  { t: 'pn', re: sticky('[{}()[\\];,.:]') },
];

RULES.c = genericRules(C_KEYWORDS, 'printf scanf malloc calloc realloc free strlen strcpy strcmp memcpy memset');
RULES.cpp = genericRules(`${C_KEYWORDS} auto constexpr decltype namespace template typename using override final noexcept static_cast dynamic_cast const_cast reinterpret_cast public private protected class struct`, 'std cout cin endl vector string map unordered_map unique_ptr shared_ptr make_unique make_shared push_back size begin end');
RULES.csharp = genericRules(`${JAVA_KEYWORDS} namespace using var decimal string object dynamic async await nameof get set add remove partial readonly ref out params lock async yield`, 'Console WriteLine ReadLine Task List Dictionary String Math Convert');
RULES.php = genericRules('abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield', 'strlen count array_map array_filter implode explode json_encode json_decode');
RULES.ruby = [
  { t: 'com', re: sticky('#[^\\n]*|=begin[\\s\\S]*?(?:=end|$)') },
  { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|\'(?:\\\\.|[^\'\\\\])*\'?|%[wWiI]?[({\\[][\\s\\S]*?[)}\\]]') },
  { t: 'var', re: sticky('[@$][@A-Za-z_][\\w]*') },
  { t: 'rx', re: sticky(':[A-Za-z_][\\w]*') },
  { t: 'num', re: sticky('\\b0[xXbBoO][0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?\\b') },
  { t: 'kw', re: words('def class module end if elsif else unless while until for in do begin rescue ensure return yield block_given? require require_relative include extend attr_accessor attr_reader attr_writer self super then case when nil true false and or not lambda proc new raise') },
  { t: 'bi', re: words('puts print p gets map each select reject reduce inject sort filter first last size length to_s to_i to_f keys values include? nil? empty?') },
  { t: 'ty', re: sticky('\\b[A-Z][A-Za-z0-9_]*\\b') },
  { t: 'fn', re: sticky('\\b[a-z_][\\w]*[?!=]?(?=\\s*[({\\s])') },
  { t: 'op', re: sticky('<=>|=>|->|\\|\\||&&|[<>!=]=?|[+\\-*/%&|^!~?]') },
  { t: 'pn', re: sticky('[{}()[\\];,.:]') },
];
RULES.yaml = [
  { t: 'com', re: sticky('#[^\\n]*') },
  { t: 'pr', re: sticky('^[ \\t]*-?[ \\t]*[\\w.$-]+(?=\\s*:(?:\\s|$))') },
  { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|\'[^\']*\'?') },
  { t: 'bool', re: words('true false yes no on off null none True False Yes No Null') },
  { t: 'num', re: sticky('\\b-?\\d+(?:\\.\\d+)?\\b') },
  { t: 'dec', re: sticky('^[ \\t]*-[ \\t]*(?=[^\\s])|&[\\w]+|\\*[\\w]+|![\\w!]+') },
  { t: 'pn', re: sticky('[:|>{}\\[\\],]') },
];

const FALLBACK: Rule[] = [
  { t: 'com', re: sticky('\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)') },
  { t: 'str', re: sticky('"(?:\\\\.|[^"\\\\])*"?|\'(?:\\\\.|[^\'\\\\])*\'?|`[^`]*`?') },
  { t: 'num', re: sticky('\\b\\d+(?:\\.\\d+)?\\b') },
  { t: 'op', re: sticky('[+\\-*/%<>=!&|^~?]+') },
  { t: 'pn', re: sticky('[{}()[\\];,.:]') },
];

export function rulesFor(lang: Language): Rule[] {
  return RULES[lang] ?? FALLBACK;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export interface HighlightToken {
  type: TokenType | 'plain';
  text: string;
}

/** Tokenize source into typed spans without producing any HTML. */
export function tokenizeCode(code: string, lang: Language): HighlightToken[] {
  const rules = rulesFor(lang);
  const out: HighlightToken[] = [];
  let i = 0;
  let plainStart = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) out.push({ type: 'plain', text: code.slice(plainStart, end) });
  };

  while (i < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(code);
      if (m && m[0].length > 0) {
        flushPlain(i);
        out.push({ type: rule.t, text: m[0] });
        i += m[0].length;
        plainStart = i;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  flushPlain(code.length);
  return mergeTokens(out);
}

/** Collapse adjacent plain runs so the DOM stays small. */
function mergeTokens(tokens: HighlightToken[]): HighlightToken[] {
  const out: HighlightToken[] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    if (last && last.type === 'plain' && t.type === 'plain') last.text += t.text;
    else out.push({ ...t });
  }
  return out;
}

/** Highlight to an HTML string (safe: all text is escaped). */
export function highlight(code: string, lang: Language): string {
  return tokenizeCode(code, lang)
    .map((t) => (t.type === 'plain' ? escapeHtml(t.text) : `<span class="tk-${t.type}">${escapeHtml(t.text)}</span>`))
    .join('');
}

/** Line numbers as a separate gutter string, so they never affect selection. */
export function lineNumbers(code: string): string {
  const n = code.split('\n').length;
  return Array.from({ length: n }, (_, i) => i + 1).join('\n');
}
