// ============================================================
// new-experiment — Scaffold a new experiment from template
// Usage: npx tsx scripts/new-experiment.ts --name "Particle Storm"
// ============================================================

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
let name = '';
for (let i = 0; i < args.length; i++) {
  const match = args[i].match(/^--name=(.+)$/);
  if (match) {
    name = match[1];
  } else if (args[i] === '--name' && args[i + 1]) {
    name = args[++i];
  }
}

if (!name) {
  console.error('Usage: npx tsx scripts/new-experiment.ts --name "Experiment Name"');
  process.exit(1);
}

// Generate slug and variable name
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const varName = slug
  .split('-')
  .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
  .join('');

const templateDir = resolve(root, 'src/templates/experiment-template');
const targetDir = resolve(root, `src/experiments/${slug}`);

if (existsSync(targetDir)) {
  console.error(`Experiment directory already exists: ${targetDir}`);
  process.exit(1);
}

// Copy template
mkdirSync(targetDir, { recursive: true });
cpSync(templateDir, targetDir, { recursive: true });

// Replace placeholders in all files
const today = new Date().toISOString().slice(0, 10);
const replacements: Record<string, string> = {
  __SLUG__: slug,
  __TITLE__: name,
  __VARNAME__: varName,
  __DESCRIPTION__: `A WebGL experiment: ${name}`,
  __DATE__: today,
};

const files = readdirSync(targetDir);
for (const file of files) {
  const filePath = resolve(targetDir, file);
  let content = readFileSync(filePath, 'utf-8');

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(placeholder, 'g'), value);
  }

  writeFileSync(filePath, content, 'utf-8');
}

console.log(`\nScaffolded: src/experiments/${slug}/`);
console.log(`  meta.ts        — Experiment metadata (hasArticle: true)`);
console.log(`  params.ts      — DialKit control config`);
console.log(`  experiment.ts  — WebGL2 experiment shell`);
console.log(`  shader.glsl    — Fragment shader`);
console.log(`  index.ts       — Barrel export`);
console.log(`  standalone.ts  — Webflow export entry`);
console.log(`\nArticle page available at /experiment/${slug}/article (empty state).`);
console.log(`Auto-discovered by registry.ts — run \`npm run dev\` to see it.`);
