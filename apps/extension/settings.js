document.querySelector('[data-check]').addEventListener('click', async () => {
  const status = document.querySelector('[data-status]');
  status.textContent = 'Checking the local application bridge.';
  const result = await chrome.runtime.sendMessage({ type: 'bridge-status' });
  if (result?.available) { status.textContent = 'The local application bridge is available.'; status.classList.remove('warning'); } else { status.textContent = 'The local application bridge is unavailable. The extension remains usable for reviewing requests, but transfer controls stay disabled.'; status.classList.add('warning'); }
});
