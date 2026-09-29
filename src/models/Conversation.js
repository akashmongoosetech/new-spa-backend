import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    // SHA-256 of IP — abuse accounting without storing the raw address.
    ipHash: { type: String, default: '' },
    messageCount: { type: Number, default: 0 },
    // Stale public chats expire automatically; admin review happens via
    // the low-confidence queue, not raw log retention.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 3600 * 1000) },
  },
  { timestamps: true }
);

conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Conversation', conversationSchema);
