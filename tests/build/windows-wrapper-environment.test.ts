import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wrappers = [
  ["download-dependencies.bat", "bootstrap-dependencies.ps1", "%SILENT_FLAG%"],
  ["build.bat", "build-project.ps1", "%SILENT_FLAG% %RUN_FLAG%"],
  ["build-installer.bat", "build-installer.ps1", "%SILENT_FLAG%"],
] as const;

function assertLocalModuleReset(source: string, script: string, flags: string) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invocation = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\\${script}" ${flags}`;
  const childIndex = lines.indexOf(invocation);
  expect(childIndex, "The original Windows PowerShell invocation must be preserved.").toBeGreaterThan(0);
  expect(lines.filter((line) => /^powershell\.exe\b/i.test(line))).toEqual([invocation]);
  expect(lines[childIndex - 1], "Clear the child environment immediately before starting Windows PowerShell.").toBe('set "PSModulePath="');
  expect(lines.indexOf("setlocal EnableExtensions"), "The environment reset must be scoped to the batch process.").toBeGreaterThanOrEqual(0);
  expect(lines.indexOf("setlocal EnableExtensions")).toBeLessThan(childIndex - 1);
  expect(lines.filter((line) => /PSModulePath/i.test(line))).toEqual(['set "PSModulePath="']);
  expect(source, "Do not persist environment changes or modify registry/security settings.").not.toMatch(/\bsetx\b|^\s*reg(?:\.exe)?\s|SetEnvironmentVariable|Set-ExecutionPolicy/im);
  expect(lines[childIndex + 1], "Preserve the child's exit code.").toBe("exit /b %errorlevel%");
}

describe("Windows batch wrapper module isolation", () => {
  it.each(wrappers)("%s resets only its child module path before %s", (wrapper, script, flags) => {
    assertLocalModuleReset(readFileSync(resolve(wrapper), "utf8"), script, flags);
  });

  const fixture = [
    "@echo off",
    "setlocal EnableExtensions",
    'set "PSModulePath="',
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\\bootstrap-dependencies.ps1" %SILENT_FLAG%',
    "exit /b %errorlevel%",
  ].join("\n");

  it("rejects a missing environment reset", () => {
    expect(() => assertLocalModuleReset(fixture.replace('set "PSModulePath="\n', ""), wrappers[0][1], wrappers[0][2])).toThrow();
  });

  it("rejects a reset after child launch", () => {
    const moved = fixture.replace('set "PSModulePath="\n', "").replace("exit /b", 'set "PSModulePath="\nexit /b');
    expect(() => assertLocalModuleReset(moved, wrappers[0][1], wrappers[0][2])).toThrow();
  });

  it("rejects an unscoped environment reset", () => {
    expect(() => assertLocalModuleReset(fixture.replace("setlocal EnableExtensions\n", ""), wrappers[0][1], wrappers[0][2])).toThrow();
  });

  it("rejects persistent environment changes", () => {
    expect(() => assertLocalModuleReset(`setx PSModulePath ""\n${fixture}`, wrappers[0][1], wrappers[0][2])).toThrow();
  });
});
