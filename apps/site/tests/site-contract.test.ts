import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const page = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
const styles = readFileSync(resolve(root, 'app/globals.css'), 'utf8');
const layout = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const packageJson = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
) as {
  scripts: Record<string, string>;
};

const requiredPageBoundaries = [
  'aria-controls={`panel-${id}`}',
  'role="tabpanel"',
  "event.key === 'ArrowDown'",
  "event.key === 'ArrowUp'",
  "event.key === 'Home'",
  "event.key === 'End'",
  'config={search}',
  'useBoundedFilter(',
  'value={paletteQuery}',
  'onChange={(event) => setPaletteQuery(event.target.value)}',
  'paletteRef.current.showModal()',
  'onCancel=',
  'paletteOpener.current?.focus()',
  'downloadText(',
  '<table aria-label="Available operations">',
  'SITE_PROVENANCE.version',
  "schoolEnabled && tab !== 'settings'",
  'onContextMenu=',
  "event.shiftKey && event.key === 'F10'",
  'role="menu"',
  'Edit appearance…',
  'Lock this element…',
  'createLocalCredential(credential)',
  'unlockLocalCredential(credential, saved.record)',
] as const;

function validatePage(source: string): string[] {
  return requiredPageBoundaries.filter(
    (boundary) => !source.includes(boundary),
  );
}

void test('keeps the hand-written interactive page boundaries', () => {
  assert.deepEqual(validatePage(page), []);
});

void test('the interaction inventory turns red when a required boundary disappears', () => {
  for (const boundary of requiredPageBoundaries) {
    assert.notEqual(
      page.indexOf(boundary),
      -1,
      `fixture boundary missing: ${boundary}`,
    );
    const changed = page.replaceAll(boundary, '');
    assert.deepEqual(validatePage(changed), [boundary]);
  }
});

void test('mobile navigation retains every tab and overlays paint their own surfaces', () => {
  assert.doesNotMatch(styles, /\.tab-rail button:last-child\s*\{/u);
  assert.match(styles, /\.command-palette::backdrop\s*\{/u);
  assert.match(styles, /\.site-toast\s*\{/u);
});

void test('build and type checks generate factual provenance', () => {
  assert.match(packageJson.scripts.prebuild, /generate-provenance\.mjs/u);
  assert.match(packageJson.scripts.pretypecheck, /generate-provenance\.mjs/u);
  assert.doesNotMatch(page, /Version 0\.1\.0-preview/u);
});

void test('share metadata uses an absolute image and large-card dimensions', () => {
  assert.match(layout, /metadataBase: new URL\(siteUrl\)/u);
  assert.match(layout, /width: 1280/u);
  assert.match(layout, /height: 640/u);
  assert.match(layout, /card: 'summary_large_image'/u);
  assert.match(layout, /themeColor: '#101722'/u);
});
