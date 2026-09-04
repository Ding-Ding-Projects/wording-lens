const SCHEMA_VERSION = 1;
const NATIVE_HOST = 'com.dingding.wording_lens';
const MAX_NAME = 240;
const MAX_URL = 2048;
const MAX_DESTINATION = 1024;
const MENU_ID = 'wording-lens-capture-download';
const controlCharacters = /[\u0000-\u001f\u007f]/u;
const safeCaptureId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const safeFileName = /^(?!\.)(?!.*(?:^|[\\/])\.\.?[\\/])[^\\/]+$/u;
const safeDestination = /^(?![\\/])(?:(?!\.\.?[\\/])[^\\/:]+[\\/])*[^\\/:]+$/u;
const startKeys = ['schemaVersion', 'captureId', 'fileName', 'sourceUrl', 'destination', 'requestedAt', 'userInvoked', 'alwaysOnTop'];
const eventKeys = ['schemaVersion', 'captureId', 'state', 'bytesReceived', 'bytesTotal', 'rateBytesPerSecond', 'etaSeconds', 'updatedAt'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !controlCharacters.test(value);
}

function boundedCounter(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,19})$/u.test(value)) return false;
  try { return BigInt(value) <= 8796093022208n; } catch { return false; }
}

function validateStart(value) {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: 'invalid-schema' };
  if (Object.keys(value).some((key) => !startKeys.includes(key))) return { ok: false, reason: 'unknown-field' };
  if (!boundedString(value.captureId, 96) || !safeCaptureId.test(value.captureId)) return { ok: false, reason: 'invalid-capture-id' };
  if (!boundedString(value.fileName, MAX_NAME) || !safeFileName.test(value.fileName) || value.fileName.includes(':')) return { ok: false, reason: 'invalid-file-name' };
  if (!boundedString(value.sourceUrl, MAX_URL)) return { ok: false, reason: 'invalid-source' };
  try {
    const source = new URL(value.sourceUrl);
    if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password || source.hash) return { ok: false, reason: 'invalid-source' };
  } catch {
    return { ok: false, reason: 'invalid-source' };
  }
  if (!boundedString(value.destination, MAX_DESTINATION) || !safeDestination.test(value.destination)) return { ok: false, reason: 'invalid-destination' };
  if (typeof value.requestedAt !== 'string' || !Number.isFinite(Date.parse(value.requestedAt))) return { ok: false, reason: 'invalid-time' };
  if (value.userInvoked !== true || value.alwaysOnTop !== true) return { ok: false, reason: 'user-action-required' };
  return { ok: true, value: { schemaVersion: SCHEMA_VERSION, captureId: value.captureId, fileName: value.fileName, sourceUrl: value.sourceUrl, destination: value.destination, requestedAt: value.requestedAt, userInvoked: true, alwaysOnTop: true } };
}

function publicState(value) {
  return {
    schemaVersion: SCHEMA_VERSION,
    captureId: value.captureId,
    state: value.state,
    fileName: '[redacted]',
    source: '[redacted]',
    destination: '[redacted]',
    bytesReceived: String(value.bytesReceived ?? '0'),
    bytesTotal: value.bytesTotal == null ? undefined : String(value.bytesTotal),
    rateBytesPerSecond: Number.isFinite(value.rateBytesPerSecond) ? value.rateBytesPerSecond : undefined,
    etaSeconds: Number.isFinite(value.etaSeconds) ? value.etaSeconds : undefined,
    updatedAt: value.updatedAt,
  };
}

function validateNativeEvent(value) {
  if (!isRecord(value) || Object.keys(value).some((key) => !eventKeys.includes(key))) return { ok: false, reason: 'invalid-event' };
  if (value.schemaVersion !== SCHEMA_VERSION || !safeCaptureId.test(String(value.captureId ?? ''))) return { ok: false, reason: 'invalid-event' };
  if (!['downloading', 'complete', 'cancelled', 'failed'].includes(value.state)) return { ok: false, reason: 'invalid-event' };
  if (!boundedCounter(value.bytesReceived)) return { ok: false, reason: 'invalid-event' };
  if (value.bytesTotal !== undefined && !boundedCounter(value.bytesTotal)) return { ok: false, reason: 'invalid-event' };
  if (value.bytesTotal !== undefined && BigInt(value.bytesReceived) > BigInt(value.bytesTotal)) return { ok: false, reason: 'invalid-event' };
  if (value.rateBytesPerSecond !== undefined && (!Number.isSafeInteger(value.rateBytesPerSecond) || value.rateBytesPerSecond < 0)) return { ok: false, reason: 'invalid-event' };
  if (value.etaSeconds !== undefined && (!Number.isSafeInteger(value.etaSeconds) || value.etaSeconds < 0)) return { ok: false, reason: 'invalid-event' };
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return { ok: false, reason: 'invalid-event' };
  return { ok: true, value };
}

