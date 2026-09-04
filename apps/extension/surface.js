(function () {
  const query = document.querySelector('[data-search]');
  const regexButton = document.querySelector('[data-regex-toggle]');
  const panel = document.querySelector('[data-regex-panel]');
  const pattern = document.querySelector('[data-regex-pattern]');
  const flags = document.querySelector('[data-regex-flags]');
  const sample = document.querySelector('[data-regex-sample]');
  const result = document.querySelector('[data-regex-result]');
  const searchResult = document.querySelector('[data-search-result]');
  if (!query || !regexButton || !panel || !pattern || !flags || !sample) return;
  regexButton.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    regexButton.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
    if (!panel.classList.contains('hidden')) pattern.focus();
  });
  function evaluate() {
    const source = pattern.value || query.value;
    if (!source) { if (result) result.textContent = 'Plain text search is ready.'; return; }
    try {
      const expression = new RegExp(source, flags.value.slice(0, 8));
      const match = expression.exec(sample.value || document.body.innerText);
      if (result) result.textContent = match ? `Match found at index ${match.index}.` : 'No match in this sample.';
    } catch (error) {
      if (result) result.textContent = `Pattern is invalid: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }
  [query, pattern, flags, sample].forEach((field) => field.addEventListener('input', () => {
    if (field === query && !pattern.value) pattern.value = query.value;
    evaluate();
  }));
  query.addEventListener('input', () => {
    const needle = query.value.trim().toLowerCase();
    if (searchResult) searchResult.textContent = needle ? `Searching this surface for “${needle}”.` : 'Plain text search is ready.';
  });
}());
