/** Invalidates pending private work before lock, clear, or a newer operation. */
export class PrivateOperationEpoch {
  private version = 0;

  begin(): number {
    return ++this.version;
  }
  isCurrent(version: number): boolean {
    return this.version === version;
  }
  invalidate(): void {
    this.version += 1;
  }
}

/** Element identity must not depend on text, accessible names, or private values. */
export function describeElement(target: HTMLElement): {
  key: string;
  label: string;
  containsPrivateContent: boolean;
} {
  const parts: string[] = [];
  let node: Element | null = target;
  while (node && parts.length < 32) {
    const parent: Element | null = node.parentElement;
    const position = parent ? Array.from(parent.children).indexOf(node) : 0;
    parts.unshift(`${node.tagName.toLowerCase()}-${position}`);
    node = parent;
  }
  const containsPrivateContent = Boolean(
    target.closest('[data-private-content]') ||
    target.querySelector('[data-private-content]'),
  );
  return {
    key: parts.join('.'),
    label: containsPrivateContent
      ? 'Private content'
      : `${target.tagName.toLowerCase()} element`,
    containsPrivateContent,
  };
}
