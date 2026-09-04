'use client';

import { useEffect, useState } from 'react';
import { runRegex } from '../../../packages/regex/index';

export function useBoundedFilter<T>(
  items: readonly T[],
  texts: readonly string[],
  query: string,
  regex: boolean,
  flags: string,
): T[] {
  const inputKey = JSON.stringify([query, flags, texts]);
  const [result, setResult] = useState<{ key: string; indices: number[] }>({
    key: '',
    indices: [],
  });
  useEffect(() => {
    if (!regex || !query) return;
    const controller = new AbortController();
    const [pattern, requestedFlags, samples] = JSON.parse(inputKey) as [
      string,
      string,
      string[],
    ];
    void runRegex(
      { operation: 'filter', pattern, flags: requestedFlags, texts: samples },
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted && value.operation === 'filter')
          setResult({
            key: inputKey,
            indices: value.matches.map((match) => match.textIndex),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ key: inputKey, indices: [] });
      });
    return () => controller.abort();
  }, [inputKey, query, regex]);
  if (!query) return [...items];
  if (!regex)
    return items.filter((_, index) =>
      texts[index]?.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
  return result.key === inputKey
    ? result.indices
        .map((index) => items[index])
        .filter((value): value is T => value !== undefined)
    : [];
}

export function useRegexPreview(
  query: string,
  flags: string,
  sample: string,
  replacement: string,
  enabled: boolean,
) {
  const key = JSON.stringify([query, flags, sample, replacement]);
  const [state, setState] = useState({
    key: '',
    count: 0,
    replacement: '',
    error: '',
  });
  useEffect(() => {
    if (!enabled || !query) return;
    const controller = new AbortController();
    void runRegex(
      { operation: 'evaluate', pattern: query, flags, sample, replacement },
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted && value.operation === 'evaluate')
          setState({
            key,
            count: value.matches.length,
            replacement: value.replacement ?? sample,
            error: '',
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            key,
            count: 0,
            replacement: '',
            error:
              'Pattern evaluation could not finish within the local limits.',
          });
      });
    return () => controller.abort();
  }, [key, query, flags, sample, replacement, enabled]);
  return state.key === key
    ? state
    : {
        key,
        count: 0,
        replacement: '',
        error: enabled && query ? 'Evaluating in an isolated worker…' : '',
      };
}
