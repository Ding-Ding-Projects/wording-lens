import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
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
  | { kind: 'this-surface'; surfaceSessionId: string }
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
  surfaceSessionId?: string
  route?: 'manual' | 'keypad'
}

export interface UnlockResult {
  unlocked: boolean
  expiresAtMs: number | null
  reason: 'accepted' | 'locked' | 'missing-factor' | 'invalid-factor' | 'expired' | 'cooldown'
  cooldownUntilMs?: number
}

interface UnlockState { kind: UnlockDuration['kind']; surfaceSessionId?: string; expiresAtMs: number | null }
interface WrongAttemptState { failures: number; cooldownUntilMs: number }

function requires(policy: NoveltyLockPolicy, factor: 'pin' | 'password' | 'totp'): boolean {
  return policy.toLowerCase().includes(factor)
}

function durationMs(duration: UnlockDuration): number | null {
  if (duration.kind === 'this-surface') {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(duration.surfaceSessionId)) throw new Error('This-surface unlock requires a valid surface session identity')
    return null
  }
  if (duration.kind === 'until-app-closes') return null
  if (!Number.isInteger(duration.minutes) || duration.minutes < 1 || duration.minutes > 1440) {
    throw new Error('Unlock duration must be from 1 to 1440 minutes')
  }
  return duration.minutes * 60_000
}

export class ToyLockManager {
  private readonly records = new Map<string, LockRecord>()
  private readonly unlocked = new Map<string, UnlockState>()
  private readonly wrongAttempts = new Map<string, WrongAttemptState>()
  private readonly closedSurfaceSessions = new Set<string>()
  constructor(private readonly vault: CredentialVault, private readonly attemptOptions: { maxWrongAttempts?: number; cooldownMs?: number } = {}) {
    if (!Number.isInteger(attemptOptions.maxWrongAttempts ?? 5) || (attemptOptions.maxWrongAttempts ?? 5) < 1) throw new Error('Wrong-attempt budget must be a positive integer')
    if (!Number.isInteger(attemptOptions.cooldownMs ?? 30_000) || (attemptOptions.cooldownMs ?? 30_000) < 1) throw new Error('Wrong-attempt cooldown must be a positive integer')
  }

