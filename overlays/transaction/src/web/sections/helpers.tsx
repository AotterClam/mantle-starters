import type { Child, FC } from "hono/jsx";
import {
  ChatIcon,
  CheckCircleIcon,
  HandshakeIcon,
  LayoutIcon,
  ShieldIcon,
  SparklesIcon,
} from "@/components/ui/icon";
import type { HomeItem, HomeSection } from "../content/types.js";

const featureIcons: Record<string, FC<{ class?: string }>> = {
  chat: ChatIcon,
  check: CheckCircleIcon,
  handshake: HandshakeIcon,
  layout: LayoutIcon,
  shield: ShieldIcon,
  sparkles: SparklesIcon,
};

export function sectionKey(section: HomeSection, index: number): string {
  return `${section.type}-${section.id ?? index}`;
}

export function withAnchor(section: HomeSection, key: string, child: Child): Child {
  return section.id ? (
    <div key={key} id={section.id}>{child}</div>
  ) : child;
}

export function items(section: HomeSection): readonly HomeItem[] {
  return section.items ?? [];
}

export function featureIcon(name: string | undefined): FC<{ class?: string }> {
  return featureIcons[name ?? "sparkles"] ?? SparklesIcon;
}
