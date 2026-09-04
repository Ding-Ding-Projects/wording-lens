import { describe, expect, it } from 'vitest';
import { privateSink, sameRendererDocument, validateDevelopmentUrl } from '../../apps/desktop/electron/ipc-trust';

describe('renderer document trust', () => {
  it('permits local hash navigation but rejects another document, origin, or query', () => {
    const expected = 'file:///C:/product/index.html';
    expect(sameRendererDocument(expected + '#/settings', expected)).toBe(true);
    expect(sameRendererDocument('https://example.invalid', expected)).toBe(false);
    expect(sameRendererDocument('file:///C:/product/other.html', expected)).toBe(false);
    expect(sameRendererDocument(expected + '?payload=x', expected)).toBe(false);
  });
  it('limits development origins to loopback', () => {
    expect(validateDevelopmentUrl('http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173/');
    expect(() => validateDevelopmentUrl('https://example.invalid')).toThrow();
    expect(() => validateDevelopmentUrl('http://user:pass@localhost:5173')).toThrow();
  });
  it('rejects all unrecognized rendering destinations', () => {
    expect(privateSink('private-ui')).toBe('private-ui');
    expect(privateSink('accessible-name')).toBe('accessible-name');
    for (const invalid of ['export', 'notification', 'history', undefined, null, {}]) expect(() => privateSink(invalid)).toThrow();
  });
});
