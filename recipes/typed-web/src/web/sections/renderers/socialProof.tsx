import { SocialProof02 } from "@/components/blocks/marketing/social-proof-02";
import type { SectionRenderer } from "../renderSection.js";
import { items, sectionKey } from "../helpers.js";

export const renderSocialProof: SectionRenderer = (section, index) => (
  <SocialProof02
    key={sectionKey(section, index)}
    class="mantle-social-proof"
    title={section.title}
    logos={items(section).map((item) => ({
      name: item.title ?? item.name ?? "",
      mark: item.mark ?? 1,
    }))}
  />
);
