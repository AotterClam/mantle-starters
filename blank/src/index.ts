import {
  createMantleWorker,
  type MantleCloudflareEnv,
} from "@aotter/mantle/cloudflare";
import { manifest } from "../.mantle/generated/site.js";

interface Env extends MantleCloudflareEnv {
  readonly PUBLIC_ORIGIN?: string;
}

const rawLocales = '{{LOCALES}}';
const locales = rawLocales.startsWith("{{") ? ["en"] : JSON.parse(rawLocales);

export default createMantleWorker<Env>({
  manifest,
  siteDefaults: (env) => ({
    brand: "{{BRAND}}",
    title: "{{BRAND}}",
    description: "{{DESCRIPTION}}",
    origin: env.PUBLIC_ORIGIN ?? "http://localhost:8787",
    locales,
  }),
});
