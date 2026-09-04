export type LanguageMode = 'english' | 'cantonese' | 'bilingual'
export type ThemeMode = 'light' | 'dark'
export type ScheduleSource =
  | { kind: 'local' }
  | { kind: 'api'; url: string }
  | { kind: 'home-assistant'; baseUrl: string; entityId: string }

export interface ScheduledValues {
  languageMode?: LanguageMode
  theme?: ThemeMode
  density?: 'comfortable' | 'compact' | 'spacious'
  accent?: string
  fontFamily?: string
  motion?: 'full' | 'reduced'
}

export interface ScheduleRule {
  id: string
  label: string
  enabled: boolean
  priority: number
  startDate?: string
  endDate?: string
  startTime: string
  endTime: string
  weekdays: 'every-day' | number[]
  source: ScheduleSource
  values: ScheduledValues
  updatedAt: string
}

export interface ScheduleSchema {
  schemaVersion: 1
  timezone: string
  rules: ScheduleRule[]
}

export interface ValidatedExternalValues {
  version: 1
  values: ScheduledValues
  fetchedAt: string
}

const VALUE_KEYS = new Set(['languageMode', 'theme', 'density', 'accent', 'fontFamily', 'motion'])
const TZ_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function formatter(timezone: string): Intl.DateTimeFormat {
  let value = TZ_FORMATTER_CACHE.get(timezone)
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    TZ_FORMATTER_CACHE.set(timezone, value)
  }
  return value
}

function partsAt(date: Date, timezone: string): { date: string; minutes: number; weekday: number } {
  const parts = formatter(timezone).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  const isoDate = `${values.year}-${values.month}-${values.day}`
  const minutes = Number(values.hour) * 60 + Number(values.minute)
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return { date: isoDate, minutes, weekday }
}

function parseTime(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Schedule time must use HH:mm')
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function validateDate(value: string | undefined, name: string): void {
  if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD`)
  if (value !== undefined) {
    const parsed = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${name} is not a real date`)
  }
}

function validateSource(source: ScheduleSource): void {
  if (!source || !['local', 'api', 'home-assistant'].includes(source.kind)) throw new Error('Schedule source kind is unsupported')
  if (source.kind === 'api' || source.kind === 'home-assistant') {
    let url: URL
    try { url = new URL(source.kind === 'api' ? source.url : source.baseUrl) } catch { throw new Error('Schedule source URL is invalid') }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || (url.protocol !== 'https:' && !loopback)) throw new Error('Schedule source must use HTTPS without embedded credentials')
    if (url.port && !['443', '80'].includes(url.port)) throw new Error('Schedule source uses an unsafe port')
    if (source.kind === 'home-assistant' && !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(source.entityId)) throw new Error('Home Assistant entity identifier is invalid')
  }
}

