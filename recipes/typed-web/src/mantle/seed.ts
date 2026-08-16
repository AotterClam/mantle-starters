import type { MantleRuntime } from "@aotter/mantle/runtime";

export function createSeededRuntime<Env>(
  getRuntime: (env: Env) => Promise<MantleRuntime>,
): (env: Env) => Promise<MantleRuntime> {
  return getRuntime;
}
