import type { AnyHandler, CmsRuntime } from "@aotter/mantle/runtime";
import { notifyContact } from "../../worker/features/contact/notifyContact.js";
import { verifyContactTurnstile } from "../../worker/features/contact/verifyContactTurnstile.js";

/**
 * Presence Procedure handler registry.
 */
export function buildHandlers(
  _getRuntime: () => Promise<CmsRuntime>,
): Readonly<Record<string, AnyHandler>> {
  return {
    "notify-contact": notifyContact,
    "verify-contact-turnstile": verifyContactTurnstile,
  };
}
