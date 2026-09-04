import type { ConfigSnapshot, HarnessPreflight, HarnessProfile, ProcessHandle, ProcessLauncher } from "./types";

const forbidden = /[;&|<>`\r\n]|\$\(|\b(cmd|powershell|pwsh|sh|bash|zsh|curl|wget)\b/i;
const snapshotId = (): string => `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export interface HostHarnessProof {
  source: "host-registry";
  executable: string;
  arguments: readonly string[];
  workingDirectoryPolicy: "exact" | "under-root";
  workingDirectory?: string;
  workingDirectoryRoot?: string;
  bundled: true;
  proofId: string;
  sha256: string;
}

const sameArray = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((value, index) => value === right[index]);
const withinRoot = (value: string, root: string): boolean => {
  const normalize = (entry: string): string => entry.replace(/[\\/]+/g, "/").replace(/\/$/, "").toLowerCase();
  const candidate = normalize(value); const base = normalize(root);
  return candidate === base || candidate.startsWith(`${base}/`);
};

export function validateHarnessProfile(profile: HarnessProfile, proof?: HostHarnessProof): string[] {
  const blockers: string[] = [];
  if (!profile.id.trim() || !profile.label.trim()) blockers.push("Profile id and label are required.");
  if (!proof || proof.source !== "host-registry") blockers.push("Profile requires a host-owned registry proof.");
  if (proof && proof.executable !== profile.executable) blockers.push("Profile executable does not match host-owned proof.");
  if (proof && !sameArray(proof.arguments, profile.arguments)) blockers.push("Profile arguments do not match host-owned proof.");
  if (proof && !proof.proofId.trim()) blockers.push("Host-owned bundle proof id is missing.");
  if (proof && !proof.sha256.trim()) blockers.push("Host-owned bundle digest is missing.");
  if (proof?.bundled !== true) blockers.push("Host-owned bundle proof is not verified.");
  if (proof?.workingDirectoryPolicy === "exact" && proof.workingDirectory !== profile.workingDirectory) blockers.push("Profile working directory does not match host-owned proof.");
  if (proof?.workingDirectoryPolicy === "under-root" && (!proof.workingDirectoryRoot || !withinRoot(profile.workingDirectory, proof.workingDirectoryRoot))) blockers.push("Profile working directory is outside the host-owned root.");
  if (forbidden.test(profile.executable)) blockers.push("Executable contains shell metacharacters or a shell launcher.");
  if (profile.arguments.some((argument) => forbidden.test(argument))) blockers.push("Arguments contain shell syntax or a shell launcher.");
  if (Object.keys(profile.environment).some((key) => forbidden.test(key) || key.toUpperCase().includes("SECRET") || key.toUpperCase().includes("TOKEN"))) blockers.push("Environment contains a secret-like or unsafe key.");
  if (profile.requiredPorts.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) blockers.push("Profile contains an invalid port.");
  return blockers;
}

export function preflightHarness(profile: HarnessProfile, model: string, proof?: HostHarnessProof): HarnessPreflight {
  const blockers = validateHarnessProfile(profile, proof);
  const preview = JSON.stringify({ model, executable: profile.executable, arguments: profile.arguments, workingDirectory: profile.workingDirectory, environmentKeys: Object.keys(profile.environment), requiredPorts: profile.requiredPorts, requiredFiles: profile.requiredFiles }, null, 2);
  return { ok: blockers.length === 0 && !!model.trim(), profileId: profile.id, model, blockers: model.trim() ? blockers : [...blockers, "A model must be selected."], preview };
}

export async function launchWithRollback(profile: HarnessProfile, model: string, launcher: ProcessLauncher, snapshot: ConfigSnapshot, restore: (snapshot: ConfigSnapshot) => Promise<void>, proof?: HostHarnessProof): Promise<{ handle?: ProcessHandle; rolledBack: boolean; error?: string }> {
  const check = preflightHarness(profile, model, proof); if (!check.ok) return { rolledBack: false, error: check.blockers.join(" ") };
  try {
    const handle = await launcher.launch(profile, model);
    const result = await handle.wait();
    if (result.code !== 0) { await restore(snapshot); return { rolledBack: true, error: `Harness exited with code ${result.code ?? "unknown"}.` }; }
    return { handle, rolledBack: false };
  } catch (error) { await restore(snapshot); return { rolledBack: true, error: error instanceof Error ? error.message : "Harness launch failed." }; }
}

export function createSnapshot(values: Readonly<Record<string, string>>, allowedKeys: readonly string[]): ConfigSnapshot {
  const safe = Object.fromEntries(Object.entries(values).filter(([key]) => allowedKeys.includes(key) && !/secret|token|password|credential/i.test(key)));
  return { id: snapshotId(), createdAt: new Date().toISOString(), values: safe };
}
