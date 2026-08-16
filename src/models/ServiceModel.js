import { query, queryOne, run } from '../config/db.js';
import { safeJsonParse, safeJsonStringify } from '../utils/helpers.js';

export class ServiceModel {
  static formatService(s) {
    if (!s) return null;
    return {
      id: s.id,
      title: s.title,
      slug: s.slug,
      category: s.category,
      shortDescription: s.short_description,
      fullDescription: s.full_description,
      price: s.price,
      originalPrice: s.original_price,
      durationMinutes: s.duration_minutes,
      benefits: safeJsonParse(s.benefits, []),
      includedItems: safeJsonParse(s.included_items, []),
      imageUrl: s.image_url,
      featured: Boolean(s.featured),
      active: Boolean(s.active),
      rating: s.rating,
      reviewsCount: s.reviews_count,
      faq: safeJsonParse(s.faq, []),
      createdAt: s.created_at,
      updatedAt: s.updated_at
    };
  }

  static getAll() {
    const list = query('SELECT * FROM services ORDER BY created_at DESC');
    return list.map(this.formatService);
  }

  static getById(id) {
    const s = queryOne('SELECT * FROM services WHERE id = ?', [id]);
    return this.formatService(s);
  }

  static create(data) {
    run(
      `INSERT INTO services (id, title, slug, category, short_description, full_description, price, original_price, duration_minutes, benefits, included_items, image_url, featured, active, rating, reviews_count, faq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id, data.title, data.slug, data.category, data.shortDescription || data.short_description || null,
        data.fullDescription || data.full_description || null, data.price, data.originalPrice || data.original_price || null,
        data.durationMinutes || data.duration_minutes || 60,
        safeJsonStringify(data.benefits), safeJsonStringify(data.includedItems || data.included_items),
        data.imageUrl || data.image_url || null, data.featured ? 1 : 0, data.active !== false ? 1 : 0,
        data.rating || 5.0, data.reviewsCount || data.reviews_count || 0,
        safeJsonStringify(data.faq)
      ]
    );
    return this.getById(data.id);
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.shortDescription !== undefined) { fields.push('short_description = ?'); values.push(data.shortDescription); }
    if (data.fullDescription !== undefined) { fields.push('full_description = ?'); values.push(data.fullDescription); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.originalPrice !== undefined) { fields.push('original_price = ?'); values.push(data.originalPrice); }
    if (data.durationMinutes !== undefined) { fields.push('duration_minutes = ?'); values.push(data.durationMinutes); }
    if (data.benefits !== undefined) { fields.push('benefits = ?'); values.push(safeJsonStringify(data.benefits)); }
    if (data.includedItems !== undefined) { fields.push('included_items = ?'); values.push(safeJsonStringify(data.includedItems)); }
    if (data.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(data.imageUrl); }
    if (data.featured !== undefined) { fields.push('featured = ?'); values.push(data.featured ? 1 : 0); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (data.rating !== undefined) { fields.push('rating = ?'); values.push(data.rating); }
    if (data.reviewsCount !== undefined) { fields.push('reviews_count = ?'); values.push(data.reviewsCount); }
    if (data.faq !== undefined) { fields.push('faq = ?'); values.push(safeJsonStringify(data.faq)); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  }

  static delete(id) {
    run('DELETE FROM services WHERE id = ?', [id]);
    return true;
  }
}
