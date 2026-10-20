#!/usr/bin/env node
/**
 * Creates a stub `frontend/dist` folder when the app has not been built yet.
 *
 * `wrangler dev` needs the assets directory to exist, otherwise it refuses to
 * start. During development the real app is served by Vite on port 5173, so a
 * placeholder file is enough.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'frontend', 'dist');
const index = resolve(dist, 'index.html');

if (existsSync(index)) {
  process.exit(0);
}

mkdirSync(dist, { recursive: true });
writeFileSync(
  index,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Learning Resources (dev)</title>
  </head>
  <body>
    <p>Run <code>npm run dev:web</code> and open http://localhost:5173 for the app.</p>
  </body>
</html>
`,
  'utf8',
);

console.log(`Created placeholder build at ${dist}`);
