(async function () {
  const stored = await chrome.storage.session.get(['downloadState', 'pendingCapture']);
  const state = stored.downloadState || {};
  const request = stored.pendingCapture || {};
  document.querySelector('[data-file]').textContent = request.fileName || state.fileName || '[redacted]';
  document.querySelector('[data-result]').textContent = state.state || 'No terminal state was supplied';
  document.querySelector('[data-status]').textContent = state.state === 'complete' ? 'Complete. The local application accepted the transfer.' : state.state === 'failed' ? 'The local application reported a failed transfer.' : state.state === 'cancelled' ? 'The transfer was cancelled before completion.' : 'The terminal result is not available yet.';
  document.querySelector('[data-dismiss]').addEventListener('click', async () => { await chrome.storage.session.remove(['downloadState', 'pendingCapture']); window.close(); });
}());
