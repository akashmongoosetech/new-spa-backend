/**
 * Field normalization helpers.
 *
 * The frontend sends BOTH snake_case (AdminServiceFormPage, AdminTherapistFormPage)
 * and camelCase (ServiceManager, TherapistManager) payloads for the same entities,
 * and the response mappers read both conventions. These helpers make the backend
 * accept either on input (canonical = snake_case storage) and emit BOTH on output.
 */

export function pick(defs, body) {
  const out = {};
  for (const [key, canonical] of Object.entries(defs)) {
    if (body[key] !== undefined) {
      out[canonical] = body[key];
    }
  }
  return out;
}

const snakeCache = {};
export function toSnake(key) {
  if (snakeCache[key]) return snakeCache[key];
  const out = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  snakeCache[key] = out;
  return out;
}

const camelCache = {};
export function toCamel(key) {
  if (camelCache[key]) return camelCache[key];
  const out = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  camelCache[key] = out;
  return out;
}

/**
 * Return an object containing BOTH snake_case and camelCase versions of the
 * given canonical keys. Used so every frontend mapper works unchanged.
 */
export function bothCase(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      out[toSnake(key)] = source[key];
      out[toCamel(key)] = source[key];
    }
  }
  return out;
}

/**
 * Map a possibly-nested "seo" settings object to flat camelCase keys the
 * frontend's mapBusinessSettings understands (it reads s.seo?.metaTitle || s.metaTitle).
 */
export function flattenSeo(source) {
  const seo = source.seo && typeof source.seo === 'object' ? source.seo : {};
  return {
    metaTitle: source.metaTitle ?? seo.metaTitle,
    metaDescription: source.metaDescription ?? seo.metaDescription,
    keywords: source.keywords ?? seo.keywords,
    ogImage: source.ogImage ?? seo.ogImage,
    twitterCard: source.twitterCard ?? seo.twitterCard,
    enableJsonLd: source.enableJsonLd ?? seo.enableJsonLd,
    robotsTxt: source.robotsTxt ?? seo.robotsTxt,
  };
}

export default { pick, toSnake, toCamel, bothCase, flattenSeo };