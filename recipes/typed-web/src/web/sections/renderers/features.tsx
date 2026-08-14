import { Features02 } from "@/components/blocks/marketing/features-02";
import type { SectionRenderer } from "../renderSection.js";
import { featureIcon, items, sectionKey, withAnchor } from "../helpers.js";

export const renderFeatures: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
    <Features02
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      features={items(section).map((item) => ({
        icon: featureIcon(item.icon),
        title: item.title ?? "",
        description: item.body ?? "",
        href: item.href,
      }))}
    />
  ));
};
