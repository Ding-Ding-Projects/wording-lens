import { createHmac, timingSafeEqual } from 'node:crypto'

export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'

export interface TotpOptions {
  algorithm?: TotpAlgorithm
  digits?: 6 | 7 | 8
  periodSeconds?: number
  timestampMs?: number
}

export interface TotpVerification {
  valid: boolean
  matchedStep: number | null
  clockSkewSeconds: number | null
  checkedWindow: number
}

const ALGORITHMS: Record<TotpAlgorithm, string> = {
  SHA1: 'sha1',
  SHA256: 'sha256',
  SHA512: 'sha512',
}

function decodeBase32(value: string): Buffer {
  const normalized = value.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z2-7]+=*$/.test(normalized) || normalized.length === 0) {
    throw new Error('TOTP secret must be a non-empty RFC 4648 base32 value')
  }
  const unpadded = normalized.replace(/=+$/, '')
  if (unpadded.length % 8 === 1) throw new Error('TOTP secret has invalid base32 length')
  let bits = ''
  for (const character of unpadded) {
    const index = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character)
    if (index < 0) throw new Error('TOTP secret contains an invalid base32 character')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  }
  if (bytes.length === 0) throw new Error('TOTP secret decodes to no bytes')
  return Buffer.from(bytes)
}

function optionsFor(options: TotpOptions): Required<Omit<TotpOptions, 'timestampMs'>> {
  const algorithm = options.algorithm ?? 'SHA1'
  if (!Object.prototype.hasOwnProperty.call(ALGORITHMS, algorithm)) throw new Error('TOTP algorithm must be SHA1, SHA256, or SHA512')
  const digits = options.digits ?? 6
  const periodSeconds = options.periodSeconds ?? 30
  if (![6, 7, 8].includes(digits)) throw new Error('TOTP digits must be 6, 7, or 8')
  if (!Number.isInteger(periodSeconds) || periodSeconds < 1 || periodSeconds > 86400) {
    throw new Error('TOTP period must be an integer from 1 to 86400 seconds')
  }
  return { algorithm, digits: digits as 6 | 7 | 8, periodSeconds }
}

export function generateTotpCode(secret: string, options: TotpOptions = {}): string {
  const resolved = optionsFor(options)
  const timestampMs = options.timestampMs ?? Date.now()
  if (!Number.isFinite(timestampMs)) throw new Error('TOTP timestamp must be finite')
  const counter = Math.max(0, Math.floor(timestampMs / 1000 / resolved.periodSeconds))
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac(ALGORITHMS[resolved.algorithm], decodeBase32(secret)).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(binary % (10 ** resolved.digits)).padStart(resolved.digits, '0')
}

export function verifyTotpCode(
  secret: string,
  code: string,
  options: TotpOptions & { window?: number } = {},
): TotpVerification {
  const resolved = optionsFor(options)
  const window = options.window ?? 1
  if (!Number.isInteger(window) || window < 0 || window > 10) throw new Error('TOTP window must be an integer from 0 to 10')
  if (!new RegExp(`^\\d{${resolved.digits}}$`).test(code)) {
    return { valid: false, matchedStep: null, clockSkewSeconds: null, checkedWindow: window }
  }
  const now = options.timestampMs ?? Date.now()
  const currentStep = Math.max(0, Math.floor(now / 1000 / resolved.periodSeconds))
  for (let delta = -window; delta <= window; delta += 1) {
    const step = currentStep + delta
    if (step < 0) continue
    const expected = generateTotpCode(secret, { ...resolved, timestampMs: step * resolved.periodSeconds * 1000 })
    const left = Buffer.from(expected)
    const right = Buffer.from(code)
    if (left.length === right.length && timingSafeEqual(left, right)) {
      return { valid: true, matchedStep: step, clockSkewSeconds: delta * resolved.periodSeconds, checkedWindow: window }
    }
  }
  return { valid: false, matchedStep: null, clockSkewSeconds: null, checkedWindow: window }
}

export interface OtpAuthUriOptions {
  issuer: string
  account: string
  secret: string
  algorithm?: TotpAlgorithm
  digits?: 6 | 7 | 8
  periodSeconds?: number
}

export function buildOtpAuthUri(options: OtpAuthUriOptions): string {
  const resolved = optionsFor(options)
  if (!options.issuer.trim() || !options.account.trim()) throw new Error('OTP issuer and account are required')
  decodeBase32(options.secret)
  const label = `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.account)}`
  const params = new URLSearchParams({
    secret: options.secret.replace(/\s+/g, '').toUpperCase(),
    issuer: options.issuer,
    algorithm: resolved.algorithm,
    digits: String(resolved.digits),
    period: String(resolved.periodSeconds),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

export interface QrPayloadGenerator {
  toQrPayload(uri: string): string
}

export interface CredentialVault {
  setSecret(reference: string, secret: Uint8Array): Promise<void>
  getSecret(reference: string): Promise<Uint8Array | null>
  deleteSecret(reference: string): Promise<void>
}

export class MemoryCredentialVault implements CredentialVault {
  private readonly values = new Map<string, Uint8Array>()

  async setSecret(reference: string, secret: Uint8Array): Promise<void> {
    this.values.set(reference, new Uint8Array(secret))
  }

  async getSecret(reference: string): Promise<Uint8Array | null> {
    const value = this.values.get(reference)
    return value ? new Uint8Array(value) : null
  }

  async deleteSecret(reference: string): Promise<void> {
    this.values.delete(reference)
  }
}

export function reportClockSkew(verification: TotpVerification): string {
  if (verification.valid && verification.clockSkewSeconds && verification.clockSkewSeconds !== 0) {
    return `Code accepted with ${Math.abs(verification.clockSkewSeconds)} second clock skew`
  }
  if (!verification.valid) return 'Code rejected; check that the device clocks are aligned'
  return 'Code accepted with clocks aligned'
}
