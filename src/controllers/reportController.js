import { exportReportCsv } from '../services/reportService.js';
import { logAudit } from '../services/auditService.js';

const BOOKING_TYPES = ['all', 'bookings', 'revenue', 'confirmed', 'pending', 'completed', 'cancelled'];
const VALID_TYPES = [...BOOKING_TYPES, 'contacts', 'therapists', 'services', 'subscribers'];

export async function exportReport(req, res) {
  const type = String(req.query.type || 'bookings');

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: 'Unsupported report type', message: 'Invalid report type.' });
  }

  const { filename, csv } = await exportReportCsv(type);

  await logAudit({ action: 'export', module: 'reports', details: `Exported ${type} CSV report`, req });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}

export default { exportReport };