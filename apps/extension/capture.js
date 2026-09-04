(async function () {
  const fields = { file: document.querySelector('[data-file]'), source: document.querySelector('[data-source]'), destination: document.querySelector('[data-destination]'), status: document.querySelector('[data-status]'), confirm: document.querySelector('[data-confirm]'), cancel: document.querySelector('[data-cancel]') };
  let request;
  function setStatus(text, warning = false) { fields.status.textContent = text; fields.status.classList.toggle('warning', warning); }
  try {
    const stored = await chrome.storage.session.get('pendingCapture');
    request = stored.pendingCapture;
    if (!request) { setStatus('No user-invoked request is waiting. Use the link context menu to begin one.', true); return; }
    fields.file.textContent = request.fileName;
    fields.source.textContent = request.sourceUrl;
    fields.destination.textContent = request.destination;
    fields.confirm.disabled = false;
    setStatus('Ready for your explicit confirmation. Nothing has transferred.');
  } catch { setStatus('This browser does not provide the required local session storage.', true); return; }
  fields.confirm.addEventListener('click', async () => {
    fields.confirm.disabled = true;
    setStatus('Handing the confirmed request to the local application.');
    const result = await chrome.runtime.sendMessage({ type: 'download.start', request });
    if (!result || result.available !== true) { setStatus('The local application bridge is unavailable. Install and register the native host, then retry this user-invoked capture.', true); fields.confirm.disabled = false; return; }
    await chrome.storage.session.set({ downloadState: { captureId: request.captureId, state: 'downloading', fileName: request.fileName, sourceUrl: request.sourceUrl, destination: request.destination, bytesReceived: 0, updatedAt: new Date().toISOString() } });
    window.location.assign('downloading.html');
  });
  fields.cancel.addEventListener('click', async () => { await chrome.storage.session.remove('pendingCapture'); setStatus('Cancelled. The queue was not changed.'); fields.confirm.disabled = true; });
}());
