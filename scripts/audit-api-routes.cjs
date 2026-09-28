#!/usr/bin/env node
/**
 * Diffs the route handlers under src/app/api against openapi.yaml so
 * undocumented (and therefore unverifiable "no external consumers") routes,
 * and stale openapi entries with no backing route file, are visible instead
 * of being discovered by trial and error.
 *
 * Usage: node scripts/audit-api-routes.cjs [--json]
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const specPath = path.join(rootDir, 'openapi.yaml');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.name === 'route.ts') {
      files.push(full);
    }
  }
  return files;
}

function toRoutePath(routeFile) {
  const rel = path
    .relative(path.join(rootDir, 'src', 'app'), path.dirname(routeFile))
    .split(path.sep)
    .join('/');
  return (
    '/' +
    rel
      .split('/')
      .map((segment) =>
        segment.startsWith('[') && segment.endsWith(']') ? ':param' : segment,
      )
      .join('/')
  );
}

function extractMethods(routeFile) {
  const source = fs.readFileSync(routeFile, 'utf8');
  const methods = [];
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const re = new RegExp(`export\\s+(const|async function)\\s+${method}\\b`);
    if (re.test(source)) methods.push(method);
  }
  return methods;
}

const routeFiles = walk(apiDir);
const routes = routeFiles.map((file) => ({
  file: path.relative(rootDir, file),
  routePath: toRoutePath(file),
  methods: extractMethods(file),
}));

const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
const documentedPaths = new Set(
  Object.keys(spec.paths || {}).map((p) => p.replace(/\{[^}]+\}/g, ':param')),
);

const undocumented = routes.filter((r) => !documentedPaths.has(r.routePath));

const routePathSet = new Set(routes.map((r) => r.routePath));
const staleSpecPaths = [...documentedPaths].filter((p) => !routePathSet.has(p));

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify({ totalRoutes: routes.length, undocumented, staleSpecPaths }, null, 2),
  );
  process.exit(0);
}

console.log('--- API route <-> openapi.yaml audit ---');
console.log(`Route files: ${routes.length}`);
console.log(`Documented in openapi.yaml: ${documentedPaths.size}`);
console.log('');

if (undocumented.length > 0) {
  console.log(
    `⚠ ${undocumented.length} route file(s) have no matching openapi.yaml entry.\n` +
      "  This does NOT mean they're unused — it means their external-consumer status\n" +
      '  cannot be confirmed via the spec. Check client code / infra config (cron,\n' +
      '  webhooks, admin tooling) before treating any of these as dead code:\n',
  );
  for (const r of undocumented) {
    console.log(`  ${r.routePath.padEnd(50)} [${r.methods.join(', ') || 'no exported method'}]  ${r.file}`);
  }
  console.log('');
} else {
  console.log('✔ Every route file has a matching openapi.yaml entry.\n');
}

if (staleSpecPaths.length > 0) {
  console.log(
    `⚠ ${staleSpecPaths.length} openapi.yaml path(s) have no backing route file (spec drift):\n`,
  );
  for (const p of staleSpecPaths) {
    console.log(`  ${p}`);
  }
  console.log('');
} else {
  console.log('✔ No openapi.yaml paths are missing a backing route file.\n');
}

process.exit(0);
