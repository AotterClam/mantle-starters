import type { CmsRuntime } from "@aotter/mantle/runtime";

export function createSeededRuntime<Env>(
  getRuntime: (env: Env) => Promise<CmsRuntime>,
): (env: Env) => Promise<CmsRuntime> {
  return getRuntime;
}
