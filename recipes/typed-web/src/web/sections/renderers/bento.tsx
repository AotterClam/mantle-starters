import { Bento02 } from "@/components/blocks/marketing/bento-02";
import type { SectionRenderer } from "../renderSection.js";
import { items, sectionKey, withAnchor } from "../helpers.js";

export const renderBento: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  const [mainItem, ...cardItems] = items(section);
  return withAnchor(section, key, (
    <Bento02
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      mainCard={{
        title: mainItem?.title ?? section.title,
        description: mainItem?.body ?? section.body ?? "",
      }}
      cards={cardItems.map((item) => ({
        title: item.title ?? "",
        description: item.body ?? "",
      }))}
    />
  ));
};
