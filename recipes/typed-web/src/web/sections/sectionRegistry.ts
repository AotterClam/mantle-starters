import type { HomeSection } from "../content/types.js";
import type { SectionRenderer } from "./renderSection.js";
import { renderBento } from "./renderers/bento.js";
import { renderContact } from "./renderers/contact.js";
import { renderContent } from "./renderers/content.js";
import { renderCta } from "./renderers/cta.js";
import { renderFaq } from "./renderers/faq.js";
import { renderFeatures } from "./renderers/features.js";
import { renderForm } from "./renderers/form.js";
import { renderHero } from "./renderers/hero.js";
import { renderIntake } from "./renderers/intake.js";
import { renderMetrics } from "./renderers/metrics.js";
import { renderSocialProof } from "./renderers/socialProof.js";
import { renderTestimonials } from "./renderers/testimonials.js";

export const sectionRenderers: Partial<Record<HomeSection["type"], SectionRenderer>> = {
  bento: renderBento,
  contact: renderContact,
  content: renderContent,
  cta: renderCta,
  faq: renderFaq,
  features: renderFeatures,
  form: renderForm,
  hero: renderHero,
  intake: renderIntake,
  metrics: renderMetrics,
  socialProof: renderSocialProof,
  testimonials: renderTestimonials,
};
