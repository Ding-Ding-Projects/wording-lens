import { useEffect, useState, type RefObject } from 'react';
import { runRegex } from '../../../packages/regex/index';

/** Searches the current rendered screen. Provider records are never modified. */
export function useSurfaceSearch(root: RefObject<HTMLElement | null>, screen: string, query: string, pattern: string, flags: string) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let active = true;
    let generation = 0;
    let controller: AbortController | undefined;
    const hiddenBefore = new Map<HTMLElement, boolean>();
    const restore = () => { for (const [element, value] of hiddenBefore) element.hidden = value; hiddenBefore.clear(); };
    const evaluate = async () => {
      const attempt = ++generation;
      controller?.abort();
      controller = new AbortController();
      restore();
      if (!query && !pattern) { if (active) setStatus(''); return; }
      const candidates = Array.from(container.querySelectorAll<HTMLElement>('.list-row, .history-row, .article-row, .notification, .setting-row, .adapter, .surface-card'));
      const targets = candidates.filter((item) => !candidates.some((child) => child !== item && item.contains(child)));
      const texts = targets.map((target) => target.textContent ?? '');
      if (active) setStatus('Searching the current screen…');
      try {
        const matched = pattern
          ? await runRegex({ operation: 'filter', pattern, flags, texts }, { signal: controller.signal }).then((value) => new Set(value.operation === 'filter' ? value.matches.map((match) => match.textIndex) : []))
          : new Set(texts.flatMap((text, index) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? [index] : []));
        if (!active || generation !== attempt) return;
        targets.forEach((target, index) => { hiddenBefore.set(target, target.hidden); target.hidden = target.hidden || !matched.has(index); });
        setStatus(`${matched.size} of ${targets.length} screen items match.`);
      } catch {
        if (active && generation === attempt) setStatus('Search could not finish within the local limits. All items remain visible.');
      }
    };
    const observer = new MutationObserver(() => { void evaluate(); });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    void evaluate();
    return () => { active = false; generation += 1; controller?.abort(); observer.disconnect(); restore(); };
  }, [root, screen, query, pattern, flags]);
  return status;
}
