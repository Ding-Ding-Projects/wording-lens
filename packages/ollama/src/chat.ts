import type { Attachment, AttachmentDecision, ChatMessage, ChatParameters, ChatSession } from "./types";

const iso = (): string => new Date().toISOString();
const capabilityFor = (mime: string): string => mime.startsWith("image/") ? "vision" : mime.startsWith("audio/") ? "audio" : "attachments";

export function attachmentDecision(capabilities: readonly string[], attachment: Attachment): AttachmentDecision {
  const requiredCapability = capabilityFor(attachment.mime);
  return capabilities.includes(requiredCapability) ? { allowed: true } : { allowed: false, requiredCapability, reason: `The selected model does not declare ${requiredCapability} support.` };
}

export function createChatSession(id: string, model: string, systemPrompt = "", parameters: ChatParameters = {}): ChatSession {
  if (!id.trim() || !model.trim()) throw new Error("Chat session requires an id and model.");
  return { id, model, systemPrompt, parameters, messages: systemPrompt ? [{ role: "system", content: systemPrompt }] : [], updatedAt: iso() };
}

export function appendMessage(session: ChatSession, message: ChatMessage): ChatSession {
  if (!message.content.trim()) throw new Error("Chat message cannot be empty.");
  return { ...session, messages: [...session.messages, { ...message }], updatedAt: iso() };
}

export function redactedChatExport(session: ChatSession): string {
  return JSON.stringify({ schemaVersion: 1, session: { id: session.id, model: session.model, systemPrompt: session.systemPrompt, parameters: session.parameters, messages: session.messages, updatedAt: session.updatedAt }, note: "Local chat export excludes credentials, environment values, private paths, and raw API payloads." }, null, 2);
}
