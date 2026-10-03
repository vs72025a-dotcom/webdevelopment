/**
 * Solar position maths for the Auto theme.
 *
 * A compact NOAA-style approximation: it computes sunrise and sunset for a
 * latitude/longitude and date to within a couple of minutes, which is far more
 * than enough to decide whether it is night outside.
 *
 * Location is best-effort and never required: geolocation is offered, and if it
 * is declined the longitude is estimated from the timezone's UTC offset and a
 * mid-latitude default is used.
 */

export interface GeoPosition {
  latitude: number;
  longitude: number;
  source: 'geolocation' | 'timezone-estimate' | 'default';
  label: string;
}

const RADIANS = Math.PI / 180;

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

/** Estimate a position from the browser's timezone offset when geolocation is refused. */
export function estimatePosition(): GeoPosition {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // getTimezoneOffset() is minutes to ADD to local to reach UTC, so it is
  // negative east of Greenwich — negate it to get the familiar UTC+5:30 form,
  // and 15 degrees of longitude per hour gives a plausible meridian.
  const offsetHours = -new Date().getTimezoneOffset() / 60;
  const longitude = Math.max(-180, Math.min(180, offsetHours * 15));
  // Mid-latitude default: keeps day length seasonally plausible without asking.
  const latitude = Math.abs(longitude) > 100 ? 38 : 30;
  return {
    latitude,
    longitude,
    source: 'timezone-estimate',
    label: `${timeZone} (longitude estimated from UTC${offsetHours >= 0 ? '+' : ''}${offsetHours.toFixed(1)})`,
  };
}

export function requestPosition(): Promise<GeoPosition> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(estimatePosition());
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(estimatePosition());
      }
    }, 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: 'geolocation',
          label: `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`,
        });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(estimatePosition());
      },
      { timeout: 3500, maximumAge: 3600000 },
    );
  });
}

export interface SolarTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dayLengthMinutes: number;
  isDaylight: boolean;
  /** 0 = deep night, 1 = solar noon. Smooth across dawn and dusk. */
  elevation: number;
}

/**
 * Compute sunrise/sunset for a date and position.
 * Returns null for polar day/night, where the sun never crosses the horizon.
 */
export function solarTimes(date: Date, pos: GeoPosition): SolarTimes | null {
  const n = dayOfYear(date);
  const zenith = 90.833; // official sunrise/sunset zenith (refraction + solar disc)

  const compute = (rising: boolean): number | null => {
    // Approximate time
    const lngHour = pos.longitude / 15;
    const t = rising
      ? n + (6 - lngHour) / 24
      : n + (18 - lngHour) / 24;
    // Sun's mean anomaly and true longitude
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * RADIANS) + 0.020 * Math.sin(2 * M * RADIANS) + 282.634;
    L = ((L % 360) + 360) % 360;
    // Right ascension
    let RA = Math.atan(0.91764 * Math.tan(L * RADIANS)) / RADIANS;
    RA = ((RA % 360) + 360) % 360;
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;
    // Sun's declination
    const sinDec = 0.39782 * Math.sin(L * RADIANS);
    const cosDec = Math.cos(Math.asin(sinDec));
    // Hour angle
    const cosH =
      (Math.cos(zenith * RADIANS) - sinDec * Math.sin(pos.latitude * RADIANS)) /
      (cosDec * Math.cos(pos.latitude * RADIANS));
    if (cosH > 1 || cosH < -1) return null; // never rises / never sets
    const H = (rising ? 360 - Math.acos(cosH) / RADIANS : Math.acos(cosH) / RADIANS) / 15;
    // Local mean time, then UTC
    const T = H + RA - 0.06571 * t - 6.622;
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;
    // UT is hours since UTC midnight of the *local* calendar day, so this is
    // already the true instant — format it in the local zone to read wall time.
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + UT * 3600000;
  };

  const rise0 = compute(true);
  const set0 = compute(false);
  if (rise0 === null || set0 === null) return null;

  // Each event is solved independently against UTC midnight of the local
  // calendar day, so for longitudes far from Greenwich one of them lands on the
  // wrong side of the date line (sunrise after sunset). Resolve the ±24h
  // ambiguity by nudging the eastern-hemisphere sunrise back and the
  // western-hemisphere sunset forward.
  let rise = rise0;
  let set = set0;
  if (set <= rise) {
    if (pos.longitude >= 0) rise -= 86400000;
    else set += 86400000;
  }

  const sunrise = new Date(rise);
  const sunset = new Date(set);
  const solarNoon = new Date((rise + set) / 2);
  const now = date.getTime();
  const isDaylight = now >= rise && now <= set;

  // Smooth elevation proxy: -1 at midnight, 1 at solar noon.
  const halfDay = Math.max(1, (set - rise) / 2);
  const raw = 1 - Math.abs(now - solarNoon.getTime()) / halfDay;
  const elevation = Math.max(-1, Math.min(1, raw));

  return {
    sunrise,
    sunset,
    solarNoon,
    dayLengthMinutes: Math.round((set - rise) / 60000),
    isDaylight,
    elevation,
  };
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