function validateValues(values: ScheduledValues): void {
  for (const key of Object.keys(values)) if (!VALUE_KEYS.has(key)) throw new Error(`Unknown scheduled setting: ${key}`)
  if (values.accent !== undefined && !/^#[0-9a-fA-F]{6,8}$/.test(values.accent)) throw new Error('Scheduled accent must be a HEX color')
  if (values.languageMode !== undefined && !['english', 'cantonese', 'bilingual'].includes(values.languageMode)) throw new Error('Scheduled language mode is invalid')
  if (values.theme !== undefined && !['light', 'dark'].includes(values.theme)) throw new Error('Scheduled theme is invalid')
  if (values.density !== undefined && !['comfortable', 'compact', 'spacious'].includes(values.density)) throw new Error('Scheduled density is invalid')
  if (values.motion !== undefined && !['full', 'reduced'].includes(values.motion)) throw new Error('Scheduled motion value is invalid')
  for (const key of ['fontFamily'] as const) if (values[key] !== undefined && (typeof values[key] !== 'string' || !values[key].trim() || values[key].length > 200)) throw new Error('Scheduled font family is invalid')
}

export function validateSchedule(input: unknown): ScheduleSchema {
  if (!input || typeof input !== 'object') throw new Error('Schedule must be an object')
  const candidate = input as Partial<ScheduleSchema>
  if (candidate.schemaVersion !== 1 || typeof candidate.timezone !== 'string' || !Array.isArray(candidate.rules)) throw new Error('Schedule schema version is unsupported')
  try { new Intl.DateTimeFormat('en-CA', { timeZone: candidate.timezone }) } catch { throw new Error('Schedule timezone is invalid') }
  if (candidate.rules.length > 1000) throw new Error('Schedule contains too many rules')
  const rules = candidate.rules.map((rule) => {
    if (!rule || typeof rule !== 'object') throw new Error('Schedule rule is invalid')
    const value = rule as ScheduleRule
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.id) || !value.label || value.label.length > 200) throw new Error('Schedule rule identity or label is invalid')
    if (typeof value.enabled !== 'boolean' || !Number.isInteger(value.priority) || value.priority < -1000 || value.priority > 1000) throw new Error('Schedule rule enabled or priority value is invalid')
    parseTime(value.startTime); parseTime(value.endTime)
    validateDate(value.startDate, 'Schedule startDate'); validateDate(value.endDate, 'Schedule endDate')
    if (value.startDate && value.endDate && value.startDate > value.endDate) throw new Error('Schedule date range is reversed')
    if (value.weekdays !== 'every-day' && (!Array.isArray(value.weekdays) || value.weekdays.length === 0 || value.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error('Schedule weekdays must be every-day or weekday numbers 0 to 6')
    if (!value.source || !value.values || typeof value.updatedAt !== 'string') throw new Error('Schedule rule is missing source or values')
    validateSource(value.source); validateValues(value.values)
    if (Number.isNaN(Date.parse(value.updatedAt))) throw new Error('Schedule rule updatedAt is invalid')
    return structuredClone(value)
  })
  const ids = new Set<string>()
  for (const rule of rules) if (ids.has(rule.id)) throw new Error('Schedule rule identifiers must be unique'); else ids.add(rule.id)
  return { schemaVersion: 1, timezone: candidate.timezone, rules }
}

export function matchesScheduleRule(rule: ScheduleRule, instant: Date, timezone: string): boolean {
  if (!rule.enabled) return false
  const current = partsAt(instant, timezone)
  if (rule.startDate && current.date < rule.startDate) return false
  if (rule.endDate && current.date > rule.endDate) return false
  if (rule.weekdays !== 'every-day' && !rule.weekdays.includes(current.weekday)) return false
  const start = parseTime(rule.startTime)
  const end = parseTime(rule.endTime)
  if (start === end) return false
  return start < end ? current.minutes >= start && current.minutes < end : current.minutes >= start || current.minutes < end
}

export function resolveScheduledValues(base: ScheduledValues, schedule: ScheduleSchema, instant: Date): { values: ScheduledValues; matchedRuleIds: string[] } {
  const matches = schedule.rules.filter((rule) => matchesScheduleRule(rule, instant, schedule.timezone)).sort((left, right) => right.priority - left.priority || right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
  return { values: matches.reduce((current, rule) => ({ ...current, ...rule.values }), { ...base }), matchedRuleIds: matches.map((rule) => rule.id) }
}

export function validateExternalValues(payload: unknown): ValidatedExternalValues {
  if (!payload || typeof payload !== 'object') throw new Error('External schedule response is invalid')
  const candidate = payload as { version?: unknown; values?: unknown }
  if (candidate.version !== 1 || !candidate.values || typeof candidate.values !== 'object' || Array.isArray(candidate.values)) throw new Error('External schedule response version is unsupported')
  validateValues(candidate.values as ScheduledValues)
  return { version: 1, values: structuredClone(candidate.values as ScheduledValues), fetchedAt: new Date().toISOString() }
}

export function validateHomeAssistantState(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || (payload as { state?: unknown }).state === undefined) throw new Error('Home Assistant response is invalid')
  const state = (payload as { state: unknown }).state
  if (state !== 'on' && state !== 'off') throw new Error('Home Assistant entity state must be on or off')
  return state === 'on'
}
