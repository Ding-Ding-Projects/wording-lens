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
      const lock = await manager.createLock(`target-${policy}`, policy, { kind: 'this-surface', surfaceSessionId: 'surface-a' }, { pin: '1234', password: 'local-only', totpSecret: otpSecretForTest(secret) })
      const result = await manager.unlock(lock.id, { pin: '1234', password: 'local-only', totp: generateTotpCode(secret, { timestampMs }), nowMs: timestampMs, surfaceSessionId: 'surface-a' })
      expect(result.unlocked).toBe(true)
      expect(manager.isLocked(lock.id, timestampMs + 60_000, 'surface-a')).toBe(false)
      expect(manager.isLocked(lock.id, timestampMs + 60_000, 'surface-b')).toBe(true)
      manager.relock(lock.id)
      expect(manager.isLocked(lock.id, timestampMs + 60_000, 'surface-a')).toBe(true)
      await manager.removeLock(lock.id)
    }
  })

  it('uses independent salted scrypt verifiers and a shared wrong-attempt cooldown', async () => {
    const vault = new MemoryCredentialVault()
    const manager = new ToyLockManager(vault, { maxWrongAttempts: 2, cooldownMs: 1_000 })
    const first = await manager.createLock('one', 'password', { kind: 'until-app-closes' }, { password: 'same-value' })
    const second = await manager.createLock('two', 'password', { kind: 'until-app-closes' }, { password: 'same-value' })
    const firstVerifier = JSON.parse(new TextDecoder().decode(await vault.getSecret(first.credentialReferences.password!))) as { version: number; algorithm: string; salt: string; verifier: string }
    const secondVerifier = JSON.parse(new TextDecoder().decode(await vault.getSecret(second.credentialReferences.password!))) as { version: number; algorithm: string; salt: string; verifier: string }
    expect(firstVerifier.version).toBe(1)
    expect(firstVerifier.algorithm).toBe('scrypt')
    expect(firstVerifier.salt).not.toBe(secondVerifier.salt)
    expect(firstVerifier.verifier).not.toBe(secondVerifier.verifier)
    expect(firstVerifier.verifier).not.toContain('same-value')
    const pinFirst = await manager.createLock('pin-one', 'PIN', { kind: 'until-app-closes' }, { pin: '1234' })
    const pinSecond = await manager.createLock('pin-two', 'PIN', { kind: 'until-app-closes' }, { pin: '1234' })
    const pinVerifier = JSON.parse(new TextDecoder().decode(await vault.getSecret(pinFirst.credentialReferences.pin!))) as { version: number; algorithm: string; salt: string; verifier: string }
    const pinVerifierTwo = JSON.parse(new TextDecoder().decode(await vault.getSecret(pinSecond.credentialReferences.pin!))) as { salt: string; verifier: string }
    expect(pinVerifier.algorithm).toBe('scrypt')
    expect(pinVerifier.salt).not.toBe(pinVerifierTwo.salt)
    expect(pinVerifier.verifier).not.toBe(pinVerifierTwo.verifier)
    expect((await manager.unlock(first.id, { password: 'wrong', route: 'manual', nowMs: 1_000 })).reason).toBe('invalid-factor')
    const cooldown = await manager.unlock(first.id, { password: 'wrong', route: 'keypad', nowMs: 1_000 })
    expect(cooldown.reason).toBe('cooldown')
    expect((await manager.unlock(first.id, { password: 'same-value', nowMs: 1_500 })).reason).toBe('cooldown')
    expect((await manager.unlock(first.id, { password: 'same-value', nowMs: 2_001 })).unlocked).toBe(true)
    await manager.removeLock(first.id); await manager.removeLock(second.id); await manager.removeLock(pinFirst.id); await manager.removeLock(pinSecond.id)
  })

  it('expires surface sessions separately from app lifetime', async () => {
    const manager = new ToyLockManager(new MemoryCredentialVault())
    const surface = await manager.createLock('surface', 'PIN', { kind: 'this-surface', surfaceSessionId: 's1' }, { pin: '2468' })
    expect((await manager.unlock(surface.id, { pin: '2468', surfaceSessionId: 's1' })).unlocked).toBe(true)
    manager.closeSurface('s1')
    expect(manager.isLocked(surface.id, Date.now(), 's1')).toBe(true)
    const app = await manager.createLock('app', 'PIN', { kind: 'until-app-closes' }, { pin: '2468' })
    expect((await manager.unlock(app.id, { pin: '2468' })).unlocked).toBe(true)
    manager.closeSurface('other')
    expect(manager.isLocked(app.id)).toBe(false)
    manager.closeApp()
    expect(manager.isLocked(app.id)).toBe(true)
  })
})
