// ============================================================
// vite-draft-plugin — Dev-only HTTP endpoint that flips the
// `draft` / `articleDraft` flags inside an experiment's meta.ts.
//
// The UI in dev mode posts here; the plugin patches the source
// file in-place. Vite's HMR picks up the change and the gallery
// re-renders with the new visibility.
//
// `apply: 'serve'` ensures this entire plugin is dropped from the
// production build — the endpoint never ships to Vercel.
// ============================================================

import type { Plugin } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ALLOWED_KEYS = ['draft', 'articleDraft'] as const;
type DraftKey = (typeof ALLOWED_KEYS)[number];

function isDraftKey(k: string): k is DraftKey {
  return (ALLOWED_KEYS as readonly string[]).includes(k);
}

// Slug must be a simple kebab-case directory name — defensive against
// path traversal because we resolve it against src/experiments/.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function viteDraftPlugin(): Plugin {
  return {
    name: 'vite-draft-toggle',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__draft', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
          if (body.length > 1024) {
            // Guard against absurdly large requests
            res.statusCode = 413;
            res.end('body too large');
            req.destroy();
          }
        });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body) as {
              slug?: unknown;
              key?: unknown;
              value?: unknown;
            };
            const slug = parsed.slug;
            const key = parsed.key;
            const value = parsed.value;

            if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
              res.statusCode = 400;
              res.end('invalid slug');
              return;
            }
            if (typeof key !== 'string' || !isDraftKey(key)) {
              res.statusCode = 400;
              res.end('invalid key');
              return;
            }
            if (typeof value !== 'boolean') {
              res.statusCode = 400;
              res.end('value must be boolean');
              return;
            }

            const root = server.config.root;
            const metaPath = resolve(root, 'src/experiments', slug, 'meta.ts');
            const original = await readFile(metaPath, 'utf8');

            // Replace an existing `<key>: true|false,` line, or insert
            // one right after `hasArticle:` if the field doesn't yet exist.
            const fieldRe = new RegExp(`(\\b${key}:\\s*)(true|false)`);
            let next: string;
            if (fieldRe.test(original)) {
              next = original.replace(fieldRe, `$1${value}`);
            } else if (/hasArticle:\s*\w+,?/.test(original)) {
              next = original.replace(
                /(hasArticle:\s*\w+,?)/,
                `$1\n  ${key}: ${value},`,
              );
            } else {
              // Last-resort: insert before the closing `};` of the meta
              // object. This is brittle but only runs on the dev server.
              next = original.replace(/(\n};\s*)$/, `\n  ${key}: ${value},$1`);
            }

            if (next === original) {
              res.statusCode = 500;
              res.end('could not patch meta file');
              return;
            }

            await writeFile(metaPath, next, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        });
      });
    },
  };
}
