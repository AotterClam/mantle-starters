import type { Child } from "hono/jsx";
import { Footer02 } from "@/components/blocks/marketing/footer-02";
import { Nav02 } from "@/components/blocks/marketing/nav-02";
import { homeContent, homeLocale } from "../content/homeContent.js";
import { siteContent } from "../content/siteContent.js";
import type { HomeContent } from "../content/types.js";
import { renderSection } from "../sections/renderSection.js";

type HomePageProps = {
  readonly content?: HomeContent;
  readonly turnstileSiteKey?: string;
  readonly locale?: string;
  readonly locales?: readonly string[];
  readonly localePath?: string;
  readonly brand?: string;
};

export function HomePage({
  content = homeContent,
  turnstileSiteKey,
  locale = homeLocale ?? "en",
  locales = [locale],
  localePath = "/:locale",
  brand = siteContent.brand,
}: HomePageProps) {
  const siteKey = turnstileSiteKey?.trim();
  return (
    <SitePage
      locale={locale}
      locales={locales}
      localePath={localePath}
      brand={brand}
      before={siteKey && (
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        ></script>
      )}
    >
      {content.sections.map((section, index) =>
        renderSection(section, index, siteKey, locale)
      )}
    </SitePage>
  );
}

export function SitePage({
  children,
  locale,
  locales,
  localePath,
  brand = siteContent.brand,
  before,
}: {
  readonly children: Child;
  readonly locale: string;
  readonly locales: readonly string[];
  readonly localePath: string;
  readonly brand?: string;
  readonly before?: Child;
}) {
  const homeHref = `/${locale.toLowerCase()}`;
  const href = (value: string) => value.startsWith("/") &&
      !value.startsWith("//") &&
      value !== homeHref &&
      !value.startsWith(`${homeHref}/`)
    ? `${homeHref}${value}`
    : value;
  const hasNavigation = siteContent.navLinks.length > 0 || Boolean(siteContent.navAction) || locales.length > 1;
  const hasFooter = Boolean(
    siteContent.footer.tagline ||
      siteContent.footer.copyright ||
      siteContent.footer.columns.length > 0 ||
      siteContent.footer.socialLinks.length > 0 ||
      siteContent.footer.bottomLinks.length > 0,
  );
  return (
    <>
      {before}
      {hasNavigation && (
        <Nav02
          logo={brand}
          logoHref={homeHref}
          links={siteContent.navLinks.map((link) => ({ ...link, href: href(link.href) }))}
          ctaText={siteContent.navAction?.label}
          ctaHref={siteContent.navAction && href(siteContent.navAction.href)}
          locale={locale}
          locales={locales}
          localePath={localePath}
          labels={siteContent.chromeLabels}
        />
      )}
      <main>{children}</main>
      {hasFooter && (
        <Footer02
          logo={{ text: brand }}
          tagline={siteContent.footer.tagline}
          columns={siteContent.footer.columns.map((column) => ({
            title: column.title,
            links: column.links.map((link) => ({ ...link, href: href(link.href) })),
          }))}
          socialLinks={siteContent.footer.socialLinks.map((link) => ({ ...link }))}
          copyright={siteContent.footer.copyright}
          bottomLinks={siteContent.footer.bottomLinks.map((link) => ({ ...link, href: href(link.href) }))}
        />
      )}
    </>
  );
}
