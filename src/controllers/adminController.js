import { BookingModel } from '../models/BookingModel.js';
import { ContactModel } from '../models/ContactModel.js';
import { NewsletterModel } from '../models/NewsletterModel.js';
import { ServiceModel } from '../models/ServiceModel.js';
import { TherapistModel } from '../models/TherapistModel.js';
import { SettingsModel } from '../models/SettingsModel.js';
import { sendError, handleError } from '../utils/responseHandler.js';
import { csvField } from '../utils/helpers.js';

export const getAdminStats = (req, res) => {
  try {
    const bookings = BookingModel.getAll();
    const contacts = ContactModel.getAll();
    const newsletter = NewsletterModel.getAll();
    const services = ServiceModel.getAll();
    const therapists = TherapistModel.getAll();

    const totalRevenue = bookings.reduce((acc, b) => {
      return (b.status !== 'cancelled' && b.status !== 'rejected') ? acc + Number(b.totalPaid || 0) : acc;
    }, 0);

    const totalBookings = bookings.length;
    const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    const completedCount = bookings.filter(b => b.status === 'completed').length;
    const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

    return res.json({
      totalRevenue,
      totalBookings,
      confirmedCount,
      pendingCount,
      completedCount,
      cancelledCount,
      contactsCount: contacts.length,
      subscribersCount: newsletter.length,
      servicesCount: services.length,
      therapistsCount: therapists.length,
      recentBookings: bookings.slice(0, 5),
      recentContacts: contacts.slice(0, 5)
    });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getScheduleConfig = (req, res) => {
  try {
    const settings = SettingsModel.getSettings();
    const schedule = settings.scheduleConfig || {
      blockedDates: [],
      holidays: [
        { date: "2026-12-25", title: "Christmas Day" },
        { date: "2027-01-01", title: "New Year's Day" }
      ],
      emergencyClosure: false,
      emergencyClosureReason: "",
      timeSlots: [
        "09:00 AM", "10:30 AM", "12:00 PM", "01:30 PM", 
        "03:00 PM", "04:30 PM", "06:00 PM", "07:30 PM", "09:00 PM"
      ],
      workingHoursStart: "09:00",
      workingHoursEnd: "22:00"
    };
    return res.json(schedule);
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateScheduleConfig = (req, res) => {
  try {
    SettingsModel.updateSettings({ scheduleConfig: req.body });
    return res.json(req.body);
  } catch (err) {
    return handleError(res, err);
  }
};

export const exportReports = (req, res) => {
  try {
    const type = req.query.type || "bookings";
    let csv = "";

    if (type === "bookings") {
      const bookings = BookingModel.getAll();
      csv = "Booking ID,Customer Name,Email,Phone,Service,Therapist,Date,Time Slot,Total Paid,Status,Created At\n";
      bookings.forEach(b => {
        csv += [csvField(b.bookingNumber || b.id), csvField(b.customerName), csvField(b.email), csvField(b.phone), csvField(b.serviceTitle), csvField(b.therapistName), csvField(b.date), csvField(b.timeSlot), csvField(`₹${b.totalPaid}`), csvField(b.status), csvField(b.createdAt)].join(',') + '\n';
      });
    } else if (type === "contacts") {
      const contacts = ContactModel.getAll();
      csv = "ID,Name,Email,Phone,Subject,Message,Status,Created At\n";
      contacts.forEach(c => {
        csv += [csvField(c.id), csvField(c.name), csvField(c.email), csvField(c.phone), csvField(c.subject), csvField(c.message), csvField(c.status), csvField(c.created_at)].join(',') + '\n';
      });
    } else if (type === "therapists") {
      const therapists = TherapistModel.getAll();
      csv = "Therapist ID,Name,Title,Experience,Rating,Reviews,Active\n";
      therapists.forEach(t => {
        csv += [csvField(t.id), csvField(t.name), csvField(t.title), csvField(`${t.experienceYears} yrs`), csvField(t.rating), csvField(t.reviewsCount), csvField(t.active)].join(',') + '\n';
      });
    } else if (type === "services") {
      const services = ServiceModel.getAll();
      csv = "Service ID,Title,Category,Price,Duration,Rating,Reviews,Active\n";
      services.forEach(s => {
        csv += [csvField(s.id), csvField(s.title), csvField(s.category), csvField(`₹${s.price}`), csvField(`${s.durationMinutes} mins`), csvField(s.rating), csvField(s.reviewsCount), csvField(s.active)].join(',') + '\n';
      });
    } else {
      const newsletter = NewsletterModel.getAll();
      csv = "Subscriber ID,Email,Subscribed At\n";
      newsletter.forEach(ns => {
        csv += [csvField(ns.id), csvField(ns.email), csvField(ns.subscribed_at)].join(',') + '\n';
      });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=aura_luxe_${type}_report.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    return handleError(res, err);
  }
};
