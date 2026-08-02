import { cloudflareTurnstileCheck } from "@aotter/mantle/cloudflare";
import type { MantleHandlers } from "../.mantle/generated/types.js";
import { notifyIntake } from "./notifyIntake.js";

export function createHandlers(env: SiteEnv): MantleHandlers<SiteEnv> {
  return {
    "notify-intake": notifyIntake,
    "verify-intake-turnstile": cloudflareTurnstileCheck({
      secret: env.TURNSTILE_SECRET_KEY,
      tokenField: "cf-turnstile-response",
    }),
  };
}
