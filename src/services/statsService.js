import Booking from '../models/Booking.js';
import ContactMessage from '../models/ContactMessage.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import Setting from '../models/Setting.js';

export async function getAdminStats() {
  const [settings, bookingAgg, confirmedCount, pendingCount, completedCount, cancelledCount, contactsCount, subscribersCount] =
    await Promise.all([
      Setting.findOne({ key: 'default' }).lean(),
      Booking.aggregate([
        { $match: { status: { $nin: ['cancelled', 'rejected'] } } },
        { $group: { _id: null, total: { $sum: '$totalPaid' }, count: { $sum: 1 } } },
      ]),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      ContactMessage.countDocuments(),
      NewsletterSubscriber.countDocuments({ active: true }),
    ]);

  const agg = bookingAgg[0] || { total: 0, count: 0 };

  return {
    totalRevenue: agg.total,
    totalBookings: agg.count,
    confirmedCount,
    pendingCount,
    completedCount,
    cancelledCount,
    contactsCount,
    subscribersCount,
    websiteVisitors: 0, // no visitor tracking endpoint exists; frontend tolerates 0
    currencySymbol: (settings && settings.currencySymbol) || '₹',
    currencyCode: (settings && settings.currencyCode) || 'INR',
  };
}

export default { getAdminStats };