import type { MantleExtensionApp } from "@aotter/mantle/cloudflare";
import stylesCss from "../../../styles/generated.css";
import { homeClientJs } from "../../web/client/homeClient.js";
import { kiwaEnhanceAssets } from "../../web/client/kiwaEnhanceAssets.js";
import type { Env } from "../../mantle/config.js";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function mountAssetRoutes(app: MantleExtensionApp<Env>): void {
  app.get("/assets/styles.css", () =>
    new Response(stylesCss, {
      headers: {
        "cache-control": ASSET_CACHE_CONTROL,
        "content-type": "text/css; charset=utf-8",
      },
    }),
  );
  app.get("/assets/kiwa-home.js", () =>
    new Response(homeClientJs, {
      headers: {
        "cache-control": ASSET_CACHE_CONTROL,
        "content-type": "text/javascript; charset=utf-8",
      },
    }),
  );
  app.get("/enhance/:file", (c) => {
    const file = c.req.param("file");
    if (!/^[A-Za-z0-9._-]+\.js$/.test(file)) return c.notFound();
    const assetText = kiwaEnhanceAssets[file];
    if (!assetText) return c.notFound();
    return new Response(assetText, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": "text/javascript; charset=utf-8",
      },
    });
  });
}
