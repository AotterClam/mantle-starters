import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HomeCondition, HomeField } from "../content/types.js";

export function FieldControl({ field }: { readonly field: HomeField }) {
  const controlId = `field-${field.name}`;
  return (
    <div
      class="flex flex-col gap-2"
      data-intake-field={field.name}
      data-intake-step={field.step}
      data-intake-when-field={field.when?.field}
      data-intake-when-value={conditionValue(field.when)}
    >
      {field.options?.length ? (
        <fieldset class="grid min-w-0 gap-2">
          <legend class="mb-2 text-sm leading-none font-medium">{field.label}</legend>
          {field.options.map((option, index) => (
            <label class="flex gap-3 rounded-lg border border-border-subtle bg-background p-3 text-sm">
              <input
                id={`${controlId}-${index}`}
                class="mt-1"
                type="radio"
                name={field.name}
                value={option.value}
                required={field.required}
              />
              <span>
                <span class="block font-medium text-foreground">{option.label}</span>
                {option.body && <span class="block text-foreground-muted">{option.body}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <>
          <Label for={controlId}>{field.label}</Label>
          {field.multiline ? (
            <Textarea
              id={controlId}
              name={field.name}
              placeholder={field.placeholder}
              class="min-h-32"
              required={field.required}
            />
          ) : (
            <Input
              id={controlId}
              name={field.name}
              type={field.type ?? "text"}
              autocomplete={field.autocomplete}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}
        </>
      )}
    </div>
  );
}

export function conditionValue(condition: HomeCondition | undefined): string | undefined {
  if (!condition) return undefined;
  return (condition.oneOf ?? (condition.equals ? [condition.equals] : [])).join("|");
}