  private get maxWrongAttempts(): number { return this.attemptOptions.maxWrongAttempts ?? 5 }
  private get cooldownMs(): number { return this.attemptOptions.cooldownMs ?? 30_000 }

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
      await this.vault.setSecret(credentialReferences.pin, await deriveFactorVerifier(factors.pin!))
    }
    if (requires(policy, 'password')) {
      credentialReferences.password = `${id}:password`
      await this.vault.setSecret(credentialReferences.password, await deriveFactorVerifier(factors.password!))
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

  isLocked(lockId: string, nowMs = Date.now(), surfaceSessionId?: string): boolean {
    const record = this.records.get(lockId)
    if (!record) return false
    const state = this.unlocked.get(lockId)
    if (!state) return true
    if (state.kind === 'this-surface' && (surfaceSessionId !== state.surfaceSessionId || !state.surfaceSessionId || this.closedSurfaceSessions.has(state.surfaceSessionId))) {
      this.unlocked.delete(lockId)
      return true
    }
    if (state.expiresAtMs === null || state.expiresAtMs > nowMs) return false
    this.unlocked.delete(lockId)
    return true
  }

  async unlock(lockId: string, attempt: LockAttempt = {}): Promise<UnlockResult> {
    const record = this.records.get(lockId)
    if (!record) return { unlocked: false, expiresAtMs: null, reason: 'locked' }
    const now = attempt.nowMs ?? Date.now()
    const currentState = this.unlocked.get(lockId)
    if (currentState && !this.isLocked(lockId, now, attempt.surfaceSessionId)) return { unlocked: true, expiresAtMs: currentState.expiresAtMs, reason: 'accepted' }
    if (record.duration.kind === 'this-surface' && attempt.surfaceSessionId !== record.duration.surfaceSessionId) return { unlocked: false, expiresAtMs: null, reason: 'locked' }
    const budget = this.wrongAttempts.get(lockId)
    if (budget && budget.cooldownUntilMs > now) return { unlocked: false, expiresAtMs: null, reason: 'cooldown', cooldownUntilMs: budget.cooldownUntilMs }
    const values = {
      pin: record.credentialReferences.pin ? await this.vault.getSecret(record.credentialReferences.pin) : null,
      password: record.credentialReferences.password ? await this.vault.getSecret(record.credentialReferences.password) : null,
      totp: record.credentialReferences.totp ? await this.vault.getSecret(record.credentialReferences.totp) : null,
    }
    if ((requires(record.policy, 'pin') && !attempt.pin) || (requires(record.policy, 'password') && !attempt.password) || (requires(record.policy, 'totp') && !attempt.totp)) {
      return { unlocked: false, expiresAtMs: null, reason: 'missing-factor' }
    }
    const pinOk = !requires(record.policy, 'pin') || !!values.pin && await verifyFactor(attempt.pin!, values.pin)
    const passwordOk = !requires(record.policy, 'password') || !!values.password && await verifyFactor(attempt.password!, values.password)
    let totpOk = !requires(record.policy, 'totp')
    if (requires(record.policy, 'totp') && values.totp) {
      try { totpOk = verifyTotpCode(Buffer.from(values.totp).toString('utf8'), attempt.totp!, { timestampMs: now }).valid } catch { totpOk = false }
    }
    if (!pinOk || !passwordOk || !totpOk) {
      const failures = (budget?.failures ?? 0) + 1
      this.wrongAttempts.set(lockId, { failures: failures >= this.maxWrongAttempts ? 0 : failures, cooldownUntilMs: failures >= this.maxWrongAttempts ? now + this.cooldownMs : 0 })
      if (failures >= this.maxWrongAttempts) return { unlocked: false, expiresAtMs: null, reason: 'cooldown', cooldownUntilMs: now + this.cooldownMs }
      return { unlocked: false, expiresAtMs: null, reason: 'invalid-factor' }
    }
    this.wrongAttempts.delete(lockId)
    const lifetime = durationMs(record.duration)
    const expiresAtMs = lifetime === null ? null : now + lifetime
    this.unlocked.set(lockId, { kind: record.duration.kind, surfaceSessionId: record.duration.kind === 'this-surface' ? record.duration.surfaceSessionId : undefined, expiresAtMs })
    return { unlocked: true, expiresAtMs, reason: 'accepted' }
  }

  relock(lockId: string): void {
    this.unlocked.delete(lockId)
  }

  closeSurface(surfaceSessionId: string): void {
    this.closedSurfaceSessions.add(surfaceSessionId)
    for (const [lockId, state] of this.unlocked) if (state.kind === 'this-surface' && state.surfaceSessionId === surfaceSessionId) this.unlocked.delete(lockId)
  }

  closeApp(): void {
    for (const [lockId, state] of this.unlocked) if (state.kind === 'until-app-closes') this.unlocked.delete(lockId)
  }

  async removeLock(lockId: string): Promise<void> {
    const record = this.records.get(lockId)
    if (!record) return
    await Promise.all(Object.values(record.credentialReferences).filter(Boolean).map((reference) => this.vault.deleteSecret(reference!)))
    this.records.delete(lockId)
    this.unlocked.delete(lockId)
    this.wrongAttempts.delete(lockId)
  }
}

const VERIFIER_VERSION = 1
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }

function scryptAsync(value: string, salt: Uint8Array, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(value, salt, length, SCRYPT_OPTIONS, (error, derived) => error ? reject(error) : resolve(derived as Buffer)))
}

async function deriveFactorVerifier(value: string): Promise<Uint8Array> {
  if (!value || value.length > 512) throw new Error('Factor value must contain 1 to 512 characters')
  const salt = randomBytes(16)
  const derived = await scryptAsync(value, salt, 32)
  return Buffer.from(JSON.stringify({ version: VERIFIER_VERSION, algorithm: 'scrypt', salt: salt.toString('base64'), verifier: derived.toString('base64') }), 'utf8')
}

async function verifyFactor(value: string, encoded: Uint8Array): Promise<boolean> {
  try {
    const record = JSON.parse(Buffer.from(encoded).toString('utf8')) as { version?: number; algorithm?: string; salt?: string; verifier?: string }
    if (record.version !== VERIFIER_VERSION || record.algorithm !== 'scrypt' || !record.salt || !record.verifier) return false
    const expected = Buffer.from(record.verifier, 'base64')
    const actual = await scryptAsync(value, Buffer.from(record.salt, 'base64'), expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch { return false }
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
