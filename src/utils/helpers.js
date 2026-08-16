import slugify from 'slugify';

export function generateSlug(text) {
  return slugify(text, { lower: true, strict: true });
}

export function generateBookingNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AL-${rand}`;
}

export function safeJsonParse(jsonString, fallback = []) {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    return fallback;
  }
}

export function safeJsonStringify(data) {
  if (data === undefined || data === null) return '[]';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch (err) {
    return '[]';
  }
}

// CSV-safe field: quotes + doubles inner quotes, and neutralizes spreadsheet
// formula injection (=, +, -, @) which can execute when opened in Excel.
export function csvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
