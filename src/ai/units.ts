/**
 * Unit conversion engine.
 *
 * Linear units are expressed as a factor to a canonical base unit; affine units
 * (temperature) carry explicit to/from functions because they have an offset.
 * Every factor is exact or traceable to a defined standard.
 */

export type UnitKind =
  | 'length' | 'mass' | 'temperature' | 'data' | 'time' | 'speed'
  | 'area' | 'volume' | 'energy' | 'power' | 'pressure' | 'angle' | 'frequency';

interface LinearUnit {
  id: string;
  name: string;
  aliases: string[];
  factor: number; // multiplier to base unit
  system: 'metric' | 'imperial' | 'us' | 'other';
}

interface AffineUnit {
  id: string;
  name: string;
  aliases: string[];
  system: 'metric' | 'imperial' | 'us' | 'other';
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

type Unit = LinearUnit | AffineUnit;

function lin(id: string, name: string, aliases: string[], factor: number, system: LinearUnit['system']): LinearUnit {
  return { id, name, aliases, factor, system };
}

const CATEGORIES: Record<UnitKind, Unit[]> = {
  length: [
    lin('nm', 'nanometre', ['nm', 'nanometer', 'nanometres'], 1e-9, 'metric'),
    lin('um', 'micrometre', ['um', 'µm', 'micron', 'micrometer', 'micrometres'], 1e-6, 'metric'),
    lin('mm', 'millimetre', ['mm', 'millimeter', 'millimetres'], 1e-3, 'metric'),
    lin('cm', 'centimetre', ['cm', 'centimeter', 'centimetres'], 1e-2, 'metric'),
    lin('m', 'metre', ['m', 'meter', 'metres', 'meters'], 1, 'metric'),
    lin('km', 'kilometre', ['km', 'kilometer', 'kilometres'], 1e3, 'metric'),
    lin('Mm', 'megametre', ['megameter', 'megametre'], 1e6, 'metric'),
    lin('in', 'inch', ['in', 'inch', 'inches', '"'], 0.0254, 'imperial'),
    lin('ft', 'foot', ['ft', 'foot', 'feet', "'"], 0.3048, 'imperial'),
    lin('yd', 'yard', ['yd', 'yard', 'yards'], 0.9144, 'imperial'),
    lin('mi', 'mile', ['mi', 'mile', 'miles'], 1609.344, 'imperial'),
    lin('nmi', 'nautical mile', ['nmi', 'nauticalmile', 'nautical miles'], 1852, 'other'),
    lin('ly', 'light-year', ['ly', 'lightyear', 'light-year', 'light years'], 9.4607304725808e15, 'other'),
    lin('au', 'astronomical unit', ['au', 'astronomicalunit'], 1.495978707e11, 'other'),
    lin('pc', 'parsec', ['pc', 'parsec', 'parsecs'], 3.0856775814913673e16, 'other'),
  ],
  mass: [
    lin('ug', 'microgram', ['ug', 'µg', 'microgram'], 1e-9, 'metric'),
    lin('mg', 'milligram', ['mg', 'milligram'], 1e-6, 'metric'),
    lin('g', 'gram', ['g', 'gram', 'grams', 'gm'], 1e-3, 'metric'),
    lin('kg', 'kilogram', ['kg', 'kilogram', 'kilograms', 'kilo'], 1, 'metric'),
    lin('t', 'tonne', ['t', 'tonne', 'tonnes', 'metric ton', 'metricton'], 1e3, 'metric'),
    lin('oz', 'ounce', ['oz', 'ounce', 'ounces'], 0.028349523125, 'imperial'),
    lin('lb', 'pound', ['lb', 'lbs', 'pound', 'pounds'], 0.45359237, 'imperial'),
    lin('st', 'stone', ['st', 'stone', 'stones'], 6.35029318, 'imperial'),
    lin('ton_us', 'US ton', ['us ton', 'short ton', 'shortton'], 907.18474, 'us'),
    lin('ton_uk', 'imperial ton', ['imperial ton', 'long ton', 'longton'], 1016.0469088, 'imperial'),
  ],
  temperature: [
    { id: 'C', name: 'Celsius', aliases: ['c', 'celsius', 'centigrade', '°c'], system: 'metric', toBase: (v) => v, fromBase: (v) => v },
    { id: 'F', name: 'Fahrenheit', aliases: ['f', 'fahrenheit', '°f'], system: 'us', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
    { id: 'K', name: 'Kelvin', aliases: ['k', 'kelvin'], system: 'metric', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    { id: 'R', name: 'Rankine', aliases: ['r', 'rankine', '°r'], system: 'us', toBase: (v) => ((v - 491.67) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 491.67 },
  ],
  data: [
    lin('bit', 'bit', ['bit', 'bits'], 1 / 8, 'other'),
    lin('kbit', 'kilobit', ['kbit', 'kb/s', 'kilobits'], 1e3 / 8, 'metric'),
    lin('mbit', 'megabit', ['mbit', 'mbps', 'mb/s', 'megabits'], 1e6 / 8, 'metric'),
    lin('gbit', 'gigabit', ['gbit', 'gbps', 'gb/s', 'gigabits'], 1e9 / 8, 'metric'),
    lin('B', 'byte', ['byte', 'bytes', 'b', 'octet'], 1, 'other'),
    lin('KB', 'kilobyte', ['kb', 'kilobyte', 'kilobytes'], 1e3, 'metric'),
    lin('MB', 'megabyte', ['mb', 'megabyte', 'megabytes'], 1e6, 'metric'),
    lin('GB', 'gigabyte', ['gb', 'gigabyte', 'gigabytes'], 1e9, 'metric'),
    lin('TB', 'terabyte', ['tb', 'terabyte', 'terabytes'], 1e12, 'metric'),
    lin('PB', 'petabyte', ['pb', 'petabyte', 'petabytes'], 1e15, 'metric'),
    lin('KiB', 'kibibyte', ['kib', 'kibibyte', 'kibibytes'], 1024, 'other'),
    lin('MiB', 'mebibyte', ['mib', 'mebibyte', 'mebibytes'], 1024 ** 2, 'other'),
    lin('GiB', 'gibibyte', ['gib', 'gibibyte', 'gibibytes'], 1024 ** 3, 'other'),
    lin('TiB', 'tebibyte', ['tib', 'tebibyte', 'tebibytes'], 1024 ** 4, 'other'),
  ],
  time: [
    lin('ns', 'nanosecond', ['ns', 'nanosecond', 'nanoseconds'], 1e-9, 'metric'),
    lin('us', 'microsecond', ['µs', 'us', 'microsecond', 'microseconds'], 1e-6, 'metric'),
    lin('ms', 'millisecond', ['ms', 'millisecond', 'milliseconds'], 1e-3, 'metric'),
    lin('s', 'second', ['s', 'sec', 'second', 'seconds'], 1, 'metric'),
    lin('min', 'minute', ['min', 'minute', 'minutes'], 60, 'metric'),
    lin('h', 'hour', ['h', 'hr', 'hour', 'hours'], 3600, 'metric'),
    lin('d', 'day', ['d', 'day', 'days'], 86400, 'metric'),
    lin('wk', 'week', ['wk', 'week', 'weeks', 'w'], 604800, 'metric'),
    lin('mo', 'month', ['mo', 'month', 'months'], 2629800, 'other'),
    lin('yr', 'year', ['yr', 'year', 'years', 'y'], 31557600, 'other'),
    lin('decade', 'decade', ['decade', 'decades'], 315576000, 'other'),
  ],
  speed: [
    lin('mps', 'metres per second', ['m/s', 'mps', 'metres per second', 'meters per second'], 1, 'metric'),
    lin('kph', 'kilometres per hour', ['km/h', 'kph', 'kmh', 'kilometers per hour'], 1 / 3.6, 'metric'),
    lin('mph', 'miles per hour', ['mph', 'mi/h', 'miles per hour'], 0.44704, 'imperial'),
    lin('fps', 'feet per second', ['ft/s', 'fps', 'feet per second'], 0.3048, 'imperial'),
    lin('kn', 'knot', ['kn', 'knot', 'knots', 'kt'], 0.5144444444444445, 'other'),
    lin('mach', 'Mach', ['mach', 'ma'], 340.29, 'other'),
    lin('c', 'speed of light', ['c', 'lightspeed', 'speed of light'], 299792458, 'other'),
  ],
  area: [
    lin('mm2', 'square millimetre', ['mm2', 'mm^2', 'square millimeter'], 1e-6, 'metric'),
    lin('cm2', 'square centimetre', ['cm2', 'cm^2', 'square centimeter'], 1e-4, 'metric'),
    lin('m2', 'square metre', ['m2', 'm^2', 'sqm', 'square meter', 'square metres'], 1, 'metric'),
    lin('ha', 'hectare', ['ha', 'hectare', 'hectares'], 1e4, 'metric'),
    lin('km2', 'square kilometre', ['km2', 'km^2', 'square kilometer'], 1e6, 'metric'),
    lin('in2', 'square inch', ['in2', 'in^2', 'sq in', 'square inch'], 0.00064516, 'imperial'),
    lin('ft2', 'square foot', ['ft2', 'ft^2', 'sqft', 'sq ft', 'square foot', 'square feet'], 0.09290304, 'imperial'),
    lin('yd2', 'square yard', ['yd2', 'sqyd', 'square yard'], 0.83612736, 'imperial'),
    lin('acre', 'acre', ['acre', 'acres'], 4046.8564224, 'imperial'),
    lin('mi2', 'square mile', ['mi2', 'sq mi', 'square mile', 'square miles'], 2589988.110336, 'imperial'),
  ],
  volume: [
    lin('ml', 'millilitre', ['ml', 'milliliter', 'millilitres', 'cc', 'cm3'], 1e-6, 'metric'),
    lin('l', 'litre', ['l', 'liter', 'litre', 'liters', 'litres'], 1e-3, 'metric'),
    lin('m3', 'cubic metre', ['m3', 'cubic meter', 'cubic metre'], 1, 'metric'),
    lin('tsp', 'teaspoon (US)', ['tsp', 'teaspoon', 'teaspoons'], 4.92892159375e-6, 'us'),
    lin('tbsp', 'tablespoon (US)', ['tbsp', 'tablespoon', 'tablespoons'], 1.478676478125e-5, 'us'),
    lin('floz', 'fluid ounce (US)', ['fl oz', 'floz', 'fluid ounce', 'fluid ounces'], 2.95735295625e-5, 'us'),
    lin('cup', 'cup (US)', ['cup', 'cups'], 2.365882365e-4, 'us'),
    lin('pt', 'pint (US)', ['pt', 'pint', 'pints'], 4.73176473e-4, 'us'),
    lin('qt', 'quart (US)', ['qt', 'quart', 'quarts'], 9.46352946e-4, 'us'),
    lin('gal', 'gallon (US)', ['gal', 'gallon', 'gallons'], 3.785411784e-3, 'us'),
    lin('gal_uk', 'gallon (UK)', ['uk gallon', 'imperial gallon'], 4.54609e-3, 'imperial'),
  ],
  energy: [
    lin('j', 'joule', ['j', 'joule', 'joules'], 1, 'metric'),
    lin('kj', 'kilojoule', ['kj', 'kilojoule', 'kilojoules'], 1e3, 'metric'),
    lin('cal', 'calorie', ['cal', 'calorie', 'calories'], 4.184, 'other'),
    lin('kcal', 'kilocalorie', ['kcal', 'kilocalorie', 'kilocalories', 'food calorie'], 4184, 'other'),
    lin('wh', 'watt-hour', ['wh', 'watt-hour', 'watt hour'], 3600, 'other'),
    lin('kwh', 'kilowatt-hour', ['kwh', 'kilowatt-hour', 'kilowatt hour'], 3.6e6, 'other'),
    lin('ev', 'electronvolt', ['ev', 'electronvolt'], 1.602176634e-19, 'other'),
    lin('btu', 'BTU', ['btu', 'btus'], 1055.05585262, 'imperial'),
  ],
  power: [
    lin('w', 'watt', ['w', 'watt', 'watts'], 1, 'metric'),
    lin('kw', 'kilowatt', ['kw', 'kilowatt', 'kilowatts'], 1e3, 'metric'),
    lin('mw', 'megawatt', ['mw', 'megawatt'], 1e6, 'metric'),
    lin('hp', 'horsepower', ['hp', 'horsepower'], 745.6998715822702, 'imperial'),
    lin('btuh', 'BTU per hour', ['btu/h', 'btuh'], 0.2930710701722222, 'imperial'),
  ],
  pressure: [
    lin('pa', 'pascal', ['pa', 'pascal', 'pascals'], 1, 'metric'),
    lin('kpa', 'kilopascal', ['kpa', 'kilopascal'], 1e3, 'metric'),
    lin('bar', 'bar', ['bar', 'bars'], 1e5, 'metric'),
    lin('atm', 'atmosphere', ['atm', 'atmosphere', 'atmospheres'], 101325, 'other'),
    lin('psi', 'pound per square inch', ['psi'], 6894.757293168361, 'imperial'),
    lin('mmhg', 'millimetre of mercury', ['mmhg', 'torr'], 133.322387415, 'other'),
  ],
  angle: [
    lin('deg', 'degree', ['deg', 'degree', 'degrees', '°'], 1, 'other'),
    lin('rad', 'radian', ['rad', 'radian', 'radians'], 180 / Math.PI, 'other'),
    lin('grad', 'gradian', ['grad', 'gradian', 'gradians', 'gon'], 0.9, 'other'),
    lin('arcmin', 'arcminute', ['arcmin', 'arcminute', "'", 'minutes of arc'], 1 / 60, 'other'),
    lin('arcsec', 'arcsecond', ['arcsec', 'arcsecond', '"', 'seconds of arc'], 1 / 3600, 'other'),
    lin('turn', 'turn', ['turn', 'turns', 'revolution', 'revolutions'], 360, 'other'),
  ],
  frequency: [
    lin('hz', 'hertz', ['hz', 'hertz'], 1, 'metric'),
    lin('khz', 'kilohertz', ['khz', 'kilohertz'], 1e3, 'metric'),
    lin('mhz', 'megahertz', ['mhz', 'megahertz'], 1e6, 'metric'),
    lin('ghz', 'gigahertz', ['ghz', 'gigahertz'], 1e9, 'metric'),
    lin('rpm', 'revolutions per minute', ['rpm'], 1 / 60, 'other'),
  ],
};

/**
 * An alias can legitimately belong to several categories ("c" is Celsius and the
 * speed of light, "w" is watt and week), so the index stores *all* candidates
 * and resolution is disambiguated by the category of the other operand.
 */
type Candidate = { kind: UnitKind; unit: Unit };
const ALIAS_INDEX = new Map<string, Candidate[]>();

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/°/g, '');
}

function indexAlias(alias: string, candidate: Candidate): void {
  const key = norm(alias);
  if (!key) return;
  const list = ALIAS_INDEX.get(key);
  if (!list) ALIAS_INDEX.set(key, [candidate]);
  else if (!list.some((c) => c.kind === candidate.kind)) list.push(candidate);
}

// Category declaration order doubles as ambiguity priority (temperature before
// speed means a bare "c" reads as Celsius, which is what people almost always mean).
for (const [kind, units] of Object.entries(CATEGORIES) as Array<[UnitKind, Unit[]]>) {
  for (const u of units) {
    const candidate: Candidate = { kind, unit: u };
    indexAlias(u.id, candidate);
    indexAlias(u.name, candidate);
    for (const a of u.aliases) indexAlias(a, candidate);
  }
}

export function candidatesFor(raw: string): Candidate[] {
  return ALIAS_INDEX.get(norm(raw)) ?? [];
}

export function lookupUnit(raw: string, preferKind?: UnitKind): Candidate | null {
  const list = candidatesFor(raw);
  if (!list.length) return null;
  if (preferKind) {
    const hit = list.find((c) => c.kind === preferKind);
    if (hit) return hit;
  }
  return list[0];
}

function isAffine(u: Unit): u is AffineUnit {
  return typeof (u as AffineUnit).toBase === 'function';
}

export interface ConversionResult {
  value: number;
  from: string;
  to: string;
  kind: UnitKind;
  formatted: string;
  base: number;
  all: Array<{ unit: string; name: string; value: number; text: string; formatted: string }>;
  note?: string;
}

export class ConversionError extends Error {}

/** Convert `value` from one unit to another, plus a table of common targets. */
export function convert(value: number, fromRaw: string, toRaw?: string): ConversionResult {
  const fromCands = candidatesFor(fromRaw);
  if (!fromCands.length) {
    throw new ConversionError(`Unknown unit "${fromRaw}". Try m, km, ft, mi, kg, lb, °C, GB, s, mph…`);
  }
  const toCands = toRaw ? candidatesFor(toRaw) : [];
  if (toRaw && !toCands.length) throw new ConversionError(`Unknown unit "${toRaw}".`);

  // Resolve ambiguous aliases jointly: "100 w to kw" must read w as watt even
  // though "w" is also week, because the target is unambiguously power.
  let from = fromCands[0];
  let to = toCands[0];
  if (to) {
    const sameKind = toCands.find((c) => c.kind === from.kind);
    if (sameKind) to = sameKind;
    else {
      const altFrom = fromCands.find((c) => toCands.some((tc) => tc.kind === c.kind));
      if (altFrom) {
        from = altFrom;
        to = toCands.find((c) => c.kind === altFrom.kind) ?? to;
      }
    }
  }

  const base = isAffine(from.unit) ? from.unit.toBase(value) : value * from.unit.factor;

  const applyTo = (u: Unit): number => (isAffine(u) ? u.fromBase(base) : base / u.factor);

  const fmt = (v: number) => {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '-∞';
    const abs = Math.abs(v);
    if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return v.toExponential(6).replace('e+', 'e');
    const r = Number(v.toPrecision(12));
    const int = Number.isInteger(r) && Math.abs(r) < 1e15;
    return int
      ? r.toLocaleString('en-US')
      : r.toLocaleString('en-US', { maximumFractionDigits: abs < 1 ? 8 : 6 });
  };

  const peers = CATEGORIES[from.kind]
    .map((u) => {
      const v = applyTo(u);
      return { unit: u.id, name: u.name, value: v, text: fmt(v), formatted: `${fmt(v)} ${u.id}` };
    })
    .filter((row) => row.unit !== from.unit.id)
    .slice(0, 9);

  if (!toRaw) {
    return {
      value: base,
      from: from.unit.id,
      to: '(base)',
      kind: from.kind,
      formatted: `${fmt(value)} ${from.unit.id} = ${fmt(base)} base ${from.kind} unit`,
      base,
      all: peers,
    };
  }

  if (to.kind !== from.kind) {
    throw new ConversionError(
      `Cannot convert ${from.kind} (${from.unit.id}) to ${to.kind} (${to.unit.id}) — they measure different physical quantities.`,
    );
  }

  const result = applyTo(to.unit);
  let note: string | undefined;
  if (from.kind === 'temperature') note = 'Temperature conversion is affine (it has an offset), not a simple scaling.';
  if (from.kind === 'data' && /kib|mib|gib|tib/.test(to.unit.id) !== /kib|mib|gib|tib/.test(from.unit.id)) {
    note = 'Decimal (kB = 1000 B) and binary (KiB = 1024 B) units are mixed here — the table shows both.';
  }
  if (from.kind === 'time' && ['mo', 'yr', 'decade'].includes(to.unit.id)) {
    note = 'Months and years use the mean Gregorian values (30.4375 days, 365.25 days).';
  }

  return {
    value: result,
    from: from.unit.id,
    to: to.unit.id,
    kind: from.kind,
    formatted: `${fmt(value)} ${from.unit.id} = ${fmt(result)} ${to.unit.id}`,
    base,
    all: peers,
    note,
  };
}

/** Parse "12 kg to lb", "convert 100 °F to °C". Returns null when it is not a conversion request. */
export function parseConversionRequest(text: string): { value: number; from: string; to?: string } | null {
  const t = text.trim().toLowerCase().replace(/[?,.!]+$/, '');

  // Word order B: "how many miles is 5 km" / "how many minutes in 2 hours"
  const b = t.match(
    /how\s+(?:many|much)\s+([a-zµ°/^.\s"']+?)\s+(?:is|are|in|to)\s+(-?\d+(?:[.,]\d+)?)\s*([a-zµ°/^.\s"']+)$/,
  );
  if (b) {
    const to = b[1].trim();
    const value = Number(b[2].replace(',', '.'));
    const from = b[3].trim();
    const fromUnit = lookupUnit(from);
    if (fromUnit && lookupUnit(to, fromUnit.kind)?.kind === fromUnit.kind) return { value, from, to };
  }

  // Word order A: "5 km to miles" / "convert 100 F in C"
  const m = t.match(
    /(-?\d+(?:[.,]\d+)?)\s*([a-zµ°/^.\s"']+?)(?:\s+(?:to|in|into|as|->|=>)\s+([a-zµ°/^.\s"']+))?$/,
  );
  if (!m) return null;

  const hasTarget = Boolean(m[3]?.trim());
  // Without an explicit target we still need a conversion cue, otherwise
  // "I ran 5 km today" would be misread as a request for a unit table.
  const hasCue = /\b(convert|conversion|change|equals?|equal to|how many|how much is|in terms of|to|into)\b/.test(t);
  if (!hasTarget && !hasCue) return null;

  const value = Number(m[1].replace(',', '.'));
  const from = m[2].trim();
  const to = m[3]?.trim() || undefined;
  const fromUnit = lookupUnit(from);
  if (!fromUnit) return null;
  if (to && !lookupUnit(to, fromUnit.kind)) return null;
  if (to && lookupUnit(to, fromUnit.kind)?.kind !== fromUnit.kind) return null;
  return { value, from, to };
}

export function listCategories(): UnitKind[] {
  return Object.keys(CATEGORIES) as UnitKind[];
}

export function unitsFor(kind: UnitKind): Array<{ id: string; name: string; system: string }> {
  return CATEGORIES[kind].map((u) => ({ id: u.id, name: u.name, system: u.system }));
}
