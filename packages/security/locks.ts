import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type { CredentialVault } from './totp'
import { generateTotpCode, verifyTotpCode } from './totp'

export type NoveltyLockPolicy =
  | 'PIN'
  | 'password'
  | 'PIN plus password'
  | 'password plus TOTP'
  | 'PIN plus TOTP'
  | 'password plus PIN plus TOTP'

export const NOVELTY_LOCK_POLICIES: readonly NoveltyLockPolicy[] = [
  'PIN', 'password', 'PIN plus password', 'password plus TOTP', 'PIN plus TOTP', 'password plus PIN plus TOTP',
]

export type UnlockDuration =
  | { kind: 'this-surface' }
  | { kind: 'until-app-closes' }
  | { kind: 'minutes'; minutes: number }

export interface LockRecord {
  id: string
  targetId: string
  policy: NoveltyLockPolicy
  duration: UnlockDuration
  lockedOnLaunch: boolean
  createdAt: string
  credentialReferences: { pin?: string; password?: string; totp?: string }
}

export interface LockAttempt {
  pin?: string
  password?: string
  totp?: string
  nowMs?: number
}

export interface UnlockResult {
  unlocked: boolean
  expiresAtMs: number | null
  reason: 'accepted' | 'locked' | 'missing-factor' | 'invalid-factor' | 'expired'
}

function requires(policy: NoveltyLockPolicy, factor: 'pin' | 'password' | 'totp'): boolean {
  return policy.toLowerCase().includes(factor)
}

function durationMs(duration: UnlockDuration): number | null {
  if (duration.kind === 'this-surface') return 0
  if (duration.kind === 'until-app-closes') return null
  if (!Number.isInteger(duration.minutes) || duration.minutes < 1 || duration.minutes > 1440) {
    throw new Error('Unlock duration must be from 1 to 1440 minutes')
  }
  return duration.minutes * 60_000
}

export class ToyLockManager {
  private readonly records = new Map<string, LockRecord>()
  private readonly unlockedUntil = new Map<string, number | null>()

  constructor(private readonly vault: CredentialVault) {}

  async createLock(
    targetId: string,
    policy: NoveltyLockPolicy,
    duration: UnlockDuration,
    factors: { pin?: string; password?: string; totpSecret?: Uint8Array },
  ): Promise<LockRecord> {
    if (!targetId.trim()) throw new Error('A lock target is required')
    if (!NOVELTY_LOCK_POLICIES.includes(policy)) throw new Error('Unknown novelty-lock policy')
    for (const factor of ['pin', 'password', 'totp'] as const) {
      if (requires(policy, factor) && !(factor === 'totp' ? factors.totpSecret : factors[factor])) {
        throw new Error(`Missing ${factor} factor for selected policy`)
      }
    }
    durationMs(duration)
    const id = randomUUID()
    const credentialReferences: LockRecord['credentialReferences'] = {}
    if (requires(policy, 'pin')) {
      credentialReferences.pin = `${id}:pin`
      await this.vault.setSecret(credentialReferences.pin, Buffer.from(factors.pin!, 'utf8'))
    }
    if (requires(policy, 'password')) {
      credentialReferences.password = `${id}:password`
      await this.vault.setSecret(credentialReferences.password, hashFactor(factors.password!))
    }
    if (requires(policy, 'totp')) {
      credentialReferences.totp = `${id}:totp`
      await this.vault.setSecret(credentialReferences.totp, factors.totpSecret!)
    }
    const record: LockRecord = {
      id, targetId, policy, duration, lockedOnLaunch: true,
      createdAt: new Date().toISOString(), credentialReferences,
    }
    this.records.set(id, record)
    return structuredClone(record)
  }

  listLocks(): LockRecord[] {
    return [...this.records.values()].map((record) => structuredClone(record))
  }

  isLocked(lockId: string, nowMs = Date.now()): boolean {
    const record = this.records.get(lockId)
    if (!record) return false
    const expiry = this.unlockedUntil.get(lockId)
    if (expiry !== undefined && (expiry === null || expiry > nowMs)) return false
    this.unlockedUntil.delete(lockId)
    return true
  }

  async unlock(lockId: string, attempt: LockAttempt = {}): Promise<UnlockResult> {
    const record = this.records.get(lockId)
    if (!record) return { unlocked: false, expiresAtMs: null, reason: 'locked' }
    const now = attempt.nowMs ?? Date.now()
    if (!this.isLocked(lockId, now)) return { unlocked: true, expiresAtMs: this.unlockedUntil.get(lockId) ?? null, reason: 'accepted' }
    const values = {
      pin: record.credentialReferences.pin ? await this.vault.getSecret(record.credentialReferences.pin) : null,
      password: record.credentialReferences.password ? await this.vault.getSecret(record.credentialReferences.password) : null,
      totp: record.credentialReferences.totp ? await this.vault.getSecret(record.credentialReferences.totp) : null,
    }
    if ((requires(record.policy, 'pin') && !attempt.pin) || (requires(record.policy, 'password') && !attempt.password) || (requires(record.policy, 'totp') && !attempt.totp)) {
      return { unlocked: false, expiresAtMs: null, reason: 'missing-factor' }
    }
    const pinOk = !requires(record.policy, 'pin') || !!values.pin && safeEqual(Buffer.from(attempt.pin!, 'utf8'), Buffer.from(values.pin))
    const passwordOk = !requires(record.policy, 'password') || !!values.password && safeEqual(hashFactor(attempt.password!), Buffer.from(values.password))
    let totpOk = !requires(record.policy, 'totp')
    if (requires(record.policy, 'totp') && values.totp) {
      try { totpOk = verifyTotpCode(Buffer.from(values.totp).toString('utf8'), attempt.totp!, { timestampMs: now }).valid } catch { totpOk = false }
    }
    if (!pinOk || !passwordOk || !totpOk) return { unlocked: false, expiresAtMs: null, reason: 'invalid-factor' }
    const lifetime = durationMs(record.duration)
    const expiresAtMs = lifetime === null ? null : record.duration.kind === 'this-surface' ? null : now + lifetime
    this.unlockedUntil.set(lockId, expiresAtMs)
    return { unlocked: true, expiresAtMs, reason: 'accepted' }
  }

  relock(lockId: string): void {
    this.unlockedUntil.delete(lockId)
  }

  async removeLock(lockId: string): Promise<void> {
    const record = this.records.get(lockId)
    if (!record) return
    await Promise.all(Object.values(record.credentialReferences).filter(Boolean).map((reference) => this.vault.deleteSecret(reference!)))
    this.records.delete(lockId)
    this.unlockedUntil.delete(lockId)
  }
}

function hashFactor(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

export function lockRecordExport(record: LockRecord): Omit<LockRecord, 'credentialReferences'> & { credentialReferences: { present: string[] } } {
  return {
    ...record,
    credentialReferences: { present: Object.keys(record.credentialReferences) },
  }
}

export function otpSecretForTest(secret: string): Uint8Array {
  return Buffer.from(secret, 'utf8')
}
