import { v4 as uuidv4 } from 'uuid';
import { CouponModel } from '../models/CouponModel.js';
import { sendError, sendSuccess, handleError } from '../utils/responseHandler.js';

export const getCoupons = (req, res) => {
  try {
    const coupons = CouponModel.getAll();
    return res.json(coupons);
  } catch (err) {
    return handleError(res, err);
  }
};

export const validateCoupon = (req, res) => {
  try {
    const { code, amount } = req.body;
    if (!code) return sendError(res, 'Coupon code is required', 400);

    const coupon = CouponModel.findByCode(code);
    if (!coupon) return sendError(res, 'Invalid coupon code', 404);
    if (!coupon.active) return sendError(res, 'Coupon code is inactive', 400);

    if (amount && coupon.minAmount && amount < coupon.minAmount) {
      return sendError(res, `Minimum order amount of ₹${coupon.minAmount} required for this coupon`, 400);
    }

    let discountAmount = coupon.discount;
    if (coupon.discountType === 'percent' && amount) {
      discountAmount = Math.round((amount * coupon.discount) / 100);
    }

    return res.json({
      valid: true,
      coupon,
      discountAmount
    });
  } catch (err) {
    return handleError(res, err);
  }
};

export const createCoupon = (req, res) => {
  try {
    const { code, discount, discountType, minAmount, expiryDate, maxUses } = req.body;
    if (!code || !discount) return sendError(res, 'Code and discount value are required', 400);

    const id = `cpn-${uuidv4().slice(0, 8)}`;
    const newCoupon = CouponModel.create({
      id, code, discount, discountType, minAmount, expiryDate, maxUses
    });

    return res.status(201).json(newCoupon);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return sendError(res, 'A coupon with this code already exists', 400);
    }
    return handleError(res, err);
  }
};

export const deleteCoupon = (req, res) => {
  try {
    CouponModel.delete(req.params.id);
    return sendSuccess(res, null, 'Coupon deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};
