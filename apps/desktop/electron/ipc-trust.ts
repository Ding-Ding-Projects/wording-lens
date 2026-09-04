export function sameRendererDocument(actual: string, expected: string): boolean {
  try {
    const actualUrl = new URL(actual);
    const expectedUrl = new URL(expected);
    actualUrl.hash = '';
    expectedUrl.hash = '';
    return actualUrl.href === expectedUrl.href;
  } catch { return false; }
}

export function validateDevelopmentUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Development renderer must use a loopback HTTP URL without credentials');
  }
  return url.href;
}

export function privateSink(value: unknown): 'private-ui' | 'accessible-name' {
  if (value !== 'private-ui' && value !== 'accessible-name') throw new Error('Private wording sink boundary is not allowed');
  return value;
}
