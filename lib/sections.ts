// Split a note body into named sections by H2 headers — mirrors
// scripts/import-vault.mjs's sections() splitter used at import time for edge
// classification, reused here at runtime to build Learning Pathway read-dots
// straight from the note's own authored content (never LLM-generated).

export type NoteSection = { name: string; text: string };

export function splitSections(body: string): NoteSection[] {
  const out: NoteSection[] = [];
  let current = "Overview";
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) out.push({ name: current, text });
    buf = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      flush();
      current = h[1];
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export function getSection(body: string, name: string): string | null {
  const found = splitSections(body).find((s) => s.name.toLowerCase() === name.toLowerCase());
  return found ? found.text : null;
}
