import type { SiteDefaults } from "@aotter/mantle/spec";
import { R2MediaStorage, type MantleCloudflareConfig, type MantleCloudflareEnv } from "@aotter/mantle/cloudflare";
import { AwsClient } from "aws4fetch";
import type { InventoryCoordinator } from "../commerce/InventoryCoordinator.js";

export interface Env extends MantleCloudflareEnv {
  readonly MEDIA_BUCKET?: R2Bucket;
  readonly R2_ACCOUNT_ID?: string;
  readonly R2_ACCESS_KEY_ID?: string;
  readonly R2_SECRET_ACCESS_KEY?: string;
  readonly MEDIA_PUBLIC_URL_BASE?: string;
  readonly TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly INVENTORY_COORDINATOR: DurableObjectNamespace<InventoryCoordinator>;
  readonly ORDER_EXPIRY_QUEUE: Queue<{ readonly type: "expire-order"; readonly orderToken: string }>;
}

export function buildSiteDefaults(env: Env): SiteDefaults {
  const media = mediaConfig(env);
  return {
    brand: "{{BRAND}}",
    title: "{{BRAND}}",
    description: "{{DESCRIPTION}}",
    origin: env.PUBLIC_ORIGIN ?? "http://localhost:8787",
    locales: parseLocales(),
    icons: [{ src: "/site-icon.svg", mimeType: "image/svg+xml", sizes: ["any"] }],
    ...(media ? {
      media: {
        purposes: [{
          name: "product-cover",
          required: ["image/jpeg,image/png", "image/webp"],
          maxBytes: {
            "image/jpeg": 5_000_000,
            "image/png": 5_000_000,
            "image/webp": 3_000_000,
          },
        }],
      },
    } : {}),
  };
}

export function buildMediaStorage(env: Env): MantleCloudflareConfig["bindings"]["mediaStorage"] {
  const media = mediaConfig(env);
  if (!media) return undefined;
  return new R2MediaStorage(
    media.bucket,
    new AwsClient({
      accessKeyId: media.accessKeyId,
      secretAccessKey: media.secretAccessKey,
      region: "auto",
      service: "s3",
    }),
    `https://{{PROJECT_NAME}}-media.${media.accountId}.r2.cloudflarestorage.com`,
    media.publicUrlBase,
  );
}

function mediaConfig(env: Env) {
  if (!env.MEDIA_BUCKET) return null;
  const required = {
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    MEDIA_PUBLIC_URL_BASE: env.MEDIA_PUBLIC_URL_BASE,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) throw new Error(`MEDIA_BUCKET is bound but missing: ${missing.join(", ")}`);
  return {
    bucket: env.MEDIA_BUCKET,
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    publicUrlBase: env.MEDIA_PUBLIC_URL_BASE!,
  };
}

function parseLocales(): readonly string[] {
  const raw = '{{LOCALES}}';
  return raw.startsWith('{{') ? ['en'] : JSON.parse(raw);
}
