import { IntakeSection } from "../intakeSection.js";
import type { SectionRenderer } from "../renderSection.js";
import { sectionKey } from "../helpers.js";

export const renderIntake: SectionRenderer = (
  section,
  index,
  turnstileSiteKey,
  locale,
) => (
  <IntakeSection
    key={sectionKey(section, index)}
    section={section}
    turnstileSiteKey={turnstileSiteKey}
    locale={locale}
  />
);
