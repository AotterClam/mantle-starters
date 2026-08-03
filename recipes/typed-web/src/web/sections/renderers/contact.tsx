import { Contact02 } from "@/components/blocks/marketing/contact-02";
import type { SectionRenderer } from "../renderSection.js";
import { contactIcon, items, sectionKey, withAnchor } from "../helpers.js";

export const renderContact: SectionRenderer = (section, index) => {
  const key = sectionKey(section, index);
  return withAnchor(section, key, (
    <Contact02
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.body}
      items={items(section).map((item) => ({
        icon: contactIcon(item.icon),
        title: item.title ?? "",
        description: item.body ?? "",
        value: item.value ?? "",
        href: item.href,
      }))}
      footerTitle={section.footerTitle}
      footerDescription={section.footerBody}
      footerCta={section.footerAction}
    />
  ));
};
