import { describe, expect, it } from 'vitest';
import { describeElement, PrivateOperationEpoch } from '../../apps/site/lib/private-boundary';

describe('site private presentation boundaries', () => {
  it('does not let a late cache read restore text after lock or clear', async () => {
    const epoch = new PrivateOperationEpoch();
    let finish: (value: string) => void = () => undefined;
    let presented = '';
    const attempt = epoch.begin();
    const pending = new Promise<string>((resolve) => { finish = resolve; }).then((value) => {
      if (epoch.isCurrent(attempt)) presented = value;
    });
    epoch.invalidate();
    finish('neutral test wording');
    await pending;
    expect(presented).toBe('');
  });

  it('only commits the newest unlock or file read', () => {
    const epoch = new PrivateOperationEpoch();
    const first = epoch.begin();
    const second = epoch.begin();
    expect(epoch.isCurrent(first)).toBe(false);
    expect(epoch.isCurrent(second)).toBe(true);
  });

  it('keeps element labels and persistence keys independent of text and attributes', () => {
    const target = document.createElement('button');
    const container = document.createElement('section');
    container.append(target);
    document.body.append(container);
    try {
      target.textContent = 'neutral fixture alpha';
      target.setAttribute('aria-label', 'neutral fixture beta');
      target.id = 'fixture-value';
      const first = describeElement(target);
      target.textContent = 'different fixture';
      target.id = 'different-identity';
      const second = describeElement(target);
      expect(second).toEqual(first);
      expect(JSON.stringify(first)).not.toContain('fixture');
      expect(first.label).toBe('button element');
    } finally { container.remove(); }
  });

  it('marks both private descendants and their ancestor containers non-exportable', () => {
    const outer = document.createElement('section');
    const privatePanel = document.createElement('section');
    privatePanel.setAttribute('data-private-content', '');
    const row = document.createElement('strong');
    row.textContent = 'neutral private fixture';
    privatePanel.append(row);
    outer.append(privatePanel);
    expect(describeElement(row).containsPrivateContent).toBe(true);
    expect(describeElement(outer).containsPrivateContent).toBe(true);
    expect(describeElement(row).label).toBe('Private content');
  });
});