function basenameFromLink(linkUrl) {
  try {
    const pathname = new URL(linkUrl).pathname;
    const candidate = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1)).trim();
    const cleaned = candidate.replace(/[^A-Za-z0-9._ -]/gu, '_').slice(0, MAX_NAME);
    return safeFileName.test(cleaned) && cleaned !== '.' && cleaned !== '..' ? cleaned : 'download';
  } catch {
    return 'download';
  }
}

async function setPending(request) {
  await chrome.storage.session.set({ pendingCapture: request, downloadState: { captureId: request.captureId, state: 'start', fileName: request.fileName, updatedAt: new Date().toISOString() } });
}

async function openCapture() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('capture.html') });
}

async function sendToNative(request) {
  const checked = validateStart(request);
  if (!checked.ok) return { available: false, reason: 'invalid-request' };
  try {
    const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: 'download.start', version: SCHEMA_VERSION, request: checked.value });
    if (!isRecord(response) || response.version !== SCHEMA_VERSION || response.captureId !== request.captureId || response.accepted !== true) return { available: false, reason: 'native-host-rejected' };
    return { available: true, response };
  } catch {
    return { available: false, reason: 'native-host-not-installed' };
  }
}

function checkNativeBridge() {
  return new Promise((resolve) => {
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST);
      let settled = false;
      const finish = (value) => { if (settled) return; settled = true; resolve(value); };
      port.onDisconnect.addListener(() => finish({ available: !chrome.runtime.lastError, host: NATIVE_HOST, reason: chrome.runtime.lastError ? 'native-host-not-installed' : undefined }));
      setTimeout(() => { port.disconnect(); finish({ available: true, host: NATIVE_HOST }); }, 250);
    } catch {
      resolve({ available: false, reason: 'native-host-not-installed' });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: 'Capture download with Wording Lens', contexts: ['link'] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.linkUrl) return;
  const sourceUrl = info.linkUrl;
  const request = {
    schemaVersion: SCHEMA_VERSION,
    captureId: crypto.randomUUID(),
    fileName: basenameFromLink(sourceUrl),
    sourceUrl,
    destination: `Downloads/${basenameFromLink(sourceUrl)}`,
    requestedAt: new Date().toISOString(),
    userInvoked: true,
    alwaysOnTop: true,
  };
  const checked = validateStart(request);
  if (!checked.ok) return;
  await setPending(checked.value);
  await openCapture();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRecord(message)) return false;
  if (message.type === 'bridge-status') {
    checkNativeBridge().then((result) => sendResponse(result));
    return true;
  }
  if (message.type === 'download.start') {
    sendToNative(message.request).then(async (result) => {
      if (result.available) await chrome.storage.session.set({ downloadState: { ...publicState({ ...message.request, state: 'downloading', updatedAt: new Date().toISOString() }), fileName: '[redacted]' } });
      sendResponse(result);
    });
    return true;
  }
  if (['download.pause', 'download.resume', 'download.cancel'].includes(message.type)) {
    const captureId = message.captureId;
    if (!boundedString(captureId, 96) || !safeCaptureId.test(captureId)) { sendResponse({ available: false, reason: 'invalid-capture-id' }); return false; }
    try {
      const response = chrome.runtime.sendNativeMessage(NATIVE_HOST, { type: message.type, version: SCHEMA_VERSION, captureId });
      response.then((value) => sendResponse(isRecord(value) ? value : { available: false, reason: 'native-host-rejected' })).catch(() => sendResponse({ available: false, reason: 'native-host-not-installed' }));
      return true;
    } catch {
      sendResponse({ available: false, reason: 'native-host-not-installed' });
      return false;
    }
  }
  if (message.type === 'download.native-event') {
    const checked = validateNativeEvent(message.state);
    if (!checked.ok) { sendResponse(checked); return false; }
    chrome.storage.session.set({ downloadState: publicState(checked.value) }).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
