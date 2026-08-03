import { Metrics02 } from "@/components/blocks/marketing/metrics-02";
import type { SectionRenderer } from "../renderSection.js";
import { items, sectionKey, withAnchor } from "../helpers.js";

export const renderMetrics: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
    <Metrics02
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      cta={section.action}
      metrics={items(section).map((item) => ({
        value: item.value ?? "",
        label: item.title ?? item.label ?? "",
      }))}
    />
  ));
};
