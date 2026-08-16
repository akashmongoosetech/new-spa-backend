import { query, queryOne, run } from '../config/db.js';

export class UserModel {
  static findByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  static findById(id) {
    return queryOne('SELECT id, name, email, role, avatar_url, phone, active, created_at FROM users WHERE id = ?', [id]);
  }

  static getAll() {
    return query('SELECT id, name, email, role, avatar_url, phone, active, created_at FROM users ORDER BY created_at DESC');
  }

  static create(user) {
    run(
      'INSERT INTO users (id, name, email, password, role, avatar_url, phone, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [user.id, user.name, user.email, user.password, user.role || 'Admin', user.avatar_url || null, user.phone || null]
    );
    return this.findById(user.id);
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    if (data.avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(data.avatar_url); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.password !== undefined) { fields.push('password = ?'); values.push(data.password); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static delete(id) {
    run('DELETE FROM users WHERE id = ?', [id]);
    return true;
  }
}
