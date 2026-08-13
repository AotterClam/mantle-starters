import type { AnyHandler } from "@aotter/mantle/runtime";
import type { CmsRuntime } from "@aotter/mantle/runtime";

/**
 * Procedure handler registry. Blank ships no ref handlers; archetype
 * overlays replace this file when their manifests need runtime hooks.
 */
export function buildHandlers(
  _getRuntime: () => Promise<CmsRuntime>,
): Readonly<Record<string, AnyHandler>> {
  return {};
}
