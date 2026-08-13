import type { Child } from "hono/jsx";
import { Footer02 } from "@/components/blocks/marketing/footer-02";
import { Nav02 } from "@/components/blocks/marketing/nav-02";
import { siteContent, siteContentForLocale } from "../content/siteContent.js";
import type { HomeContent } from "../content/types.js";
import { renderSection } from "../sections/renderSection.js";

type HomePageProps = {
  readonly content: HomeContent;
  readonly turnstileSiteKey?: string;
  readonly locale: string;
  readonly locales?: readonly string[];
  readonly localePath?: string;
  readonly brand?: string;
};

export function HomePage({
  content,
  turnstileSiteKey,
  locale,
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
  const copy = siteContentForLocale(locale);
  const homeHref = `/${locale.toLowerCase()}`;
  const href = (value: string) => value.startsWith("/") &&
      !value.startsWith("//") &&
      value !== homeHref &&
      !value.startsWith(`${homeHref}/`)
    ? `${homeHref}${value}`
    : value;
  const hasNavigation = copy.navLinks.length > 0 || Boolean(copy.navAction) || locales.length > 1;
  const hasFooter = Boolean(
    copy.footer.tagline ||
      copy.footer.copyright ||
      copy.footer.columns.length > 0 ||
      copy.footer.socialLinks.length > 0 ||
      copy.footer.bottomLinks.length > 0,
  );
  return (
    <>
      {before}
      {hasNavigation && (
        <Nav02
          logo={brand}
          logoHref={homeHref}
          links={copy.navLinks.map((link) => ({ ...link, href: href(link.href) }))}
          ctaText={copy.navAction?.label}
          ctaHref={copy.navAction && href(copy.navAction.href)}
          ctaIcon={copy.navAction?.icon}
          locale={locale}
          locales={locales}
          localePath={localePath}
          labels={copy.chromeLabels}
        />
      )}
      <main>{children}</main>
      {hasFooter && (
        <Footer02
          logo={{ text: brand }}
          tagline={copy.footer.tagline}
          columns={copy.footer.columns.map((column) => ({
            title: column.title,
            links: column.links.map((link) => ({ ...link, href: href(link.href) })),
          }))}
          socialLinks={copy.footer.socialLinks.map((link) => ({ ...link }))}
          copyright={copy.footer.copyright}
          bottomLinks={copy.footer.bottomLinks.map((link) => ({ ...link, href: href(link.href) }))}
        />
      )}
    </>
  );
}
