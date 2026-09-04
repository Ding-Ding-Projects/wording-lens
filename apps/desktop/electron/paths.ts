import { join } from "node:path";

export function resolveRendererEntry(compiledMainDirectory: string): string {
  return join(compiledMainDirectory, "../../../../dist/renderer/index.html");
}
