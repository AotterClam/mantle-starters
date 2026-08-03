import { Testimonials02 } from "@/components/blocks/marketing/testimonials-02";
import type { SectionRenderer } from "../renderSection.js";
import { items, sectionKey, withAnchor } from "../helpers.js";

export const renderTestimonials: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
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
    />
  ));
};
