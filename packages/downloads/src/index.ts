export const DOWNLOAD_SCHEMA_VERSION = 1 as const;
export const MAX_DOWNLOAD_NAME = 240;
export const MAX_DOWNLOAD_URL = 2_048;
export const MAX_DESTINATION = 1_024;
export const MAX_PROGRESS_BYTES = 8n * 1024n * 1024n * 1024n * 1024n;

export type DownloadErrorCode =
  | 'invalid-input'
  | 'replay'
  | 'invalid-transition'
  | 'bridge-unavailable'
  | 'cancelled'
  | 'transfer';

export type DownloadError = {
  code: DownloadErrorCode;
  message: string;
  retryable: boolean;
};

export type DownloadStartRequest = {
  schemaVersion: typeof DOWNLOAD_SCHEMA_VERSION;
  captureId: string;
  fileName: string;
  sourceUrl: string;
  destination: string;
  requestedAt: string;
  userInvoked: true;
  alwaysOnTop: true;
};

export type StartRecord = DownloadStartRequest & {
  state: 'start';
  createdAt: string;
};

export type TransferStats = {
  bytesReceived: bigint;
  bytesTotal?: bigint;
  rateBytesPerSecond?: number;
  etaSeconds?: number;
  updatedAt: string;
};

type DownloadRecordBase = Omit<StartRecord, 'state'>;

export type DownloadingRecord = DownloadRecordBase & {
  state: 'downloading';
  transfer: TransferStats;
  paused: boolean;
};

export type CompleteRecord = DownloadRecordBase & {
  state: 'complete' | 'cancelled' | 'failed';
  transfer: TransferStats;
  finishedAt: string;
  error?: DownloadError;
};

export type DownloadRecord = StartRecord | DownloadingRecord | CompleteRecord;

export type DownloadPublicRecord = {
  captureId: string;
  state: DownloadRecord['state'];
  fileName: '[redacted]';
  source: '[redacted]';
  destination: '[redacted]';
  bytesReceived: string;
  bytesTotal?: string;
  rateBytesPerSecond?: number;
  etaSeconds?: number;
  requestedAt: string;
  createdAt: string;
  finishedAt?: string;
  errorCode?: DownloadErrorCode;
};

export type NativeBridgeMessage =
  | { type: 'download.start'; version: typeof DOWNLOAD_SCHEMA_VERSION; request: DownloadStartRequest }
  | { type: 'download.pause'; version: typeof DOWNLOAD_SCHEMA_VERSION; captureId: string }
  | { type: 'download.resume'; version: typeof DOWNLOAD_SCHEMA_VERSION; captureId: string }
  | { type: 'download.cancel'; version: typeof DOWNLOAD_SCHEMA_VERSION; captureId: string };

export type BridgeStatus =
  | { available: true; host: string }
  | { available: false; reason: 'native-host-not-installed' | 'native-host-rejected' | 'unsupported-browser' };

type Result<T> = { ok: true; value: T } | { ok: false; error: DownloadError };

const controlCharacters = /[\u0000-\u001f\u007f]/u;
const safeCaptureId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const safeFileName = /^(?!\.)(?!.*(?:^|[\\/])\.\.?[\\/])[^\\/]+$/u;
const safeDestination = /^(?![\\/])(?:(?!\.\.?[\\/])[^\\/:]+[\\/])*[^\\/:]+$/u;
const startKeys = ['schemaVersion', 'captureId', 'fileName', 'sourceUrl', 'destination', 'requestedAt', 'userInvoked', 'alwaysOnTop'];

