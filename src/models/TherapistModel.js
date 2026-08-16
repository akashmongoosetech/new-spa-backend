import { query, queryOne, run } from '../config/db.js';
import { safeJsonParse, safeJsonStringify } from '../utils/helpers.js';

export class TherapistModel {
  static formatTherapist(t) {
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      title: t.title,
      role: t.role,
      bio: t.bio,
      imageUrl: t.image_url,
      specialties: safeJsonParse(t.specialties, []),
      rating: t.rating,
      reviewsCount: t.reviews_count,
      experienceYears: t.experience_years,
      active: Boolean(t.active),
      createdAt: t.created_at,
      updatedAt: t.updated_at
    };
  }

  static getAll() {
    const list = query('SELECT * FROM therapists ORDER BY created_at DESC');
    return list.map(this.formatTherapist);
  }

  static getById(id) {
    const t = queryOne('SELECT * FROM therapists WHERE id = ?', [id]);
    return this.formatTherapist(t);
  }

  static create(data) {
    run(
      `INSERT INTO therapists (id, name, title, role, bio, image_url, specialties, rating, reviews_count, experience_years, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id, data.name, data.title, data.role || 'Therapist', data.bio,
        data.imageUrl || data.image_url || null, safeJsonStringify(data.specialties),
        data.rating || 5.0, data.reviewsCount || data.reviews_count || 0,
        data.experienceYears || data.experience_years || 5, data.active !== false ? 1 : 0
      ]
    );
    return this.getById(data.id);
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
    if (data.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(data.imageUrl); }
    if (data.specialties !== undefined) { fields.push('specialties = ?'); values.push(safeJsonStringify(data.specialties)); }
    if (data.rating !== undefined) { fields.push('rating = ?'); values.push(data.rating); }
    if (data.reviewsCount !== undefined) { fields.push('reviews_count = ?'); values.push(data.reviewsCount); }
    if (data.experienceYears !== undefined) { fields.push('experience_years = ?'); values.push(data.experienceYears); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`UPDATE therapists SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  }

  static delete(id) {
    run('DELETE FROM therapists WHERE id = ?', [id]);
    return true;
  }
}
