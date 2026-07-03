// Shared vector primitives for the local embedding layer (Cycle 2 #3).
// Kept separate from lib/llm.ts (provider calls) and lib/queries.ts (SQL)
// since every consumer — search today, link suggestions / similar concepts /
// misconception clustering later — needs the same encode/decode/cosine math.
// scripts/embed.mjs duplicates encodeVector rather than importing this (a
// plain .mjs script can't import TypeScript without a build step).

/** Pack a float vector into the bytes stored in the `embeddings.vector` BLOB. */
export function encodeVector(values: number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer);
}

/** Unpack a BLOB column back into a typed array for cosine math. */
export function decodeVector(blob: Buffer | Uint8Array): Float32Array {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