function failure(code: DownloadErrorCode, message: string, retryable = false): Result<never> {
  return { ok: false, error: { code, message, retryable } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !controlCharacters.test(value);
}

function parseDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseHttpUrl(value: unknown): value is string {
  if (!boundedString(value, MAX_DOWNLOAD_URL)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.username === '' && parsed.password === '' && parsed.hash === '';
  } catch {
    return false;
  }
}

function parseBytes(value: unknown): value is bigint {
  return typeof value === 'bigint' && value >= 0n && value <= MAX_PROGRESS_BYTES;
}

export function validateDownloadStart(value: unknown): Result<DownloadStartRequest> {
  if (!isRecord(value)) return failure('invalid-input', 'Download request must be an object');
  if (Object.keys(value).some((key) => !startKeys.includes(key))) return failure('invalid-input', 'Download request contains an unknown field');
  if (value.schemaVersion !== DOWNLOAD_SCHEMA_VERSION) return failure('invalid-input', 'Unsupported download schema version');
  if (!boundedString(value.captureId, 96) || !safeCaptureId.test(value.captureId)) return failure('invalid-input', 'Capture id is invalid');
  if (!boundedString(value.fileName, MAX_DOWNLOAD_NAME) || !safeFileName.test(value.fileName) || value.fileName.includes(':')) return failure('invalid-input', 'File name must be a single safe path segment');
  if (!parseHttpUrl(value.sourceUrl)) return failure('invalid-input', 'Source must be an HTTP or HTTPS URL without embedded credentials');
  if (!boundedString(value.destination, MAX_DESTINATION) || !safeDestination.test(value.destination)) return failure('invalid-input', 'Destination is invalid');
  if (!parseDate(value.requestedAt)) return failure('invalid-input', 'Requested time is invalid');
  if (value.userInvoked !== true || value.alwaysOnTop !== true) return failure('invalid-input', 'The request must come from an explicit user action');
  return { ok: true, value: {
    schemaVersion: DOWNLOAD_SCHEMA_VERSION,
    captureId: value.captureId,
    fileName: value.fileName,
    sourceUrl: value.sourceUrl,
    destination: value.destination,
    requestedAt: value.requestedAt,
    userInvoked: true,
    alwaysOnTop: true,
  } };
}

export function parseNativeMessage(value: unknown): Result<NativeBridgeMessage> {
  if (!isRecord(value) || value.version !== DOWNLOAD_SCHEMA_VERSION || typeof value.type !== 'string') return failure('invalid-input', 'Native message envelope is invalid');
  if (value.type === 'download.start') {
    const checked = validateDownloadStart(value.request);
    return checked.ok ? { ok: true, value: { type: value.type, version: DOWNLOAD_SCHEMA_VERSION, request: checked.value } } : checked;
  }
  if (value.type === 'download.pause' || value.type === 'download.resume' || value.type === 'download.cancel') {
    if (!boundedString(value.captureId, 96) || !safeCaptureId.test(value.captureId)) return failure('invalid-input', 'Capture id is invalid');
    return { ok: true, value: { type: value.type, version: DOWNLOAD_SCHEMA_VERSION, captureId: value.captureId } };
  }
  return failure('invalid-input', 'Native message type is not allowlisted');
}

function publicRecord(record: DownloadRecord): DownloadPublicRecord {
  const transfer = 'transfer' in record ? record.transfer : undefined;
  return {
    captureId: record.captureId,
    state: record.state,
    fileName: '[redacted]',
    source: '[redacted]',
    destination: '[redacted]',
    bytesReceived: transfer?.bytesReceived.toString() ?? '0',
    bytesTotal: transfer?.bytesTotal?.toString(),
    rateBytesPerSecond: transfer?.rateBytesPerSecond,
    etaSeconds: transfer?.etaSeconds,
    requestedAt: record.requestedAt,
    createdAt: record.createdAt,
    finishedAt: 'finishedAt' in record ? record.finishedAt : undefined,
    errorCode: 'error' in record ? record.error?.code : undefined,
  };
}

export class DownloadStateEngine {
  private readonly records = new Map<string, DownloadRecord>();

  public start(input: unknown, now = new Date()): Result<StartRecord> {
    const checked = validateDownloadStart(input);
    if (!checked.ok) return checked;
    if (this.records.has(checked.value.captureId)) return failure('replay', 'This capture request was already accepted');
    const record: StartRecord = { ...checked.value, state: 'start', createdAt: now.toISOString() };
    this.records.set(record.captureId, record);
    return { ok: true, value: structuredClone(record) };
  }

  public begin(captureId: string, now = new Date(), bytesTotal?: bigint): Result<DownloadingRecord> {
    const record = this.records.get(captureId);
    if (!record || record.state !== 'start') return failure('invalid-transition', 'Only a Start record can begin downloading');
    if (bytesTotal !== undefined && !parseBytes(bytesTotal)) return failure('invalid-input', 'Total bytes exceed the bounded transfer limit');
    const downloading: DownloadingRecord = { ...record, state: 'downloading', paused: false, transfer: { bytesReceived: 0n, bytesTotal, updatedAt: now.toISOString() } };
    this.records.set(captureId, downloading);
    return { ok: true, value: structuredClone(downloading) };
  }

  public progress(captureId: string, bytesReceived: bigint, now = new Date()): Result<DownloadingRecord> {
    const record = this.records.get(captureId);
    if (!record || record.state !== 'downloading' || record.paused) return failure('invalid-transition', 'Progress requires an active download');
    if (!parseBytes(bytesReceived) || bytesReceived < record.transfer.bytesReceived || (record.transfer.bytesTotal !== undefined && bytesReceived > record.transfer.bytesTotal)) return failure('invalid-input', 'Progress is outside the accepted byte range');
    const elapsedSeconds = Math.max((now.getTime() - Date.parse(record.transfer.updatedAt)) / 1_000, 0.001);
    const delta = Number(bytesReceived - record.transfer.bytesReceived);
    const rate = delta / elapsedSeconds;
    const remaining = record.transfer.bytesTotal === undefined ? undefined : Number(record.transfer.bytesTotal - bytesReceived);
    const updated: DownloadingRecord = { ...record, transfer: { ...record.transfer, bytesReceived, rateBytesPerSecond: Number.isFinite(rate) ? Math.round(rate) : undefined, etaSeconds: remaining === undefined || rate <= 0 ? undefined : Math.ceil(remaining / rate), updatedAt: now.toISOString() } };
    this.records.set(captureId, updated);
    return { ok: true, value: structuredClone(updated) };
  }

  public pause(captureId: string): Result<DownloadingRecord> {
    const record = this.records.get(captureId);
    if (!record || record.state !== 'downloading' || record.paused) return failure('invalid-transition', 'Only an active download can be paused');
    const paused = { ...record, paused: true };
    this.records.set(captureId, paused);
    return { ok: true, value: structuredClone(paused) };
  }

  public resume(captureId: string): Result<DownloadingRecord> {
    const record = this.records.get(captureId);
    if (!record || record.state !== 'downloading' || !record.paused) return failure('invalid-transition', 'Only a paused download can be resumed');
    const resumed = { ...record, paused: false };
    this.records.set(captureId, resumed);
    return { ok: true, value: structuredClone(resumed) };
  }

  public complete(captureId: string, now = new Date()): Result<CompleteRecord> {
    const record = this.records.get(captureId);
    if (!record || record.state !== 'downloading' || record.paused) return failure('invalid-transition', 'Only an active download can complete');
    const complete: CompleteRecord = { ...record, state: 'complete', finishedAt: now.toISOString() };
    this.records.set(captureId, complete);
    return { ok: true, value: structuredClone(complete) };
  }

  public cancel(captureId: string, now = new Date()): Result<CompleteRecord> {
    const record = this.records.get(captureId);
    if (!record || (record.state !== 'start' && record.state !== 'downloading')) return failure('invalid-transition', 'Only a queued or active download can be cancelled');
    const transfer = record.state === 'downloading' ? record.transfer : { bytesReceived: 0n, updatedAt: now.toISOString() };
    const cancelled: CompleteRecord = { ...record, state: 'cancelled', transfer, finishedAt: now.toISOString(), error: { code: 'cancelled', message: 'Download cancelled by the user', retryable: false } };
    this.records.set(captureId, cancelled);
    return { ok: true, value: structuredClone(cancelled) };
  }

  public fail(captureId: string, error: DownloadError, now = new Date()): Result<CompleteRecord> {
    const record = this.records.get(captureId);
    if (!record || (record.state !== 'start' && record.state !== 'downloading')) return failure('invalid-transition', 'Only a queued or active download can fail');
    const transfer = record.state === 'downloading' ? record.transfer : { bytesReceived: 0n, updatedAt: now.toISOString() };
    const failed: CompleteRecord = { ...record, state: 'failed', transfer, finishedAt: now.toISOString(), error };
    this.records.set(captureId, failed);
    return { ok: true, value: structuredClone(failed) };
  }

  public get(captureId: string): DownloadRecord | undefined {
    const record = this.records.get(captureId);
    return record ? structuredClone(record) : undefined;
  }

  public listPublic(): readonly DownloadPublicRecord[] {
    return [...this.records.values()].map(publicRecord);
  }
}

export function createNativeStartMessage(request: DownloadStartRequest): Result<NativeBridgeMessage> {
  const checked = validateDownloadStart(request);
  return checked.ok ? { ok: true, value: { type: 'download.start', version: DOWNLOAD_SCHEMA_VERSION, request: checked.value } } : checked;
}
