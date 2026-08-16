import { query, queryOne, run } from '../config/db.js';

export class GalleryModel {
  static format(g) {
    if (!g) return null;
    return {
      id: g.id,
      title: g.title,
      category: g.category,
      imageUrl: g.image_url,
      createdAt: g.created_at
    };
  }

  static getAll() {
    const list = query('SELECT * FROM gallery ORDER BY created_at DESC');
    return list.map(this.format);
  }

  static create(data) {
    run(
      'INSERT INTO gallery (id, title, category, image_url) VALUES (?, ?, ?, ?)',
      [data.id, data.title, data.category || 'General', data.imageUrl || data.image_url]
    );
    return queryOne('SELECT * FROM gallery WHERE id = ?', [data.id]);
  }

  static delete(id) {
    run('DELETE FROM gallery WHERE id = ?', [id]);
    return true;
  }
}
