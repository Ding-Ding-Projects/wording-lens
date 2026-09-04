import { describe, expect, it } from 'vitest'
import { buildOtpAuthUri, generateTotpCode, MemoryCredentialVault, reportClockSkew, verifyTotpCode } from '../../packages/security/totp'
import { NOVELTY_LOCK_POLICIES, ToyLockManager, otpSecretForTest } from '../../packages/security/locks'

describe('local TOTP and novelty locks', () => {
  it('matches the RFC 6238 SHA-1 vector', () => {
    const secret = 'gezdgnbvgy3tqojqgezdgnbvgy3tqojq'
    const code = generateTotpCode(secret, { timestampMs: 59_000 })
    expect(code).toBe('287082')
    expect(verifyTotpCode(secret, code, { timestampMs: 59_000, window: 0 }).valid).toBe(true)
  })

  it('reports bounded skew and generates a local pairing payload', () => {
    const secret = 'jbswy3dpehpk3pxp'
    const code = generateTotpCode(secret, { timestampMs: 90_000 })
    const verification = verifyTotpCode(secret, code, { timestampMs: 60_000, window: 1 })
    expect(verification.valid).toBe(true)
    expect(reportClockSkew(verification)).toContain('30 second clock skew')
    expect(buildOtpAuthUri({ issuer: 'Wording Lens', account: 'local', secret })).toMatch(/^otpauth:\/\/totp\//)
  })

  it('supports all six policies without exporting credentials', async () => {
    expect(NOVELTY_LOCK_POLICIES).toHaveLength(6)
    const vault = new MemoryCredentialVault()
    const manager = new ToyLockManager(vault)
    const lock = await manager.createLock('tab-1', 'password plus PIN plus TOTP', { kind: 'minutes', minutes: 5 }, { pin: '1234', password: 'local-only', totpSecret: otpSecretForTest('jbswy3dpehpk3pxp') })
    const code = generateTotpCode('jbswy3dpehpk3pxp')
    const result = await manager.unlock(lock.id, { pin: '1234', password: 'local-only', totp: code })
    expect(result.unlocked).toBe(true)
    expect(JSON.stringify(lock)).not.toContain('local-only')
    expect(JSON.stringify(lock)).not.toContain('1234')
  })

  it('unlocks each policy and keeps this-surface unlock active until relock', async () => {
    const vault = new MemoryCredentialVault()
    const manager = new ToyLockManager(vault)
    const timestampMs = 1_800_000_000_000
    const secret = 'jbswy3dpehpk3pxp'
    for (const policy of NOVELTY_LOCK_POLICIES) {
      const lock = await manager.createLock(`target-${policy}`, policy, { kind: 'this-surface' }, { pin: '1234', password: 'local-only', totpSecret: otpSecretForTest(secret) })
      const result = await manager.unlock(lock.id, { pin: '1234', password: 'local-only', totp: generateTotpCode(secret, { timestampMs }) , nowMs: timestampMs })
      expect(result.unlocked).toBe(true)
      expect(manager.isLocked(lock.id, timestampMs + 60_000)).toBe(false)
      manager.relock(lock.id)
      expect(manager.isLocked(lock.id, timestampMs + 60_000)).toBe(true)
      await manager.removeLock(lock.id)
    }
  })
})
