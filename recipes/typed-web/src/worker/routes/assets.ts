import { Hono } from "hono";
import stylesCss from "../../../styles/generated.css";
import { homeClientJs } from "../../web/client/homeClient.js";
import { kiwaEnhanceAssets } from "../../web/client/kiwaEnhanceAssets.js";

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function createAssetsRoutes(): Hono {
  const app = new Hono();

  app.get("/styles.css", () =>
    new Response(stylesCss, {
      headers: {
        "cache-control": ASSET_CACHE_CONTROL,
        "content-type": "text/css; charset=utf-8",
      },
    }),
  );
  app.get("/kiwa-home.js", () =>
    new Response(homeClientJs, {
      headers: {
        "cache-control": ASSET_CACHE_CONTROL,
        "content-type": "text/javascript; charset=utf-8",
      },
    }),
  );
  return app;
}

export function createEnhanceRoutes(): Hono {
  const app = new Hono();
  app.get("/:file", (c) => {
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
  return app;
}
