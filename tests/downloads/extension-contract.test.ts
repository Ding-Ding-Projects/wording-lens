import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'apps/extension');

describe('unpacked extension contract', () => {
  it('is a Manifest V3 context-menu companion without broad page access', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8')) as Record<string, unknown>;
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(expect.arrayContaining(['contextMenus', 'nativeMessaging', 'storage']));
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect((manifest.background as Record<string, unknown>).service_worker).toBe('service-worker.js');
  });

  it('keeps distinct accessible start, progress, and completion surfaces', async () => {
    for (const [file, heading] of [['capture.html', 'Start download'], ['downloading.html', 'Downloading'], ['complete.html', 'Download complete']] as const) {
      const html = await readFile(resolve(root, file), 'utf8');
      expect(html).toContain(`<h1>${heading}</h1>`);
      expect(html).toContain('data-search');
      expect(html).toContain('data-regex-toggle');
    }
  });

  it('keeps native messaging fixed to the versioned download schema', async () => {
    const worker = await readFile(resolve(root, 'service-worker.js'), 'utf8');
    expect(worker).toContain("const NATIVE_HOST = 'com.dingding.wording_lens';");
    expect(worker).toContain("type: 'download.start'");
    expect(worker).toContain('userInvoked: true');
    expect(worker).toContain('native-host-not-installed');
    expect(worker).not.toContain('window.');
    expect(worker).not.toContain('webRequest');
    expect(worker).not.toContain('cookies');
  });
});
