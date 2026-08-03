import { Button } from "@/components/ui/button";
import { DisplayCard } from "@/components/ui/display-card";
import type { HomeField, HomeSection, HomeStep } from "../content/types.js";
import { FieldControl, conditionValue } from "./fieldControl.js";

type IntakeSectionProps = {
  readonly section: HomeSection;
  readonly turnstileSiteKey?: string;
  readonly locale?: string;
};

export function IntakeSection({
  section,
  turnstileSiteKey,
  locale,
}: IntakeSectionProps) {
  const steps = section.steps?.length ? section.steps : [{
    id: "intake",
    title: section.title,
    body: section.body,
  }];
  const fields = section.fields ?? [];
  const intakeLabels = section.intakeLabels;
  const progressTemplate = intakeLabels?.progressTemplate ?? "";
  return (
    <section id={section.id} class="py-16 md:py-24">
      <div class="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
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
          <div class="mt-2 grid gap-3">
            {steps.map((step, index) => (
              <div key={step.id} class="flex gap-3 text-sm text-foreground-muted">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                  {index + 1}
                </span>
                <span>
                  <strong class="block text-foreground">{step.title}</strong>
                  {step.body}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DisplayCard class="p-6 sm:p-8" data-intake-root="true">
          <form
            action={section.action?.href ?? ""}
            method="post"
            class="grid gap-6"
            data-intake-form="true"
            data-mantle-form="true"
            data-mantle-pending-message={section.formMessages?.pending}
            data-mantle-success-message={section.formMessages?.success}
            data-mantle-error-message={section.formMessages?.error}
          >
            <input
              type="hidden"
              name="resultKey"
              value={section.results?.[0]?.key ?? "submitted"}
              data-intake-result-key
            />
            {locale && <input type="hidden" name="replyLocale" value={locale} />}
            <p
              class="text-sm font-medium text-primary"
              data-intake-progress
              data-intake-progress-template={progressTemplate}
            >
              {progressTemplate
                .replace("{current}", "1")
                .replace("{total}", String(steps.length))}
            </p>
            {steps.map((step, index) => (
              <div data-intake-step-panel data-step-id={step.id} hidden={index !== 0}>
                <div class="grid gap-2">
                  <h3 class="text-xl tracking-tight">{step.title}</h3>
                  {step.body && <p class="text-sm text-foreground-muted">{step.body}</p>}
                </div>
                <div class="mt-5 grid gap-5">
                  {fieldsForStep(fields, steps, step).map((field) => (
                    <FieldControl key={field.name} field={field} />
                  ))}
                </div>
              </div>
            ))}
            {turnstileSiteKey && (
              <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
            )}
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" class="w-full sm:w-auto" data-intake-prev>
                {intakeLabels?.back}
              </Button>
              <Button type="button" class="w-full sm:w-auto" data-intake-next>
                {intakeLabels?.next}
              </Button>
              <Button type="submit" class="w-full sm:w-auto" data-intake-submit hidden>
                {intakeLabels?.submit ?? section.action?.label}
              </Button>
            </div>
            <p
              class="text-sm text-foreground-muted data-[error=true]:text-destructive"
              data-mantle-form-status
              hidden
              role="status"
              aria-live="polite"
            ></p>
            <div class="grid gap-3" data-intake-results hidden>
              {(section.results ?? []).map((result) => (
                <div
                  class="rounded-xl border border-border-subtle bg-muted p-4"
                  data-intake-result={result.key}
                  data-intake-when-field={result.when?.field}
                  data-intake-when-value={conditionValue(result.when)}
                  hidden
                >
                  <strong class="block text-foreground">{result.title}</strong>
                  {result.body && <p class="mt-1 text-sm text-foreground-muted">{result.body}</p>}
                </div>
              ))}
            </div>
          </form>
        </DisplayCard>
      </div>
    </section>
  );
}

function fieldsForStep(
  fields: readonly HomeField[],
  steps: readonly HomeStep[],
  step: HomeStep,
): readonly HomeField[] {
  const firstStepId = steps[0]?.id ?? step.id;
  return fields.filter((field) => (field.step ?? firstStepId) === step.id);
}
