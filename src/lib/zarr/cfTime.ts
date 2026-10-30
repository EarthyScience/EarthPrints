/**
 * CF time coordinates (`<unit> since <date>`, with a `calendar` attribute)
 * decoded to UTC milliseconds.
 *
 * Model calendars have no real-world instants: a `noleap` or `360_day` date is
 * only a label. Each value is therefore read in its own calendar as a
 * year-month-day plus a time of day, and that label is placed on the
 * proleptic Gregorian axis the plots use. A `360_day` February 30th rolls over
 * into March, and a `noleap` year simply has no February 29th.
 */

const MS_PER_DAY = 86_400_000;

export type CalendarName =
  | "standard"
  | "julian"
  | "noleap"
  | "all_leap"
  | "360_day";

const CALENDAR_ALIASES: Record<string, CalendarName> = {
  standard: "standard",
  gregorian: "standard",
  proleptic_gregorian: "standard",
  julian: "julian",
  noleap: "noleap",
  "365_day": "noleap",
  all_leap: "all_leap",
  "366_day": "all_leap",
  "360_day": "360_day",
};

export function normalizeCalendar(calendar: unknown): CalendarName | null {
  if (calendar === undefined || calendar === null) return "standard";
  if (typeof calendar !== "string") return null;
  return CALENDAR_ALIASES[calendar.trim().toLowerCase()] ?? null;
}

type Civil = { year: number; month: number; day: number };

/** `Date.UTC` reads years 0 to 99 as 1900 to 1999; model runs start at year 1. */
function utcMidnight(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

const NOLEAP_MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ALL_LEAP_MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function fixedYearDays(months: readonly number[], { year, month, day }: Civil) {
  const yearLength = months.reduce((sum, days) => sum + days, 0);
  let days = year * yearLength;
  for (let m = 0; m < month - 1; m++) days += months[m]!;
  return days + day - 1;
}

function fixedYearCivil(months: readonly number[], count: number): Civil {
  const yearLength = months.reduce((sum, days) => sum + days, 0);
  const year = Math.floor(count / yearLength);
  let rest = count - year * yearLength;
  let month = 0;
  while (rest >= months[month]!) {
    rest -= months[month]!;
    month++;
  }
  return { year, month: month + 1, day: rest + 1 };
}

// Julian day number arithmetic, from Richards (2013), valid for all years.
function julianToJdn({ year, month, day }: Civil): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

function jdnToJulian(jdn: number): Civil {
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  };
}

/** Whole days from the calendar's own epoch to a date. */
function toDayCount(calendar: CalendarName, civil: Civil): number {
  switch (calendar) {
    case "standard":
      return Math.round(
        utcMidnight(civil.year, civil.month, civil.day) / MS_PER_DAY,
      );
    case "julian":
      return julianToJdn(civil);
    case "noleap":
      return fixedYearDays(NOLEAP_MONTHS, civil);
    case "all_leap":
      return fixedYearDays(ALL_LEAP_MONTHS, civil);
    case "360_day":
      return civil.year * 360 + (civil.month - 1) * 30 + civil.day - 1;
  }
}

function fromDayCount(calendar: CalendarName, count: number): Civil {
  switch (calendar) {
    case "standard": {
      const date = new Date(count * MS_PER_DAY);
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
      };
    }
    case "julian":
      return jdnToJulian(count);
    case "noleap":
      return fixedYearCivil(NOLEAP_MONTHS, count);
    case "all_leap":
      return fixedYearCivil(ALL_LEAP_MONTHS, count);
    case "360_day":
      return {
        year: Math.floor(count / 360),
        month: Math.floor((count % 360 + 360) % 360 / 30) + 1,
        day: (((count % 30) + 30) % 30) + 1,
      };
  }
}

const UNIT_MS: Record<string, number> = {
  microsecond: 1e-3,
  microseconds: 1e-3,
  us: 1e-3,
  millisecond: 1,
  milliseconds: 1,
  ms: 1,
  second: 1000,
  seconds: 1000,
  sec: 1000,
  secs: 1000,
  s: 1000,
  minute: 60_000,
  minutes: 60_000,
  min: 60_000,
  mins: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  h: 3_600_000,
  day: MS_PER_DAY,
  days: MS_PER_DAY,
  d: MS_PER_DAY,
  week: 7 * MS_PER_DAY,
  weeks: 7 * MS_PER_DAY,
};

export type CfTimeUnits = {
  /** Length of one unit in ms, or a calendar month/year step. */
  unit: { ms: number } | { months: number };
  reference: Civil & { msOfDay: number };
};

/** Parse `days since 2001-01-01 00:00:00`, `hours since 1900-1-1`, and so on. */
export function parseCfUnits(units: unknown): CfTimeUnits | null {
  if (typeof units !== "string") return null;
  const match = units
    .trim()
    .match(
      /^(\w+)\s+since\s+(-?\d{1,6})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?)?\s*(Z|UTC|[+-]\d{1,2}(?::?\d{2})?)?\s*$/i,
    );
  if (!match) return null;

  const [, rawUnit, y, mo, d, hh, mm, ss, zone] = match;
  const unitName = rawUnit!.toLowerCase();
  let unit: CfTimeUnits["unit"];
  if (unitName in UNIT_MS) unit = { ms: UNIT_MS[unitName]! };
  else if (unitName === "month" || unitName === "months") unit = { months: 1 };
  else if (unitName === "year" || unitName === "years") unit = { months: 12 };
  else return null;

  let msOfDay =
    (Number(hh ?? 0) * 3600 + Number(mm ?? 0) * 60 + Number(ss ?? 0)) * 1000;
  if (zone && !/^(z|utc)$/i.test(zone)) {
    const [, sign, zh, zm] = zone.match(/^([+-])(\d{1,2}):?(\d{2})?$/) ?? [];
    const offset = (Number(zh ?? 0) * 60 + Number(zm ?? 0)) * 60_000;
    msOfDay -= sign === "-" ? -offset : offset;
  }

  return {
    unit,
    reference: { year: Number(y), month: Number(mo), day: Number(d), msOfDay },
  };
}

/**
 * Decode raw time values to UTC ms. Returns null when the units or calendar
 * are not ones we can read.
 */
export function decodeCfTimes(
  raw: ArrayLike<number | bigint>,
  units: unknown,
  calendar?: unknown,
): Float64Array | null {
  const parsed = parseCfUnits(units);
  const cal = normalizeCalendar(calendar);
  if (!parsed || !cal) return null;

  const refDays = toDayCount(cal, parsed.reference);
  const out = new Float64Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    const value = Number(raw[i]);
    if (!Number.isFinite(value)) {
      out[i] = NaN;
      continue;
    }

    if ("months" in parsed.unit) {
      const totalMonths =
        parsed.reference.month - 1 + Math.round(value * parsed.unit.months);
      const year = parsed.reference.year + Math.floor(totalMonths / 12);
      const month = (((totalMonths % 12) + 12) % 12) + 1;
      out[i] =
        utcMidnight(year, month, parsed.reference.day) +
        parsed.reference.msOfDay;
      continue;
    }

    const elapsedMs = parsed.reference.msOfDay + value * parsed.unit.ms;
    const dayShift = Math.floor(elapsedMs / MS_PER_DAY);
    const msOfDay = elapsedMs - dayShift * MS_PER_DAY;
    const civil = fromDayCount(cal, refDays + dayShift);
    out[i] = utcMidnight(civil.year, civil.month, civil.day) + msOfDay;
  }

  return out;
}
