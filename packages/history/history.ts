import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type HistoryAction = 'created' | 'updated' | 'deleted' | 'restored' | 'undone' | 'imported' | 'settings-changed'

export interface EncryptedSnapshot {
  algorithm: 'aes-256-gcm'
  nonce: string
  ciphertext: string
  authTag: string
  aad: string
}

export interface HistoryRevision {
  revisionId: string
  stableRecordId: string
  action: HistoryAction
  label: string
  createdAt: string
  snapshot?: EncryptedSnapshot
}

export interface HistoryBackend {
  append(revision: HistoryRevision): Promise<void>
  list(): Promise<HistoryRevision[]>
}

export type HistoryRecordResult =
  | { historyRecorded: true; revision: HistoryRevision }
  | { historyRecorded: false; recoveryReason: 'history-unavailable' }

export interface GitExecutor {
  run(args: readonly string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }>
}

export function stableHistoryAad(stableRecordId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(stableRecordId)) throw new Error('Stable record identity is invalid')
  return `wording-lens-history:v1:${stableRecordId}`
}

export function encryptSnapshot(snapshot: Uint8Array, key: Uint8Array, stableRecordId: string): EncryptedSnapshot {
  if (key.length !== 32) throw new Error('History encryption key must be 32 bytes')
  const nonce = randomBytes(12)
  const aad = stableHistoryAad(stableRecordId)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(snapshot), cipher.final()])
  return { algorithm: 'aes-256-gcm', nonce: nonce.toString('base64'), ciphertext: ciphertext.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), aad }
}

export function decryptSnapshot(encrypted: EncryptedSnapshot, key: Uint8Array, stableRecordId: string): Uint8Array {
  if (key.length !== 32) throw new Error('History encryption key must be 32 bytes')
  const aad = stableHistoryAad(stableRecordId)
  if (encrypted.aad !== aad || encrypted.algorithm !== 'aes-256-gcm') throw new Error('History snapshot identity or algorithm mismatch')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.nonce, 'base64'))
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()])
}

export class MemoryHistoryBackend implements HistoryBackend {
  private readonly revisions: HistoryRevision[] = []

  async append(revision: HistoryRevision): Promise<void> {
    if (this.revisions.some((item) => item.revisionId === revision.revisionId)) throw new Error('Duplicate history revision')
    this.revisions.push(structuredClone(revision))
  }

  async list(): Promise<HistoryRevision[]> {
    return structuredClone(this.revisions)
  }
}

export class GitHistoryBackend implements HistoryBackend {
  constructor(private readonly git: GitExecutor, private readonly directory: string) {}

  async append(revision: HistoryRevision): Promise<void> {
    const metadata = JSON.stringify({
      revisionId: revision.revisionId, stableRecordId: revision.stableRecordId,
      action: revision.action, label: revision.label, createdAt: revision.createdAt,
      snapshot: revision.snapshot ? { ...revision.snapshot } : undefined,
    })
    const add = await this.git.run(['add', '--all'], this.directory)
    if (add.exitCode !== 0) throw new Error(`History staging failed: ${add.stderr}`)
    const commit = await this.git.run(['commit', '--no-verify', '-m', `history: ${revision.action}: ${revision.label}\n\n${metadata}`], this.directory)
    if (commit.exitCode !== 0) throw new Error(`History commit failed: ${commit.stderr}`)
  }

  async list(): Promise<HistoryRevision[]> {
    const result = await this.git.run(['log', '--format=%B%x00'], this.directory)
    if (result.exitCode !== 0) throw new Error(`History read failed: ${result.stderr}`)
    return result.stdout.split('\0').filter(Boolean).map((entry) => {
      const marker = entry.indexOf('{')
      if (marker < 0) throw new Error('History revision metadata is malformed')
      return JSON.parse(entry.slice(marker)) as HistoryRevision
    })
  }
}

export class AppendOnlyHistory {
  constructor(private readonly backend: HistoryBackend, private readonly key: Uint8Array) {
    if (key.length !== 32) throw new Error('History encryption key must be 32 bytes')
  }

  async record(input: { revisionId: string; stableRecordId: string; action: HistoryAction; label: string; snapshot?: Uint8Array }): Promise<HistoryRevision> {
    if (!input.label.trim() || input.label.length > 500) throw new Error('History label must contain 1 to 500 characters')
    const revision: HistoryRevision = {
      revisionId: input.revisionId, stableRecordId: input.stableRecordId, action: input.action,
      label: input.label, createdAt: new Date().toISOString(),
      snapshot: input.snapshot ? encryptSnapshot(input.snapshot, this.key, input.stableRecordId) : undefined,
    }
    await this.backend.append(revision)
    return structuredClone(revision)
  }

  async tryRecord(input: { revisionId: string; stableRecordId: string; action: HistoryAction; label: string; snapshot?: Uint8Array }): Promise<HistoryRecordResult> {
    try {
      return { historyRecorded: true, revision: await this.record(input) }
    } catch {
      return { historyRecorded: false, recoveryReason: 'history-unavailable' }
    }
  }

  async restoreAsNewRevision(revision: HistoryRevision, newRevisionId: string): Promise<HistoryRevision> {
    const snapshot = revision.snapshot ? decryptSnapshot(revision.snapshot, this.key, revision.stableRecordId) : undefined
    return this.record({ revisionId: newRevisionId, stableRecordId: revision.stableRecordId, action: 'restored', label: `Restored revision ${revision.revisionId}`, snapshot })
  }

  async exportRedacted(): Promise<{ schemaVersion: 1; privateSnapshotsOmitted: true; revisions: Omit<HistoryRevision, 'snapshot'>[] }> {
    const revisions = await this.backend.list()
    return { schemaVersion: 1, privateSnapshotsOmitted: true, revisions: revisions.map(({ snapshot: _snapshot, ...rest }) => rest) }
  }
}
