import { cloudflareTurnstileCheck } from "@aotter/mantle/cloudflare";
import type { MantleHandlers } from "../.mantle/generated/types.js";
import { notifyContact } from "./notifyContact.js";

export function createHandlers(env: SiteEnv): MantleHandlers<SiteEnv> {
  return {
    "notify-contact": notifyContact,
    "verify-contact-turnstile": cloudflareTurnstileCheck({
      secret: env.TURNSTILE_SECRET_KEY,
      tokenField: "cf-turnstile-response",
    }),
  };
}
