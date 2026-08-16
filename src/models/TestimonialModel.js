import { query, queryOne, run } from '../config/db.js';

export class TestimonialModel {
  static format(t) {
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      role: t.role,
      rating: t.rating,
      comment: t.comment,
      avatarUrl: t.avatar_url,
      verified: Boolean(t.verified),
      active: Boolean(t.active),
      createdAt: t.created_at
    };
  }

  static getAll() {
    const list = query('SELECT * FROM testimonials ORDER BY created_at DESC');
    return list.map(this.format);
  }

  static create(data) {
    run(
      'INSERT INTO testimonials (id, name, role, rating, comment, avatar_url, verified, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.id, data.name, data.role || 'Guest Client', data.rating || 5,
        data.comment, data.avatarUrl || data.avatar_url || null, data.verified !== false ? 1 : 0, 1
      ]
    );
    return queryOne('SELECT * FROM testimonials WHERE id = ?', [data.id]);
  }

  static delete(id) {
    run('DELETE FROM testimonials WHERE id = ?', [id]);
    return true;
  }
}
