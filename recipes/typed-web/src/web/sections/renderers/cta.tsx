import { Cta02 } from "@/components/blocks/marketing/cta-02";
import type { SectionRenderer } from "../renderSection.js";
import { sectionKey, withAnchor } from "../helpers.js";

export const renderCta: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
    <Cta02
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      primaryCta={section.action}
      secondaryCta={section.secondaryAction}
    />
  ));
};
