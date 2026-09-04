import type { ConfigSnapshot, HarnessPreflight, HarnessProfile, ProcessHandle, ProcessLauncher } from "./types";

const forbidden = /[;&|<>`\r\n]|\$\(|\b(cmd|powershell|pwsh|sh|bash|zsh|curl|wget)\b/i;
const snapshotId = (): string => `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function validateHarnessProfile(profile: HarnessProfile): string[] {
  const blockers: string[] = [];
  if (!profile.id.trim() || !profile.label.trim()) blockers.push("Profile id and label are required.");
  if (!profile.allowlisted) blockers.push("Profile is not on the explicit executable allowlist.");
  if (!profile.bundled) blockers.push("Profile executable is not bundled or independently proven.");
  if (forbidden.test(profile.executable)) blockers.push("Executable contains shell metacharacters or a shell launcher.");
  if (profile.arguments.some((argument) => forbidden.test(argument))) blockers.push("Arguments contain shell syntax or a shell launcher.");
  if (Object.keys(profile.environment).some((key) => forbidden.test(key) || key.toUpperCase().includes("SECRET") || key.toUpperCase().includes("TOKEN"))) blockers.push("Environment contains a secret-like or unsafe key.");
  if (profile.requiredPorts.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) blockers.push("Profile contains an invalid port.");
  return blockers;
}

export function preflightHarness(profile: HarnessProfile, model: string): HarnessPreflight {
  const blockers = validateHarnessProfile(profile);
  const preview = JSON.stringify({ model, executable: profile.executable, arguments: profile.arguments, workingDirectory: profile.workingDirectory, environmentKeys: Object.keys(profile.environment), requiredPorts: profile.requiredPorts, requiredFiles: profile.requiredFiles }, null, 2);
  return { ok: blockers.length === 0 && !!model.trim(), profileId: profile.id, model, blockers: model.trim() ? blockers : [...blockers, "A model must be selected."], preview };
}

export async function launchWithRollback(profile: HarnessProfile, model: string, launcher: ProcessLauncher, snapshot: ConfigSnapshot, restore: (snapshot: ConfigSnapshot) => Promise<void>): Promise<{ handle?: ProcessHandle; rolledBack: boolean; error?: string }> {
  const check = preflightHarness(profile, model); if (!check.ok) return { rolledBack: false, error: check.blockers.join(" ") };
  try {
    const handle = await launcher.launch(profile, model);
    const result = await handle.wait();
    if (result.code !== 0) { await restore(snapshot); return { rolledBack: true, error: `Harness exited with code ${result.code ?? "unknown"}.` }; }
    return { handle, rolledBack: false };
  } catch (error) { await restore(snapshot); return { rolledBack: true, error: error instanceof Error ? error.message : "Harness launch failed." }; }
}

export function createSnapshot(values: Readonly<Record<string, string>>): ConfigSnapshot {
  const safe = Object.fromEntries(Object.entries(values).filter(([key]) => !/secret|token|password|credential/i.test(key)));
  return { id: snapshotId(), createdAt: new Date().toISOString(), values: safe };
}
