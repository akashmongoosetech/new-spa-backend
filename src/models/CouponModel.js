import { query, queryOne, run } from '../config/db.js';

export class CouponModel {
  static formatCoupon(c) {
    if (!c) return null;
    return {
      id: c.id,
      code: c.code,
      discount: c.discount,
      discountType: c.discount_type,
      minAmount: c.min_amount,
      active: Boolean(c.active),
      expiryDate: c.expiry_date,
      usageCount: c.usage_count,
      maxUses: c.max_uses,
      createdAt: c.created_at
    };
  }

  static getAll() {
    const list = query('SELECT * FROM coupons ORDER BY created_at DESC');
    return list.map(this.formatCoupon);
  }

  static findByCode(code) {
    const c = queryOne('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?)', [code]);
    return this.formatCoupon(c);
  }

  static getById(id) {
    const c = queryOne('SELECT * FROM coupons WHERE id = ?', [id]);
    return this.formatCoupon(c);
  }

  static create(data) {
    run(
      'INSERT INTO coupons (id, code, discount, discount_type, min_amount, active, expiry_date, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.id, data.code.toUpperCase(), data.discount, data.discountType || 'fixed',
        data.minAmount || 0, data.active !== false ? 1 : 0, data.expiryDate || null, data.maxUses || 100
      ]
    );
    return this.getById(data.id);
  }

  static incrementUsage(code) {
    run('UPDATE coupons SET usage_count = usage_count + 1 WHERE UPPER(code) = UPPER(?)', [code]);
  }

  static delete(id) {
    run('DELETE FROM coupons WHERE id = ?', [id]);
    return true;
  }
}
