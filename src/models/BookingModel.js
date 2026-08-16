import { query, queryOne, run } from '../config/db.js';

export class BookingModel {
  static formatBooking(b) {
    if (!b) return null;
    return {
      id: b.id,
      bookingNumber: b.booking_number,
      serviceId: b.service_id,
      serviceTitle: b.service_title,
      therapistId: b.therapist_id,
      therapistName: b.therapist_name,
      date: b.date,
      timeSlot: b.time_slot,
      customerName: b.customer_name,
      email: b.email,
      phone: b.phone,
      notes: b.notes,
      totalPaid: b.total_paid,
      paymentMethod: b.payment_method,
      paymentStatus: b.payment_status,
      status: b.status,
      couponCode: b.coupon_code,
      discountAmount: b.discount_amount,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    };
  }

  static getAll() {
    const list = query('SELECT * FROM bookings ORDER BY created_at DESC');
    return list.map(this.formatBooking);
  }

  static getById(id) {
    const b = queryOne('SELECT * FROM bookings WHERE id = ? OR booking_number = ?', [id, id]);
    return this.formatBooking(b);
  }

  static findByQuery(q) {
    const clean = (q || '').trim().toLowerCase();
    if (!clean) return null;
    const list = this.getAll();
    return list.find((b) =>
      (b.bookingNumber && b.bookingNumber.toLowerCase() === clean) ||
      (b.email && b.email.toLowerCase() === clean) ||
      b.id === clean
    ) || null;
  }

  static create(data) {
    run(
      `INSERT INTO bookings (id, booking_number, service_id, service_title, therapist_id, therapist_name, date, time_slot, customer_name, email, phone, notes, total_paid, payment_method, payment_status, status, coupon_code, discount_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id, data.bookingNumber || data.booking_number,
        data.serviceId || data.service_id, data.serviceTitle || data.service_title,
        data.therapistId || data.therapist_id, data.therapistName || data.therapist_name,
        data.date, data.timeSlot || data.time_slot, data.customerName || data.customer_name,
        data.email, data.phone, data.notes || null, data.totalPaid || data.total_paid || 0,
        data.paymentMethod || data.payment_method || 'pay_at_venue',
        data.paymentStatus || data.payment_status || 'pending',
        data.status || 'confirmed', data.couponCode || data.coupon_code || null,
        data.discountAmount || data.discount_amount || 0
      ]
    );
    return this.getById(data.id);
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.paymentStatus !== undefined) { fields.push('payment_status = ?'); values.push(data.paymentStatus); }
    if (data.therapistId !== undefined) { fields.push('therapist_id = ?'); values.push(data.therapistId); }
    if (data.therapistName !== undefined) { fields.push('therapist_name = ?'); values.push(data.therapistName); }
    if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date); }
    if (data.timeSlot !== undefined) { fields.push('time_slot = ?'); values.push(data.timeSlot); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  }

  static delete(id) {
    run('DELETE FROM bookings WHERE id = ?', [id]);
    return true;
  }
}
