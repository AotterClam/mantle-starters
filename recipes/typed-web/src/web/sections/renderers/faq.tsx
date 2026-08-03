import { Faq02 } from "@/components/blocks/marketing/faq-02";
import type { SectionRenderer } from "../renderSection.js";
import { items, sectionKey, withAnchor } from "../helpers.js";

export const renderFaq: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
    <Faq02
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      items={items(section).map((item) => ({
        question: item.title ?? "",
        answer: item.body ?? "",
      }))}
    />
  ));
};
