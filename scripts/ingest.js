/**
 * One-shot RAG ingestion: rebuilds the KnowledgeChunk corpus from live DB.
 * Usage: node scripts/ingest.js [service|faq|blog|business]
 * Requires MONGODB_URI + GEMINI_API_KEY (embeddings best-effort).
 */
import '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { ingestAll, ingestSource } from '../src/services/ingestService.js';

async function main() {
  const source = process.argv[2];
  await connectDB();
  const started = Date.now();
  const result = source ? [await ingestSource(source)] : await ingestAll();
  console.log(JSON.stringify({ ok: true, ms: Date.now() - started, result }, null, 2));
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
