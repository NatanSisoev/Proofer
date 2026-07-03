import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSections, getSection } from "../lib/sections.ts";

test("splitSections: content before the first heading is Overview", () => {
  const body = "Some intro text.\n\n## Statement\nThe statement text.";
  const sections = splitSections(body);
  assert.equal(sections[0].name, "Overview");
  assert.equal(sections[0].text, "Some intro text.");
  assert.equal(sections[1].name, "Statement");
  assert.equal(sections[1].text, "The statement text.");
});

test("splitSections: empty sections are dropped", () => {
  const body = "## Statement\n\n## Intuition\nActual content here.";
  const sections = splitSections(body);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, "Intuition");
});

test("splitSections: a body with no headings is a single Overview section", () => {
  const sections = splitSections("Just one paragraph, no headings.");
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, "Overview");
});

test("getSection: finds a section case-insensitively", () => {
  const body = "## Intuition\nThe intuitive idea.";
  assert.equal(getSection(body, "intuition"), "The intuitive idea.");
  assert.equal(getSection(body, "Statement"), null);
});
