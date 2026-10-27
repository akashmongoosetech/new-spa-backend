import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    text: { type: String, required: true, maxlength: 4000 },
    sources: [
      {
        title: { type: String, default: '' },
        url: { type: String, default: '' },
        _id: false,
      },
    ],
    confidence: { type: Number, default: null },
    tokens: { type: Number, default: null },
    latencyMs: { type: Number, default: null },
    lowConfidence: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
// Public chat transcripts expire after 90 days, matching the Conversation TTL.
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export default mongoose.model('ChatMessage', chatMessageSchema);
