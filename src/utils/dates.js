/** Format a Date as a local (not UTC) YYYY-MM-DD calendar date. */
export function localDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local YYYY-MM-DD for `days` from now (negative allowed). */
export function localDateOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return localDateStr(d);
}

export default { localDateStr, localDateOffset };
