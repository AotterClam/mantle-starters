import { Hero02 } from "@/components/blocks/marketing/hero-02";
import type { SectionRenderer } from "../renderSection.js";
import { sectionKey } from "../helpers.js";

export const renderHero: SectionRenderer = (section, index) => (
  <Hero02
    key={sectionKey(section, index)}
    title={section.title}
    description={section.body}
    primaryCta={section.action}
    secondaryCta={section.secondaryAction}
    image={section.image}
    showImage={section.showImage}
  />
);
