// Shared plain-text streaming protocol between API routes and client
// components for the long-form LLM calls (explain / re-explain / compare).
// Not provider-aware — lib/llm.ts owns that; this just moves text chunks
// from an async generator to a fetch Response and back.

// A provider error can only surface once the LLM call is underway, which is
// after the streaming Response's headers (status 200) are already committed.
// So errors are appended to the body instead, behind a marker no real
// explanation is going to contain.
export const STREAM_ERROR_MARKER = "\n\n<<<STREAM_ERROR>>>";

/** Wrap an async generator of text chunks into a streaming `Response`. */
export function toStreamResponse(gen: AsyncGenerator<string>, describeError: (e: unknown) => string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of gen) controller.enqueue(encoder.encode(chunk));
      } catch (e) {
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER + describeError(e)));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * Read a `toStreamResponse()` body, calling `onChunk` with the accumulated
 * text after every chunk. Throws if the stream carries an error marker
 * (whatever text arrived before the marker is still reported via onChunk).
 */
export async function consumeStream(res: Response, onChunk: (full: string) => void): Promise<string> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    const errIdx = full.indexOf(STREAM_ERROR_MARKER);
    if (errIdx !== -1) {
      onChunk(full.slice(0, errIdx));
      throw new Error(full.slice(errIdx + STREAM_ERROR_MARKER.length).trim() || "Something went wrong");
    }
    onChunk(full);
  }
  return full;
}
