import { query } from "./db";
import { toVectorLiteral } from "./embeddings";

export const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD ?? 0.8);

export async function findSimilarResolutions(embedding: number[], limit = 3) {
  const { rows } = await query(
    `SELECT r.id AS resolution_id, r.solution_text, t.title,
            1 - (t.embedding <=> $1::vector) AS similarity
     FROM tickets t
     JOIN resolutions r ON r.ticket_id = t.id
     WHERE t.embedding IS NOT NULL AND t.status IN ('resolved', 'closed')
     ORDER BY t.embedding <=> $1::vector
     LIMIT $2`,
    [toVectorLiteral(embedding), limit]
  );
  return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
}