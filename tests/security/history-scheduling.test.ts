import { describe, expect, it } from 'vitest'
import { AppendOnlyHistory, MemoryHistoryBackend, decryptSnapshot, encryptSnapshot, stableHistoryAad } from '../../packages/history/history'
import { matchesScheduleRule, resolveScheduledValues, validateExternalValues, validateHomeAssistantState, validateSchedule } from '../../packages/scheduling/schedule'

describe('append-only history', () => {
  it('binds encryption to stable identity and restores as a new revision', async () => {
    const key = new Uint8Array(32).fill(7)
    const encrypted = encryptSnapshot(new TextEncoder().encode('redacted state'), key, 'account:stable')
    expect(stableHistoryAad('account:stable')).toContain('account:stable')
    expect(new TextDecoder().decode(decryptSnapshot(encrypted, key, 'account:stable'))).toBe('redacted state')
    expect(() => decryptSnapshot(encrypted, key, 'account:other')).toThrow()
    const backend = new MemoryHistoryBackend()
    const history = new AppendOnlyHistory(backend, key)
    const first = await history.record({ revisionId: 'r1', stableRecordId: 'account:stable', action: 'updated', label: 'Changed local setting', snapshot: new TextEncoder().encode('state') })
    await history.restoreAsNewRevision(first, 'r2')
    expect((await backend.list()).map((item) => item.action)).toEqual(['updated', 'restored'])
    expect((await history.exportRedacted()).revisions[0]).not.toHaveProperty('snapshot')
  })
})

describe('scheduled settings', () => {
  const rule = { id: 'dark-evening', label: 'Evening', enabled: true, priority: 1, startTime: '18:00', endTime: '23:00', weekdays: 'every-day' as const, source: { kind: 'local' as const }, values: { theme: 'dark' as const }, updatedAt: '2026-09-04T00:00:00.000Z' }

  it('handles local precedence and cross-midnight windows', () => {
    const schedule = validateSchedule({ schemaVersion: 1, timezone: 'America/Toronto', rules: [rule] })
    const resolved = resolveScheduledValues({ theme: 'light' }, schedule, new Date('2026-09-04T22:59:00-04:00'))
    expect(resolved.values.theme).toBe('dark')
    const overnight = { ...rule, id: 'overnight', startTime: '23:00', endTime: '02:00' }
    expect(matchesScheduleRule(overnight, new Date('2026-09-05T01:00:00-04:00'), 'America/Toronto')).toBe(true)
    expect(matchesScheduleRule({ ...rule, startTime: '10:00', endTime: '10:00' }, new Date('2026-09-04T10:00:00-04:00'), 'America/Toronto')).toBe(false)
  })

  it('validates external and Home Assistant responses', () => {
    expect(validateExternalValues({ version: 1, values: { languageMode: 'bilingual' } }).values.languageMode).toBe('bilingual')
    expect(validateHomeAssistantState({ state: 'on' })).toBe(true)
    expect(validateHomeAssistantState({ state: 'off' })).toBe(false)
    expect(() => validateExternalValues({ version: 1, values: { unknown: true } })).toThrow()
    expect(() => validateHomeAssistantState({ state: 'unknown' })).toThrow()
  })
})
