// Shared date helpers — safe to use in browser components AND in server-side
// PDF rendering (/api/rasid-generate), so no browser-only APIs here.
//
// Dates in this project come in many shapes:
//   - Firestore Timestamp (has .toDate())
//   - serialized Timestamp: { seconds } or { _seconds }
//   - epoch millis / seconds (number)
//   - "DD-MM-YYYY" / "DD/MM/YYYY"  (closing_date, marriage_date, bobDate…)
//   - "YYYY-MM-DD" / ISO strings    (paymentDate, createdAt…)
// `new Date("25-03-2026")` is Invalid Date, which is why sorting on the raw
// strings put rows in the wrong order. Always go through toDateObj().

export function toDateObj(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return isNaN(d?.getTime()) ? null : d;
  }

  if (typeof value === 'object') {
    const secs = value.seconds ?? value._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000);
    return null;
  }

  if (typeof value === 'number') {
    // treat small numbers as unix seconds, large ones as millis
    return new Date(value < 1e11 ? value * 1000 : value);
  }

  if (typeof value === 'string') {
    const s = value.trim();

    // DD-MM-YYYY or DD/MM/YYYY (optionally followed by time)
    let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return isNaN(d.getTime()) ? null : d;
    }

    // YYYY-MM-DD (date only) — build as local date to avoid timezone shift
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return isNaN(d.getTime()) ? null : d;
    }

    // ISO / anything else Date can parse
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function toMillis(value) {
  const d = toDateObj(value);
  return d ? d.getTime() : 0;
}

const pad = (n) => String(n).padStart(2, '0');

/** Always returns "DD-MM-YYYY" (or the fallback when the date is missing/invalid). */
export function formatDate(value, fallback = '-') {
  const d = toDateObj(value);
  if (!d) return fallback;
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * Returns a NEW array sorted by date. Rows with no/invalid date go last.
 * @param {Array} list
 * @param {(item:any)=>any} getDate  returns the raw date value for an item
 * @param {'asc'|'desc'} dir
 */
export function sortByDate(list = [], getDate, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const ta = toMillis(getDate(a));
    const tb = toMillis(getDate(b));
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return (ta - tb) * sign;
  });
}

// Common getters so every screen / PDF sorts on the same field
export const getClosingDate = (m) =>
  m?.marriageDate || m?.closingDate || m?.closing_date || m?.marriage_date || m?.createdDate || null;

export const getPaidDate = (m) =>
  m?.paidDate || m?.paymentDate || m?.updatedDate || null;



const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse just about anything into a Date, or null when it is not a date. */
export const parseAnyDate = (value) => {
  if (value === null || value === undefined || value === '') return null;

  // Date / Firestore Timestamp ({ seconds } or .toDate())
  if (typeof value === 'object') {
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    const secs = value.seconds ?? value._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000);
    return null;
  }

  // Epoch — seconds or milliseconds
  if (typeof value === 'number') {
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  // 25-Apr, 2025 · 25 Apr 2025 · 25-April-2025
  let m = s.match(/^(\d{1,2})[\s\-/]*([A-Za-z]{3,})[,\s\-/]+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return new Date(+m[3], mo, +m[1]);
  }

  // 2025-04-25
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // 25-04-2025 · 25/04/2025  (day first — this is how the app writes dates)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Date → "25-04-2025" (DD-MM-YYYY). Unparseable input is returned unchanged. */
export const formatShortDate = (value, fallback = '-') => {
  const d = parseAnyDate(value);
  if (!d) return value ? String(value) : fallback;
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
};


