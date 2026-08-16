import {
  createMantleWorker,
  type MantleCloudflareEnv,
} from "@aotter/mantle/cloudflare";
import { plan } from "../.mantle/generated/mantle.js";

interface Env extends MantleCloudflareEnv {
  readonly PUBLIC_ORIGIN?: string;
}

const rawLocales = '{{LOCALES}}';
const locales = rawLocales.startsWith("{{") ? ["en"] : JSON.parse(rawLocales);

export default createMantleWorker<Env>({
  plan,
  siteDefaults: (env) => ({
    brand: "{{BRAND}}",
    title: "{{BRAND}}",
    description: "{{DESCRIPTION}}",
    origin: env.PUBLIC_ORIGIN ?? "http://localhost:8787",
    locales,
    icons: [{ src: "/site-icon.svg", mimeType: "image/svg+xml", sizes: ["any"] }],
  }),
});
