import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOTS = ['pokemon/js', 'pokemon/scripts', 'pokemon/tests'];

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(path));
    else if (['.js', '.mjs'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = ROOTS.flatMap(collectJavaScriptFiles).sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
}

console.log(`JavaScript syntax validated: ${files.length} files.`);
