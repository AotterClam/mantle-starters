import type { AnyHandler } from "@aotter/mantle/runtime";
import type { MantleRuntime } from "@aotter/mantle/runtime";

/**
 * Procedure handler registry. Blank ships no ref handlers; archetype
 * overlays replace this file when their manifests need runtime hooks.
 */
export function buildHandlers(
  _getRuntime: () => Promise<MantleRuntime>,
): Readonly<Record<string, AnyHandler>> {
  return {};
}
