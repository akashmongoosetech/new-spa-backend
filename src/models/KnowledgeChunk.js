import mongoose from 'mongoose';

/**
 * A single retrievable RAG chunk. Public business knowledge ONLY —
 * transactional and customer data (bookings, users, contacts) must
 * never be ingested here; those are served via live DB tools.
 */
const knowledgeChunkSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      enum: ['service', 'therapist', 'faq', 'blog', 'business'],
      index: true,
    },
    documentId: { type: String, required: true },
    title: { type: String, default: '' },
    category: { type: String, default: '' },
    url: { type: String, default: '' },
    text: { type: String, required: true, maxlength: 4000 },
    // Gemini text-embedding-004 output (768 dims). Null until embedded;
    // retrieval falls back to keyword search when embeddings are absent.
    embedding: { type: [Number], default: null, select: false },
    accessLevel: { type: String, default: 'public', enum: ['public'] },
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ source: 1, documentId: 1 });
knowledgeChunkSchema.index({ accessLevel: 1, category: 1 });
knowledgeChunkSchema.index({ title: 'text', text: 'text' });

export default mongoose.model('KnowledgeChunk', knowledgeChunkSchema);
