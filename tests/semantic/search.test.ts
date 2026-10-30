import { describe, it, expect, beforeAll } from "vitest";
import { embed, EMBEDDING_DIM } from "@/lib/embeddings";
import { findSimilarResolutions, SIMILARITY_THRESHOLD } from "@/lib/search";

// Phrasings that do NOT appear in the seed data
const paraphrases: [string, string][] = [
  ["I can't sign in to my profile", "Can't log in to my account"],
  ["my order was billed two times", "Charged twice for one order"],
  ["how do I cancel my plan", "Cancel my subscription"],
  ["the app closes right after I open it", "App crashes on launch"],
  ["my parcel still hasn't arrived and tracking shows it in transit for days", "Package hasn't arrived"],  
  ["I returned my purchase weeks ago and still haven't been reimbursed", "Refund hasn't shown up"],
  ["my device won't connect over bluetooth", "Device won't pair with my phone"],
];

const unrelated = [
  "what's the best pizza topping",
  "how tall is mount everest",
  "write a poem about autumn leaves",
];

const scores: Record<string, { top: string; sim: number }> = {};

beforeAll(async () => {
  for (const q of [...paraphrases.map((p) => p[0]), ...unrelated]) {
    const [best] = await findSimilarResolutions(await embed(q), 1);
    scores[q] = { top: best.title, sim: best.similarity };
  }
  console.table(
    Object.entries(scores).map(([query, s]) => ({
      query,
      match: s.top,
      similarity: s.sim.toFixed(3),
    }))
  );
  console.log("Threshold:", SIMILARITY_THRESHOLD);
});

describe("embeddings", () => {
  it("produces normalized vectors of the expected dimension", async () => {
    const v = await embed("hello world");
    expect(v).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 3);
  });
});

describe("semantic search", () => {
  it.each(paraphrases)('"%s" matches "%s" above the threshold', (q, expectedTitle) => {
    expect(scores[q].top).toBe(expectedTitle);
    expect(scores[q].sim).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  it.each(unrelated)('unrelated query "%s" stays below the threshold', (q) => {
    expect(scores[q].sim).toBeLessThan(SIMILARITY_THRESHOLD);
  });

  it("every paraphrase scores higher than every unrelated query", () => {
    const lowestParaphrase = Math.min(...paraphrases.map((p) => scores[p[0]].sim));
    const highestUnrelated = Math.max(...unrelated.map((q) => scores[q].sim));
    expect(lowestParaphrase).toBeGreaterThan(highestUnrelated);
  });
});