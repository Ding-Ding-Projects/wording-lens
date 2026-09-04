import { randomUUID } from 'node:crypto'

export type TicketCategory = 'forgotten-credential' | 'lock-recovery' | 'other'
export type TicketStatus = 'received' | 'reviewing' | 'resolved'
export type TicketSeverity = 'low' | 'normal' | 'high'

export interface SupportTicket {
  id: string
  number: string
  category: TicketCategory
  description: string
  severity: TicketSeverity
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

export interface SupportTicketStore {
  list(): SupportTicket[]
  create(input: Pick<SupportTicket, 'category' | 'description' | 'severity'>): SupportTicket
  advance(id: string): SupportTicket
  resolve(id: string, applicationDataPath: string): { ticket: SupportTicket; openedPath: string; networkUsed: false }
}

function nextStatus(status: TicketStatus): TicketStatus {
  return status === 'received' ? 'reviewing' : status === 'reviewing' ? 'resolved' : 'resolved'
}

export class LocalSupportTicketStore implements SupportTicketStore {
  private readonly tickets = new Map<string, SupportTicket>()

  list(): SupportTicket[] {
    return [...this.tickets.values()].map((ticket) => structuredClone(ticket))
  }

  create(input: Pick<SupportTicket, 'category' | 'description' | 'severity'>): SupportTicket {
    if (!input.description.trim() || input.description.length > 10_000) throw new Error('Ticket description must contain 1 to 10000 characters')
    const now = new Date().toISOString()
    const ticket: SupportTicket = {
      id: randomUUID(), number: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
      category: input.category, description: input.description, severity: input.severity,
      status: 'received', createdAt: now, updatedAt: now,
    }
    this.tickets.set(ticket.id, ticket)
    return structuredClone(ticket)
  }

  advance(id: string): SupportTicket {
    const ticket = this.require(id)
    ticket.status = nextStatus(ticket.status)
    ticket.updatedAt = new Date().toISOString()
    return structuredClone(ticket)
  }

  resolve(id: string, applicationDataPath: string): { ticket: SupportTicket; openedPath: string; networkUsed: false } {
    if (!applicationDataPath.trim() || /[\0\r\n]/.test(applicationDataPath)) throw new Error('Application-data path is invalid')
    const ticket = this.require(id)
    ticket.status = 'resolved'
    ticket.updatedAt = new Date().toISOString()
    return { ticket: structuredClone(ticket), openedPath: applicationDataPath, networkUsed: false }
  }

  private require(id: string): SupportTicket {
    const ticket = this.tickets.get(id)
    if (!ticket) throw new Error('Support ticket not found')
    return ticket
  }
}

export function supportTicketExport(ticket: SupportTicket): SupportTicket {
  return structuredClone(ticket)
}
