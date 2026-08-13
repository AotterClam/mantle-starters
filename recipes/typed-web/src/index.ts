import type { Env } from "./mantle/config.js";
import { getRuntime, mantle } from "./mantle/worker.js";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await getRuntime(env);
    return mantle.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
