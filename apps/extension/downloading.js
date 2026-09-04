(async function () {
  const by = (selector) => document.querySelector(selector);
  const status = by('[data-status]');
  const progress = by('[data-progress]');
  const label = by('[data-progress-label]');
  const pause = by('[data-pause]');
  const resume = by('[data-resume]');
  const cancel = by('[data-cancel]');
  let state;
  function render(next) {
    if (!next) return;
    state = next;
    by('[data-file]').textContent = next.fileName || '[redacted until local app confirms]';
    by('[data-source]').textContent = '[redacted from public exports]';
    by('[data-destination]').textContent = '[redacted from public exports]';
    const received = Number(next.bytesReceived || 0);
    const total = Number(next.bytesTotal || 0);
    progress.max = total > 0 ? total : 1;
    progress.value = total > 0 ? Math.min(received, total) : 0;
    label.textContent = total > 0 ? `${received} of ${total} bytes` : `${received} bytes received`;
    by('[data-rate]').textContent = Number.isFinite(next.rateBytesPerSecond) ? `${next.rateBytesPerSecond} bytes per second` : 'Waiting for byte progress';
    by('[data-eta]').textContent = Number.isFinite(next.etaSeconds) ? `${next.etaSeconds} seconds` : 'Unknown until the local app reports a total and rate';
    status.textContent = next.state === 'complete' ? 'Transfer complete. Opening the completion surface.' : next.state === 'failed' ? 'Transfer failed. The local application owns the detailed recovery action.' : next.state === 'cancelled' ? 'Transfer cancelled. No further bytes will be accepted.' : next.paused ? 'Paused by the user.' : 'Transfer is active.';
    pause.disabled = next.state !== 'downloading' || next.paused;
    resume.disabled = next.state !== 'downloading' || !next.paused;
    if (['complete', 'cancelled', 'failed'].includes(next.state)) window.setTimeout(() => window.location.assign('complete.html'), 0);
  }
  const stored = await chrome.storage.session.get('downloadState');
  render(stored.downloadState);
  if (!state) status.textContent = 'No active transfer is available. Return to Start download.';
  async function send(type) { if (!state) return; const result = await chrome.runtime.sendMessage({ type, captureId: state.captureId }); if (!result || result.available === false) status.textContent = 'The local application bridge is unavailable; the requested control did not change the queue.'; }
  pause.addEventListener('click', () => send('download.pause'));
  resume.addEventListener('click', () => send('download.resume'));
  cancel.addEventListener('click', () => send('download.cancel'));
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.downloadState) render(changes.downloadState.newValue); });
}());
