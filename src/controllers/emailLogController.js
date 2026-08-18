import EmailLog from '../models/EmailLog.js';
import { serializeEmailLog } from '../utils/serializers.js';

export async function listEmailLogs(req, res) {
  const logs = await EmailLog.find().sort({ sentAt: -1 }).limit(500).lean();
  return res.json(logs.map(serializeEmailLog));
}

export default { listEmailLogs };