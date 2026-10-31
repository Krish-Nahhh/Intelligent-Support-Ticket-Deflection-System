import { pipeline } from "@huggingface/transformers";

export const EMBEDDING_DIM = 384;

// Cache the model across hot reloads so it loads once
const g = globalThis as unknown as { extractor?: Promise<any> };
function getExtractor() {
  g.extractor ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return g.extractor;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;