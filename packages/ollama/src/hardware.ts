import type { FitEvidence, HardwareFacts, ModelTag } from "./types";

const iso = (): string => new Date().toISOString();
const numericParameter = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)\s*([bmk])/i); if (!match) return undefined;
  const unit = match[2].toLowerCase(); const factor = unit === "b" ? 1_000_000_000 : unit === "m" ? 1_000_000 : 1_000;
  return Number(match[1]) * factor;
};

/** Conservative fit assessment. Missing evidence never becomes an optimistic zero. */
export function assessFit(model: ModelTag, hardware: HardwareFacts, now = iso()): FitEvidence {
  const assumptions: string[] = []; const limitations: string[] = [];
  if (model.sizeBytes === undefined) limitations.push("Model blob size is not reported.");
  if (hardware.ramBytes === undefined && hardware.vramBytes === undefined) limitations.push("Usable RAM and VRAM are not reported.");
  if (model.contextWindow === undefined) limitations.push("Model context window is not reported.");
  const memory = Math.max(hardware.ramBytes ?? 0, hardware.vramBytes ?? 0);
  const modelBytes = model.sizeBytes;
  if (!modelBytes || memory === 0) return { verdict: "Unknown", model, hardware, assumptions, limitations, assessedAt: now };
  const overhead = Math.max(modelBytes * 0.2, (model.contextWindow ?? 0) * 4096);
  const required = modelBytes + overhead;
  if (hardware.freeDiskBytes !== undefined && hardware.freeDiskBytes < modelBytes * 1.2) limitations.push("Free destination storage is below the conservative download margin.");
  assumptions.push("Fit includes a 20% runtime overhead and the declared context window where available.");
  const enough = memory >= required;
  const close = memory >= modelBytes;
  const diskOk = hardware.freeDiskBytes === undefined || hardware.freeDiskBytes >= modelBytes * 1.2;
  const verdict = enough && diskOk ? "Runs well" : close && diskOk ? "Runs with limits" : "Unlikely";
  return { verdict, model, hardware, assumptions, limitations, assessedAt: now };
}

export function modelMemoryEstimate(model: ModelTag): number | undefined {
  if (model.sizeBytes !== undefined) return model.sizeBytes;
  const params = numericParameter(model.parameterSize);
  return params === undefined ? undefined : params * 0.6;
}
