import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shellSource = await fs.readFile(path.join(projectRoot, 'service-worker.js'), 'utf8');
const assetBlock = shellSource.match(/const CORE_ASSETS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
const shellAssets = [...assetBlock.matchAll(/['"](\.\/[^'"]*)['"]/g)].map(match => match[1]);
const shellSet = new Set(shellAssets);
const required = new Set(['./', './index.html']);

function projectAsset(fromFile, reference) {
  if (!reference.startsWith('.')) return null;
  const absolute = path.resolve(path.dirname(fromFile), reference.split(/[?#]/)[0]);
  const relative = path.relative(projectRoot, absolute).split(path.sep).join('/');
  if (relative.startsWith('../')) return null;
  return `./${relative}`;
}

async function collectJavaScript(asset, visited = new Set()) {
  if (visited.has(asset)) return;
  visited.add(asset);
  required.add(asset);
  const filename = path.join(projectRoot, asset.slice(2));
  const source = await fs.readFile(filename, 'utf8');
  const imports = [...source.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)];
  for (const match of imports) {
    const dependency = projectAsset(filename, match[1]);
    if (dependency) await collectJavaScript(dependency, visited);
  }
}

async function collectCss(asset) {
  required.add(asset);
  const filename = path.join(projectRoot, asset.slice(2));
  const source = await fs.readFile(filename, 'utf8');
  for (const match of source.matchAll(/url\((?:['"])?([^)'"\s]+)(?:['"])?\)/g)) {
    const dependency = projectAsset(filename, match[1]);
    if (dependency) required.add(dependency);
  }
}

const indexFilename = path.join(projectRoot, 'index.html');
const indexSource = await fs.readFile(indexFilename, 'utf8');
for (const match of indexSource.matchAll(/(?:src|href)=['"]([^'"]+)['"]/g)) {
  const asset = projectAsset(indexFilename, match[1]);
  if (!asset) continue;
  if (asset.endsWith('.js')) await collectJavaScript(asset);
  else if (asset.endsWith('.css')) await collectCss(asset);
  else required.add(asset);
}

const manifestAsset = './manifest.webmanifest';
if (required.has(manifestAsset)) {
  const manifest = JSON.parse(await fs.readFile(path.join(projectRoot, manifestAsset.slice(2)), 'utf8'));
  for (const icon of manifest.icons ?? []) {
    const asset = projectAsset(path.join(projectRoot, 'manifest.webmanifest'), icon.src);
    if (asset) required.add(asset);
  }
}

const missing = [...required].filter(asset => !shellSet.has(asset)).sort();
const extra = [...shellSet].filter(asset => !required.has(asset)).sort();
const duplicates = shellAssets.filter((asset, index) => shellAssets.indexOf(asset) !== index);
const absent = [];
for (const asset of shellSet) {
  if (asset === './') continue;
  try { await fs.access(path.join(projectRoot, asset.slice(2))); }
  catch { absent.push(asset); }
}

if (missing.length || extra.length || duplicates.length || absent.length) {
  if (missing.length) console.error(`Missing from CORE_ASSETS:\n${missing.join('\n')}`);
  if (extra.length) console.error(`Unused CORE_ASSETS:\n${extra.join('\n')}`);
  if (duplicates.length) console.error(`Duplicate CORE_ASSETS:\n${[...new Set(duplicates)].join('\n')}`);
  if (absent.length) console.error(`CORE_ASSETS files not found:\n${absent.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Service-worker shell validated: ${required.size} required assets, ${shellSet.size} cached assets.`);
}
