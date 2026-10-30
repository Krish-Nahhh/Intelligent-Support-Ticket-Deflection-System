export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;

// TODO task 4: real MiniLM embedding. Returning null routes tickets to agents.
export async function embed(_text: string): Promise<number[] | null> {
  return null;
}