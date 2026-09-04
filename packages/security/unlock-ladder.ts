import { randomInt, randomUUID } from 'node:crypto'

export type LadderRung = 'dish' | 'sums' | 'moles' | 'clock'

export interface DishChallenge { kind: 'dish'; choices: string[] }
export interface SumsChallenge { kind: 'sums'; questions: { left: number; right: number; operation: '+' | '-' }[] }
export interface MoleChallenge { kind: 'moles'; durationMs: number; moles: { id: string; cell: number; appearsAtMs: number; disappearsAtMs: number }[]; requiredHits: number }
export interface ClockChallenge { kind: 'clock'; retryAtMs: number }

export type LadderChallenge = DishChallenge | SumsChallenge | MoleChallenge | ClockChallenge

export interface LadderIssue {
  nonce: string
  rung: LadderRung
  challenge: LadderChallenge
  issuedAtMs: number
  expiresAtMs: number
}

export interface LadderAnswer {
  nonce: string
  answer: unknown
  submittedAtMs?: number
}

export interface LadderResult {
  accepted: boolean
  clearedWait: boolean
  grantsAuthentication: false
  sessionCookie: null
  nextRung: LadderRung | null
  reason: 'correct' | 'wrong' | 'expired' | 'replayed' | 'too-early' | 'budget-exhausted' | 'invalid'
}

type InternalChallenge =
  | (DishChallenge & { correctIndex: number })
  | (SumsChallenge & { answers: number[] })
  | MoleChallenge
  | ClockChallenge

interface StoredChallenge { nonce: string; rung: LadderRung; challenge: InternalChallenge; issuedAtMs: number; expiresAtMs: number; used: boolean }

const HOUR_MS = 60 * 60 * 1000

export class UnlockLadderService {
  private readonly challenges = new Map<string, StoredChallenge>()
  private readonly attemptsBySubject = new Map<string, number[]>()
  private readonly dishFailures = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now, private readonly maxSkipsPerHour = 3) {
    if (!Number.isInteger(maxSkipsPerHour) || maxSkipsPerHour < 1) throw new Error('Ladder budget must be a positive integer')
  }

  issue(subjectId: string, rung: LadderRung, options: { schoolMode?: boolean; waitMs?: number } = {}): LadderIssue | null {
    const now = this.now()
    const attempts = this.attemptsBySubject.get(subjectId) ?? []
    const recent = attempts.filter((value) => value > now - HOUR_MS)
    this.attemptsBySubject.set(subjectId, recent)
    if (recent.length >= this.maxSkipsPerHour) return null
    const actualRung = options.schoolMode && rung === 'dish' ? 'sums' : rung
    const challenge = this.createChallenge(actualRung, now, options.waitMs ?? 60_000)
    const issued: StoredChallenge = { nonce: randomUUID(), rung: actualRung, challenge, issuedAtMs: now, expiresAtMs: now + 5 * 60_000, used: false }
    this.challenges.set(issued.nonce, issued)
    return this.publicIssue(issued)
  }

  answer(subjectId: string, answer: LadderAnswer): LadderResult {
    const current = this.now()
    const challenge = this.challenges.get(answer.nonce)
    if (!challenge) return this.result('invalid')
    if (challenge.used) return this.result('replayed')
    challenge.used = true
    if (current > challenge.expiresAtMs) return this.result('expired')
    if (challenge.challenge.kind === 'moles' && current < challenge.issuedAtMs + challenge.challenge.durationMs) return this.result('too-early')
    const correct = this.grade(challenge.challenge, answer.answer, current)
    if (correct) {
      const attempts = this.attemptsBySubject.get(subjectId) ?? []
      attempts.push(current)
      this.attemptsBySubject.set(subjectId, attempts.filter((value) => value > current - HOUR_MS))
      return { accepted: true, clearedWait: true, grantsAuthentication: false, sessionCookie: null, nextRung: null, reason: 'correct' }
    }
    const failures = challenge.rung === 'dish' ? (this.dishFailures.get(subjectId) ?? 0) + 1 : 0
    if (challenge.rung === 'dish') this.dishFailures.set(subjectId, failures)
    const nextRung = challenge.rung === 'dish' ? (failures >= 5 ? 'sums' : 'dish') : challenge.rung === 'sums' ? 'moles' : 'clock'
    return { accepted: false, clearedWait: false, grantsAuthentication: false, sessionCookie: null, nextRung, reason: 'wrong' }
  }

  private createChallenge(rung: LadderRung, now: number, waitMs: number): InternalChallenge {
    if (rung === 'dish') {
      const choices = ['dish-a', 'dish-b', 'dish-c', 'dish-d']
      return { kind: 'dish', choices, correctIndex: randomInt(0, choices.length) }
    }
    if (rung === 'sums') {
      const privateQuestions = Array.from({ length: 10 }, () => {
        const left = randomInt(1, 100)
        const right = randomInt(1, 100)
        const operation: '+' | '-' = randomInt(0, 2) === 0 ? '+' : '-'
        return { left, right, operation, answer: operation === '+' ? left + right : left - right }
      })
      return { kind: 'sums', questions: privateQuestions.map(({ left, right, operation }) => ({ left, right, operation })), answers: privateQuestions.map(({ answer }) => answer) }
    }
    if (rung === 'moles') {
      const durationMs = 5_000
      const moles = Array.from({ length: 8 }, (_, index) => ({ id: `mole-${index}`, cell: index, appearsAtMs: now + index * 500, disappearsAtMs: now + index * 500 + 600 }))
      return { kind: 'moles', durationMs, moles, requiredHits: 5 }
    }
    return { kind: 'clock', retryAtMs: now + Math.max(0, waitMs) }
  }

  private grade(challenge: InternalChallenge, answer: unknown, now: number): boolean {
    if (challenge.kind === 'dish') return typeof answer === 'number' && answer === challenge.correctIndex
    if (challenge.kind === 'sums') return Array.isArray(answer) && answer.length === challenge.answers.length && answer.every((value, index) => typeof value === 'number' && value === challenge.answers[index])
    if (challenge.kind === 'moles') {
      if (!Array.isArray(answer)) return false
      const hits = new Set<string>()
      for (const value of answer) {
        if (!value || typeof value !== 'object') continue
        const id = (value as { id?: unknown }).id
        const atMs = (value as { atMs?: unknown }).atMs
        const mole = challenge.moles.find((entry) => entry.id === id)
        if (mole && typeof atMs === 'number' && atMs >= mole.appearsAtMs && atMs <= mole.disappearsAtMs) hits.add(mole.id)
      }
      return hits.size >= challenge.requiredHits
    }
    return now >= challenge.retryAtMs
  }

  private publicIssue(issue: StoredChallenge): LadderIssue {
    const challenge = issue.challenge.kind === 'dish'
      ? { kind: 'dish' as const, choices: issue.challenge.choices }
      : issue.challenge.kind === 'sums'
        ? { kind: 'sums' as const, questions: issue.challenge.questions }
        : issue.challenge
    return structuredClone({ nonce: issue.nonce, rung: issue.rung, challenge, issuedAtMs: issue.issuedAtMs, expiresAtMs: issue.expiresAtMs })
  }

  private result(reason: LadderResult['reason']): LadderResult {
    return { accepted: false, clearedWait: false, grantsAuthentication: false, sessionCookie: null, nextRung: null, reason }
  }
}
