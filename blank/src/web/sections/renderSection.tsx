import type { Child, FC } from "hono/jsx";
import { Bento02 } from "@/components/blocks/marketing/bento-02";
import { Contact02 } from "@/components/blocks/marketing/contact-02";
import { Content01 } from "@/components/blocks/marketing/content-01";
import { Cta02 } from "@/components/blocks/marketing/cta-02";
import { Faq02 } from "@/components/blocks/marketing/faq-02";
import { Features02 } from "@/components/blocks/marketing/features-02";
import { Hero02 } from "@/components/blocks/marketing/hero-02";
import { Metrics02 } from "@/components/blocks/marketing/metrics-02";
import { SocialProof02 } from "@/components/blocks/marketing/social-proof-02";
import { Testimonials02 } from "@/components/blocks/marketing/testimonials-02";
import { Button } from "@/components/ui/button";
import { DisplayCard } from "@/components/ui/display-card";
import {
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  HandshakeIcon,
  LayoutIcon,
  MailIcon,
  MapPinIcon,
  ShieldIcon,
  SparklesIcon,
} from "@/components/ui/icon";
import type { HomeItem, HomeSection } from "../content/types.js";
import { FieldControl } from "./fieldControl.js";
import { IntakeSection } from "./intakeSection.js";

const featureIcons: Record<string, FC<{ class?: string }>> = {
  chat: ChatIcon,
  check: CheckCircleIcon,
  handshake: HandshakeIcon,
  layout: LayoutIcon,
  shield: ShieldIcon,
  sparkles: SparklesIcon,
};

export function renderSection(
  section: HomeSection,
  index: number,
  turnstileSiteKey?: string,
  locale?: string,
): Child {
  const key = `${section.type}-${section.id ?? index}`;
  switch (section.type) {
    case "hero":
      return (
        <Hero02
          key={key}
          title={section.title}
          description={section.body}
          primaryCta={section.action}
          secondaryCta={section.secondaryAction}
          showImage={section.showImage}
        />
      );
    case "socialProof":
      return (
        <SocialProof02
          key={key}
          class="mantle-social-proof"
          title={section.title}
          logos={items(section).map((item) => ({
            name: item.title ?? item.name ?? "",
            mark: item.mark ?? 1,
          }))}
        />
      );
    case "content":
      return withAnchor(
        section,
        key,
        <Content01
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          paragraphs={items(section).map((item) => item.body ?? "").filter(Boolean)}
          showImage={section.showImage}
        />,
      );
    case "features":
      return withAnchor(
        section,
        key,
        <Features02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          features={items(section).map((item) => ({
            icon: featureIcon(item.icon),
            title: item.title ?? "",
            description: item.body ?? "",
          }))}
        />,
      );
    case "bento": {
      const [mainItem, ...cardItems] = items(section);
      return withAnchor(
        section,
        key,
        <Bento02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          mainCard={{
            title: mainItem?.title ?? section.title,
            description: mainItem?.body ?? section.body ?? "",
          }}
          cards={cardItems.map((item) => ({
            title: item.title ?? "",
            description: item.body ?? "",
          }))}
        />,
      );
    }
    case "metrics":
      return withAnchor(
        section,
        key,
        <Metrics02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          cta={section.action}
          metrics={items(section).map((item) => ({
            value: item.value ?? "",
            label: item.title ?? item.label ?? "",
          }))}
        />,
      );
    case "testimonials":
      return withAnchor(
        section,
        key,
        <Testimonials02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          testimonials={items(section).map((item) => ({
            quote: item.quote ?? item.body ?? "",
            author: {
              name: item.name ?? "",
              title: item.role ?? "",
              company: item.company ?? "",
            },
          }))}
        />,
      );
    case "faq":
      return withAnchor(
        section,
        key,
        <Faq02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          items={items(section).map((item) => ({
            question: item.title ?? "",
            answer: item.body ?? "",
          }))}
        />,
      );
    case "contact":
      return withAnchor(
        section,
        key,
        <Contact02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          items={items(section).map((item) => ({
            icon: contactIcon(item.icon),
            title: item.title ?? "",
            description: item.body ?? "",
            value: item.value ?? "",
            href: item.href,
          }))}
          footerTitle={section.footerTitle}
          footerDescription={section.footerBody}
          footerCta={section.footerAction}
        />,
      );
    case "form":
      return <FormSection key={key} section={section} turnstileSiteKey={turnstileSiteKey} />;
    case "intake":
      return (
        <IntakeSection
          key={key}
          section={section}
          turnstileSiteKey={turnstileSiteKey}
          locale={locale}
        />
      );
    case "cta":
      return withAnchor(
        section,
        key,
        <Cta02
          eyebrow={section.eyebrow}
          title={section.title}
          description={section.body}
          primaryCta={section.action}
          secondaryCta={section.secondaryAction}
        />,
      );
  }
}

