import { query, queryOne, run } from '../config/db.js';

export class NewsletterModel {
  static getAll() {
    return query('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC');
  }

  static findByEmail(email) {
    return queryOne('SELECT * FROM newsletter_subscribers WHERE email = ?', [email]);
  }

  static subscribe(id, email) {
    run('INSERT INTO newsletter_subscribers (id, email) VALUES (?, ?)', [id, email]);
    return queryOne('SELECT * FROM newsletter_subscribers WHERE id = ?', [id]);
  }

  static delete(id) {
    run('DELETE FROM newsletter_subscribers WHERE id = ?', [id]);
    return true;
  }
}
