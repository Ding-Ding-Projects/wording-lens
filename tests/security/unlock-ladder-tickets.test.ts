import { describe, expect, it } from 'vitest'
import { UnlockLadderService } from '../../packages/security/unlock-ladder'
import { LocalSupportTicketStore } from '../../packages/security/support-tickets'

describe('unlock ladder', () => {
  it('uses single-use challenges, does not grant authentication, and honors School mode', () => {
    let now = 1_000
    const ladder = new UnlockLadderService(() => now)
    const issue = ladder.issue('user', 'dish', { schoolMode: true })!
    expect(issue.rung).toBe('sums')
    expect(JSON.stringify(issue.challenge)).not.toContain('answer')
    const answers = issue.challenge.kind === 'sums' ? issue.challenge.questions.map((question) => question.operation === '+' ? question.left + question.right : question.left - question.right) : []
    const result = ladder.answer('user', { nonce: issue.nonce, answer: answers })
    expect(result.accepted).toBe(true)
    expect(result.grantsAuthentication).toBe(false)
    expect(result.sessionCookie).toBeNull()
    expect(ladder.answer('user', { nonce: issue.nonce, answer: answers }).reason).toBe('replayed')
    now += 1
  })

  it('enforces the rolling ladder budget', () => {
    let now = 1_000
    const ladder = new UnlockLadderService(() => now)
    for (let index = 0; index < 3; index += 1) {
      const issue = ladder.issue('user', 'clock', { waitMs: 0 })!
      ladder.answer('user', { nonce: issue.nonce, answer: null })
      now += 1
    }
    expect(ladder.issue('user', 'dish')).toBeNull()
  })

  it('binds a clock nonce to its subject and enforces its retry time', () => {
    let now = 1_000
    const ladder = new UnlockLadderService(() => now)
    const issue = ladder.issue('owner', 'clock', { waitMs: 500 })!
    expect(ladder.answer('other', { nonce: issue.nonce, answer: null }).reason).toBe('invalid')
    expect(ladder.answer('owner', { nonce: issue.nonce, answer: null }).reason).toBe('too-early')
    now += 500
    expect(ladder.answer('owner', { nonce: issue.nonce, answer: 'pretend-game' }).reason).toBe('replayed')
    const afterWait = ladder.issue('owner', 'clock', { waitMs: 0 })!
    expect(ladder.answer('other', { nonce: afterWait.nonce, answer: null }).reason).toBe('invalid')
    expect(ladder.answer('owner', { nonce: afterWait.nonce, answer: null }).accepted).toBe(true)
    const alternate = ladder.issue('owner', 'clock', { waitMs: 0 })!
    expect(ladder.answer('owner', { nonce: alternate.nonce, answer: 'pretend-game' }).reason).toBe('invalid')
  })

  it('escalates after five wrong dishes without spending the skip budget', () => {
    const ladder = new UnlockLadderService(() => 1_000)
    for (let index = 0; index < 5; index += 1) {
      const issue = ladder.issue('user', 'dish')!
      expect(ladder.answer('user', { nonce: issue.nonce, answer: -1 }).nextRung).toBe(index === 4 ? 'sums' : 'dish')
    }
    expect(ladder.issue('user', 'sums')?.rung).toBe('sums')
  })
})

describe('local support tickets', () => {
  it('advances and resolves without a network call', () => {
    const store = new LocalSupportTicketStore()
    const ticket = store.create({ category: 'forgotten-credential', description: 'Need local recovery', severity: 'normal' })
    expect(store.advance(ticket.id).status).toBe('reviewing')
    const resolved = store.resolve(ticket.id, 'C:/Users/local/AppData/WordingLens')
    expect(resolved.ticket.status).toBe('resolved')
    expect(resolved.openedPath).toContain('WordingLens')
    expect(resolved.networkUsed).toBe(false)
  })
})
