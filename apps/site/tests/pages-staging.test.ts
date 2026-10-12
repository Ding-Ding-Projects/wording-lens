import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { normalizeBasePath, stagePages } from '../scripts/stage-pages.mjs';

async function fixture(basePath = '/wording-lens') {
  const root = await mkdtemp(resolve(tmpdir(), 'wording-lens-pages-'));
  const sourceRoot = resolve(root, 'client');
  const outputRoot = resolve(root, 'pages');
  const exportRoot = resolve(sourceRoot, `.${basePath}`);
  await mkdir(resolve(exportRoot, '_next/static'), { recursive: true });
  const html = `<html><head><link rel="stylesheet" href="${basePath}/_next/static/site.css"><link rel="icon" href="${basePath}/favicon.svg"></head><body><script src="${basePath}/_next/static/site.js"></script></body></html>`;
  await writeFile(resolve(exportRoot, 'index.html'), html);
  await writeFile(resolve(exportRoot, 'index.txt'), 'neutral RSC fixture');
  await writeFile(
    resolve(exportRoot, '_next/static/site.css'),
    'body { color: black; }',
  );
  await writeFile(
    resolve(exportRoot, '_next/static/site.js'),
    'console.log("neutral fixture");',
  );
  await writeFile(resolve(exportRoot, 'favicon.svg'), '<svg/>');
  if (basePath) await writeFile(resolve(sourceRoot, '404.html'), html);
  return { root, sourceRoot, outputRoot, exportRoot, basePath };
}

for (const basePath of ['', '/wording-lens', '/project/docs']) {
  void test(`promotes a complete static export for ${basePath || 'root Pages'}`, async () => {
    const value = await fixture(basePath);
    try {
      const result = await stagePages(value);
      assert.ok(result.resources >= 3);
      assert.match(
        await readFile(resolve(value.outputRoot, 'index.html'), 'utf8'),
        /<html>/u,
      );
      assert.equal(
        await readFile(resolve(value.outputRoot, 'index.txt'), 'utf8'),
        'neutral RSC fixture',
      );
      assert.equal(
        await readFile(resolve(value.outputRoot, '.nojekyll'), 'utf8'),
        '',
      );
      if (basePath)
        assert.match(
          await readFile(resolve(value.outputRoot, '404.html'), 'utf8'),
          /<html>/u,
        );
    } finally {
      await rm(value.root, { recursive: true, force: true });
    }
  });
}

void test('rejects a missing base-path document instead of using an unrelated root index', async () => {
  const value = await fixture();
  try {
    await rm(resolve(value.exportRoot, 'index.html'));
    await writeFile(resolve(value.sourceRoot, 'index.html'), 'unrelated root');
    await assert.rejects(stagePages(value), /base-path document/u);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

void test('turns red when a generated CSS or JavaScript resource disappears', async () => {
  for (const name of ['site.css', 'site.js']) {
    const value = await fixture();
    try {
      await rm(resolve(value.exportRoot, '_next/static', name));
      await assert.rejects(
        stagePages(value),
        /Missing or empty Pages resource/u,
      );
    } finally {
      await rm(value.root, { recursive: true, force: true });
    }
  }
});

void test('turns red for the former origin-root favicon URL', async () => {
  const value = await fixture();
  try {
    const index = resolve(value.exportRoot, 'index.html');
    await writeFile(
      index,
      (await readFile(index, 'utf8')).replace(
        '/wording-lens/favicon.svg',
        '/favicon.svg',
      ),
    );
    await assert.rejects(
      stagePages(value),
      /Resource escapes the Pages base path/u,
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

void test('rebuilds staging without keeping obsolete files', async () => {
  const value = await fixture();
  try {
    await mkdir(value.outputRoot);
    await writeFile(resolve(value.outputRoot, 'stale.html'), 'obsolete build');
    await stagePages(value);
    await assert.rejects(readFile(resolve(value.outputRoot, 'stale.html')), {
      code: 'ENOENT',
    });
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

void test('refuses overlapping source and output directories', async () => {
  const value = await fixture();
  try {
    await assert.rejects(
      stagePages({ ...value, outputRoot: value.exportRoot }),
      /must not overlap/u,
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

void test('refuses symbolic links in the publication artifact', async () => {
  const value = await fixture();
  try {
    await symlink(
      resolve(value.exportRoot, 'index.html'),
      resolve(value.exportRoot, 'linked.html'),
    );
    await assert.rejects(stagePages(value), /symbolic links/u);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

void test('rejects ambiguous and traversal-bearing base paths', () => {
  assert.equal(normalizeBasePath('/'), '');
  for (const path of [
    'wording-lens',
    '/../other',
    '/wording-lens/',
    '/a//b',
    '/a%2fb',
    '/a?b',
  ]) {
    assert.throws(
      () => normalizeBasePath(path),
      /Unsupported Pages base path/u,
    );
  }
});