function FormSection({
  section,
  turnstileSiteKey,
}: {
  readonly section: HomeSection;
  readonly turnstileSiteKey?: string;
}) {
  const fields = section.fields ?? [];
  return (
    <section id={section.id} class="py-16 md:py-24">
      <div class="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div class="flex flex-col justify-center gap-4">
          {section.eyebrow && (
            <p class="text-xs font-medium uppercase tracking-wide text-primary">
              {section.eyebrow}
            </p>
          )}
          <h2 class="text-3xl tracking-tight sm:text-4xl">{section.title}</h2>
          {section.body && (
            <p class="max-w-lg text-base text-foreground-muted">{section.body}</p>
          )}
          <div class="mt-2 flex flex-col gap-3 text-sm text-foreground-muted">
            {items(section).map((item, index) => (
              <div key={index} class="flex items-center gap-2">
                <InlineIcon name={item.icon} />
                <span>{item.body ?? item.title}</span>
              </div>
            ))}
          </div>
        </div>

        <DisplayCard class="p-6 sm:p-8">
          <form
            action={section.action?.href ?? ""}
            method="post"
            class="flex flex-col gap-5"
            data-contact-form="true"
            data-mantle-form="true"
            data-mantle-pending-message={section.formMessages?.pending}
            data-mantle-success-message={section.formMessages?.success}
            data-mantle-error-message={section.formMessages?.error}
          >
            <div class="grid gap-5 sm:grid-cols-2">
              {fields.slice(0, 2).map((field) => (
                <FieldControl key={field.name} field={field} />
              ))}
            </div>
            {fields.slice(2).map((field) => (
              <FieldControl key={field.name} field={field} />
            ))}
            {turnstileSiteKey && (
              <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
            )}
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {section.footerBody && (
                <p class="text-sm text-foreground-muted">{section.footerBody}</p>
              )}
              {section.action?.label && (
                <Button type="submit" class="w-full sm:w-auto">{section.action.label}</Button>
              )}
            </div>
            <p
              class="text-sm text-foreground-muted data-[error=true]:text-destructive"
              data-contact-status
              data-mantle-form-status
              hidden
              role="status"
              aria-live="polite"
            ></p>
          </form>
        </DisplayCard>
      </div>
    </section>
  );
}

function InlineIcon({ name }: { readonly name?: string }) {
  if (name === "clock") return <ClockIcon class="size-4 text-foreground" />;
  if (name === "map") return <MapPinIcon class="size-4 text-foreground" />;
  return <MailIcon class="size-4 text-foreground" />;
}

function withAnchor(section: HomeSection, key: string, child: Child): Child {
  return section.id ? (
    <div key={key} id={section.id}>
      {child}
    </div>
  ) : (
    child
  );
}

function items(section: HomeSection): readonly HomeItem[] {
  return section.items ?? [];
}

function featureIcon(name: string | undefined): FC<{ class?: string }> {
  return featureIcons[name ?? "sparkles"] ?? SparklesIcon;
}

function contactIcon(name: string | undefined): "email" | "phone" | "location" {
  if (name === "phone") return "phone";
  if (name === "location") return "location";
  return "email";
}
