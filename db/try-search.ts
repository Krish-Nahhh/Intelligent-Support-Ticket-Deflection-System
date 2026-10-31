import "dotenv/config";
import { pool } from "../lib/db";
import { embed } from "../lib/embeddings";
import { findSimilarResolutions } from "../lib/search";

async function main() {
  const q = process.argv.slice(2).join(" ");
  if (!q) {
    console.log('Usage: npx tsx db/try-search.ts "your ticket text"');
    process.exit(1);
  }
  const res = await findSimilarResolutions(await embed(q), 3);
  for (const r of res) console.log(r.similarity.toFixed(3), "|", r.title);
  await pool.end();
}
main();