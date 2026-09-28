import Coupon from '../models/Coupon.js';
import { serializeCoupon } from '../utils/serializers.js';
import { HttpError } from '../utils/api.js';
import { logAudit } from '../services/auditService.js';

function computeDiscount(coupon, amount) {
  if (coupon.discountType === 'percent') {
    return Math.round(((amount * coupon.discount) / 100) * 100) / 100;
  }
  return Math.min(coupon.discount, amount);
}

export async function validateCoupon(req, res) {
  const { code, amount } = req.body || {};
  if (!code) throw new HttpError(400, 'Coupon code is required');

  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  if (!coupon) {
    return res.json({ valid: false, discountAmount: 0, message: 'Invalid coupon code', coupon: null });
  }
  if (coupon.active === false) {
    return res.json({ valid: false, discountAmount: 0, message: 'This coupon is no longer active', coupon: null });
  }
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
    return res.json({ valid: false, discountAmount: 0, message: 'This coupon has expired', coupon: null });
  }
  if (coupon.usageCount >= coupon.maxUses) {
    return res.json({ valid: false, discountAmount: 0, message: 'This coupon has reached its usage limit', coupon: null });
  }

  const amt = Number(amount) || 0;
  if (amt < (coupon.minAmount || 0)) {
    return res.json({
      valid: false,
      discountAmount: 0,
      message: `Minimum order amount for this coupon is ₹${coupon.minAmount}`,
      coupon: null,
    });
  }

  const discountAmount = computeDiscount(coupon, amt);
  return res.json({
    valid: true,
    discountAmount,
    discount: discountAmount,
    message: 'Coupon applied',
    coupon: serializeCoupon(coupon),
  });
}

export async function listCoupons(req, res) {
  const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(500).lean();
  return res.json(coupons.map(serializeCoupon));
}

export async function createCoupon(req, res) {
  const b = req.body || {};
  const code = String(b.code || b.couponCode || '').toUpperCase().trim();
  if (!code) throw new HttpError(400, 'Coupon code is required');
  const rawDiscount = b.discount !== undefined ? b.discount : b.discountValue;
  if (rawDiscount === undefined) throw new HttpError(400, 'Discount value is required');
  const discountType = b.discountType === 'percent' || b.discountType === 'percentage' ? 'percent' : 'fixed';
  const discount = Number(rawDiscount);
  if (!Number.isFinite(discount) || discount < 0) throw new HttpError(400, 'Invalid discount value');
  if (discountType === 'percent' && discount > 100) throw new HttpError(400, 'Percent discount cannot exceed 100');
  const minAmount = Number(b.minAmount) || 0;
  if (minAmount < 0) throw new HttpError(400, 'Invalid minimum amount');
  const maxUses = Number(b.maxUses) || 100;
  if (!Number.isFinite(maxUses) || maxUses < 1) throw new HttpError(400, 'Invalid max uses');
  let expiryDate = null;
  if (b.expiryDate || b.validUntil) {
    expiryDate = new Date(b.expiryDate || b.validUntil);
    if (Number.isNaN(expiryDate.getTime())) throw new HttpError(400, 'Invalid expiry date');
    if (expiryDate < new Date()) throw new HttpError(400, 'Expiry date cannot be in the past');
  }

  const existing = await Coupon.findOne({ code });
  if (existing) throw new HttpError(400, 'Coupon code already exists');

  const coupon = await Coupon.create({
    code,
    discount,
    discountType,
    minAmount,
    maxUses,
    usageCount: 0,
    expiryDate,
    active: b.active === false || b.active === 0 ? false : true,
  });

  await logAudit({ action: 'create', module: 'coupons', details: `Created coupon ${coupon.code}`, req });
  return res.status(201).json(serializeCoupon(coupon.toObject()));
}

export async function deleteCoupon(req, res) {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new HttpError(404, 'Coupon not found');

  await coupon.deleteOne();
  await logAudit({ action: 'delete', module: 'coupons', details: `Deleted coupon ${coupon.code}`, req });
  return res.json({ success: true });
}

export default { validateCoupon, listCoupons, createCoupon, deleteCoupon };