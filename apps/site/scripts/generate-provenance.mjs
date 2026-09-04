import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(siteRoot, '..', '..');
const packageJson = JSON.parse(
  await readFile(resolve(siteRoot, 'package.json'), 'utf8'),
);

function git(...arguments_) {
  try {
    return execFileSync('git', arguments_, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const commit = git('rev-parse', 'HEAD');
const updatedAt = git('show', '-s', '--format=%cI', 'HEAD');
const output = resolve(siteRoot, '.generated', 'site-provenance.ts');
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `export const SITE_PROVENANCE = Object.freeze(${JSON.stringify({
    version: typeof packageJson.version === 'string' ? packageJson.version : '',
    commit,
    updatedAt,
  })});\n`,
  'utf8',
);
