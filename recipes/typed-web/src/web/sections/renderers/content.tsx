import { Content01 } from "@/components/blocks/marketing/content-01";
import { asset } from "../../assets.js";
import type { SectionRenderer } from "../renderSection.js";
import { items, sectionKey, withAnchor } from "../helpers.js";

export const renderContent: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
    <Content01
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      paragraphs={items(section).map((item) => item.body ?? "").filter(Boolean)}
      image={section.image ? { ...section.image, src: asset(section.image.src) } : undefined}
      showImage={section.showImage}
    />
  ));
};
