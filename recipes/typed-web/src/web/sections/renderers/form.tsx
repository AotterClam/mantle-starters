import { Button } from "@/components/ui/button";
import { DisplayCard } from "@/components/ui/display-card";
import { ClockIcon, MailIcon, MapPinIcon } from "@/components/ui/icon";
import type { HomeSection } from "../../content/types.js";
import { FieldControl } from "../fieldControl.js";
import { items, sectionKey } from "../helpers.js";
import type { SectionRenderer } from "../renderSection.js";

export const renderForm: SectionRenderer = (section, index, turnstileSiteKey) => (
  <FormSection
    key={sectionKey(section, index)}
    section={section}
    turnstileSiteKey={turnstileSiteKey}
  />
);

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
            {items(section).map((item, itemIndex) => (
              <div key={itemIndex} class="flex items-center gap-2">
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
