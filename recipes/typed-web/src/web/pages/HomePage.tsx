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
};

export function HomePage({
  content = homeContent,
  turnstileSiteKey,
  locale = homeLocale,
}: HomePageProps) {
  const siteKey = turnstileSiteKey?.trim();
  const hasNavigation = siteContent.navLinks.length > 0 || Boolean(siteContent.navAction);
  const hasFooter = Boolean(
    siteContent.footer.tagline ||
      siteContent.footer.copyright ||
      siteContent.footer.columns.length > 0 ||
      siteContent.footer.socialLinks.length > 0 ||
      siteContent.footer.bottomLinks.length > 0,
  );
  return (
    <>
      {siteKey && (
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        ></script>
      )}
      {hasNavigation && (
        <Nav02
          logo={siteContent.brand}
          links={siteContent.navLinks.map((link) => ({ ...link }))}
          ctaText={siteContent.navAction?.label}
          ctaHref={siteContent.navAction?.href}
          labels={siteContent.chromeLabels}
        />
      )}
      <main>
        {content.sections.map((section, index) =>
          renderSection(section, index, siteKey, locale)
        )}
      </main>
      {hasFooter && (
        <Footer02
          logo={{ text: siteContent.brand }}
          tagline={siteContent.footer.tagline}
          columns={siteContent.footer.columns.map((column) => ({
            title: column.title,
            links: column.links.map((link) => ({ ...link })),
          }))}
          socialLinks={siteContent.footer.socialLinks.map((link) => ({ ...link }))}
          copyright={siteContent.footer.copyright}
          bottomLinks={siteContent.footer.bottomLinks.map((link) => ({ ...link }))}
        />
      )}
    </>
  );
}
