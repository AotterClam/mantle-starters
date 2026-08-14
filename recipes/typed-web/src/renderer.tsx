import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import { renderSeoTagsHtml, type SeoMeta } from "@aotter/mantle/runtime";
import type { SiteIcon } from "@aotter/mantle/spec";
import { siteContent } from "./web/content/siteContent.js";

const archetype = "{{ARCHETYPE}}" as string;
const themeBootScript = `(() => {
  try {
    const stored = localStorage.getItem("mantle-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", stored ? stored === "dark" : prefersDark);
  } catch {}
})();`;

export function PageDocument({
  children,
  locale,
  title = siteContent.brand,
  description = siteContent.description,
  seo,
  icons,
}: {
  readonly children: Child;
  readonly locale?: string;
  readonly title?: string;
  readonly description?: string;
  readonly seo?: SeoMeta;
  readonly icons: readonly SiteIcon[];
}) {
  return (
    <html lang={locale ?? "en"}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="mantle:site" content="v1" />
        <meta name="mantle:archetype" content={archetype} />
        <title>{title}</title>
        <meta name="description" content={description} />
        {icons.map((icon) => (
          <link
            rel="icon"
            href={icon.src}
            type={icon.mimeType}
            sizes={icon.sizes?.join(" ")}
            media={icon.theme ? `(prefers-color-scheme: ${icon.theme})` : undefined}
          />
        ))}
        {seo && raw(renderSeoTagsHtml(seo))}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="stylesheet" href="/assets/styles.css" />
      </head>
      <body class="min-h-screen bg-background text-foreground antialiased">
        {children}
        <script type="module" src="/assets/kiwa-home.js" />
      </body>
    </html>
  );
}
