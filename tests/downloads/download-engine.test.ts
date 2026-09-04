import {
  DownloadStateEngine,
  DOWNLOAD_SCHEMA_VERSION,
  MAX_DOWNLOAD_NAME,
  parseNativeMessage,
  validateDownloadStart,
} from '../../packages/downloads/src/index';
import { describe, expect, it } from 'vitest';

const startRequest = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: DOWNLOAD_SCHEMA_VERSION,
  captureId: 'capture-001',
  fileName: 'report.pdf',
  sourceUrl: 'https://downloads.example.test/report.pdf',
  destination: 'Downloads/report.pdf',
  requestedAt: '2026-09-04T12:00:00.000Z',
  userInvoked: true,
  alwaysOnTop: true,
  ...overrides,
});

describe('download state engine', () => {
  it('validates a user-invoked start and refuses replay', () => {
    const engine = new DownloadStateEngine();
    const first = engine.start(startRequest(), new Date('2026-09-04T12:00:01.000Z'));
    expect(first.ok).toBe(true);
    const replay = engine.start(startRequest(), new Date('2026-09-04T12:00:02.000Z'));
    expect(replay).toEqual({ ok: false, error: { code: 'replay', message: 'This capture request was already accepted', retryable: false } });
  });

  it('rejects unsafe URLs, path traversal, control characters, and non-user requests', () => {
    for (const request of [
      startRequest({ sourceUrl: 'javascript:alert(1)' }),
      startRequest({ sourceUrl: 'https://user:secret@downloads.example.test/a' }),
      startRequest({ sourceUrl: 'https://downloads.example.test/a#private-fragment' }),
      startRequest({ fileName: '../secret.txt' }),
      startRequest({ fileName: `x${String.fromCharCode(0)}.txt` }),
      startRequest({ userInvoked: false }),
      startRequest({ alwaysOnTop: false }),
      startRequest({ extra: 'unknown' }),
      startRequest({ destination: '../outside.txt' }),
      startRequest({ destination: 'C:\\outside.txt' }),
      startRequest({ fileName: 'x'.repeat(MAX_DOWNLOAD_NAME + 1) }),
    ]) {
      expect(validateDownloadStart(request).ok).toBe(false);
    }
  });

  it('moves through progress, pause, resume, completion, and public redaction', () => {
    const engine = new DownloadStateEngine();
    expect(engine.start(startRequest(), new Date('2026-09-04T12:00:00.000Z')).ok).toBe(true);
    expect(engine.begin('capture-001', new Date('2026-09-04T12:00:01.000Z'), 1_000n).ok).toBe(true);
    const progress = engine.progress('capture-001', 250n, new Date('2026-09-04T12:00:02.000Z'));
    expect(progress.ok).toBe(true);
    if (progress.ok) {
      expect(progress.value.transfer.rateBytesPerSecond).toBe(250);
      expect(progress.value.transfer.etaSeconds).toBe(3);
      expect(progress.value.alwaysOnTop).toBe(true);
    }
    expect(engine.pause('capture-001').ok).toBe(true);
    expect(engine.progress('capture-001', 500n).ok).toBe(false);
    expect(engine.resume('capture-001').ok).toBe(true);
    expect(engine.progress('capture-001', 1_000n, new Date('2026-09-04T12:00:03.000Z')).ok).toBe(true);
    expect(engine.complete('capture-001', new Date('2026-09-04T12:00:04.000Z')).ok).toBe(true);
    const exported = engine.listPublic()[0];
    expect(exported.fileName).toBe('[redacted]');
    expect(exported.source).toBe('[redacted]');
    expect(exported.destination).toBe('[redacted]');
    expect(exported.bytesReceived).toBe('1000');
    expect(exported.state).toBe('complete');
  });

  it('keeps terminal records terminal and validates the native allowlist', () => {
    const engine = new DownloadStateEngine();
    engine.start(startRequest(), new Date('2026-09-04T12:00:00.000Z'));
    engine.cancel('capture-001', new Date('2026-09-04T12:00:01.000Z'));
    expect(engine.begin('capture-001').ok).toBe(false);
    expect(parseNativeMessage({ type: 'download.pause', version: 1, captureId: 'capture-001' }).ok).toBe(true);
    expect(parseNativeMessage({ type: 'download.exec', version: 1, captureId: 'capture-001' }).ok).toBe(false);
    expect(parseNativeMessage({ type: 'download.pause', version: 1, captureId: '../escape' }).ok).toBe(false);
  });
});
