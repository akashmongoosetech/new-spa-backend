import slugify from 'slugify';

export function makeSlug(value, fallback = 'item') {
  const base = slugify(String(value || fallback), {
    lower: true,
    strict: true,
    trim: true,
  });
  return base || fallback;
}

/**
 * Generate a unique slug by checking the collection for collisions.
 */
export async function uniqueSlug(Model, value, existingId) {
  const base = makeSlug(value);
  let candidate = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = await Model.findOne({ slug: candidate }).select('_id').lean();
    if (!match || (existingId && match._id.toString() === existingId)) {
      return candidate;
    }
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export default makeSlug;