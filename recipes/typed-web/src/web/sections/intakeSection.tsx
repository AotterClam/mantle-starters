import type { HomeSection } from "../content/types.js";

export type IntakeSectionProps = {
  readonly section: HomeSection;
  readonly turnstileSiteKey?: string;
  readonly locale?: string;
};

export function IntakeSection(_props: IntakeSectionProps) {
  return null;
}
