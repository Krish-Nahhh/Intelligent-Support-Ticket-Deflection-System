import "dotenv/config";
import { pool } from "../lib/db";
import { embed, toVectorLiteral } from "../lib/embeddings";

async function main() {
  const { rows } = await pool.query(
    "SELECT id, title, description FROM tickets WHERE embedding IS NULL ORDER BY id"
  );
  for (const t of rows) {
    const vec = await embed(`${t.title}\n${t.description}`);
    await pool.query("UPDATE tickets SET embedding = $1::vector WHERE id = $2", [
      toVectorLiteral(vec),
      t.id,
    ]);
  }
  console.log(`Embedded ${rows.length} tickets`);
  await pool.end();
}
main();