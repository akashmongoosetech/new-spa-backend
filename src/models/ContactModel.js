import { query, queryOne, run } from '../config/db.js';

export class ContactModel {
  static getAll() {
    return query('SELECT * FROM contacts ORDER BY created_at DESC');
  }

  static getById(id) {
    return queryOne('SELECT * FROM contacts WHERE id = ?', [id]);
  }

  static create(data) {
    run(
      'INSERT INTO contacts (id, name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.name, data.email, data.phone || null, data.subject || null, data.message, 'new']
    );
    return this.getById(data.id);
  }

  static updateStatus(id, status) {
    run('UPDATE contacts SET status = ? WHERE id = ?', [status, id]);
    return this.getById(id);
  }

  static reply(id, replyText) {
    run('UPDATE contacts SET reply_text = ?, status = ? WHERE id = ?', [replyText, 'replied', id]);
    return this.getById(id);
  }

  static delete(id) {
    run('DELETE FROM contacts WHERE id = ?', [id]);
    return true;
  }

  static bulkDelete(ids) {
    if (!ids || ids.length === 0) return true;
    const placeholders = ids.map(() => '?').join(',');
    run(`DELETE FROM contacts WHERE id IN (${placeholders})`, ids);
    return true;
  }
}
