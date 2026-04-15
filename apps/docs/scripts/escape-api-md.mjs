#!/usr/bin/env node
/**
 * Post-processes typedoc-plugin-markdown output to escape angle-bracket generics
 * inside table cells and prose so VitePress's Vue SFC compiler does not choke on
 * unclosed "HTML" tags like `<T>` or `<T, Mode>`.
 *
 * Heuristic: outside fenced code blocks and inline code spans, replace `<Word>` /
 * `<Word, Word>` sequences with `&lt;...&gt;`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'api');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

// Match `<Ident>` or `<Ident, Ident, ...>` where the whole thing is a plausible
// TS generic. Requires starting with uppercase letter (type identifiers).
const GENERIC = /<([A-Z][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*>/g;

function escapeLine(line) {
  // Skip lines that are entirely code or headings with code
  return line.replace(GENERIC, (m, inner) => `&lt;${inner}&gt;`);
}

function processFile(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split('\n');
  let inFence = false;
  const out = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Protect inline code spans
    const segments = line.split(/(`[^`]*`)/);
    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 0) segments[i] = escapeLine(segments[i]);
    }
    out.push(segments.join(''));
  }
  const next = out.join('\n');
  if (next !== src) writeFileSync(path, next);
}

try {
  const files = walk(API_DIR);
  for (const f of files) processFile(f);
  console.log(`escape-api-md: processed ${files.length} files`);
} catch (err) {
  if (err && err.code === 'ENOENT') {
    console.log('escape-api-md: api/ not found, skipping');
  } else {
    throw err;
  }
}
