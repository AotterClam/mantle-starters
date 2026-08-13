# Presence seed prompt

Create short homepage copy for `{{BRAND}}` in the canonical locale.
Keep the first screen useful without requiring images. The homepage is
initially written to D1 from `.mantle/overlays/presence/seed.json`: `site` controls
nav/footer/brand metadata, and `collections.page[0].sections` controls
every visible homepage section. The result should fit the `page` Schema
with one `home` page. Keep the homepage as an ordered `sections` array
using these section types when they are useful:
hero, socialProof, content, features, bento, metrics, testimonials, faq,
contact, form, and cta.

Do not seed fake contact records. Real messages are created through the public
Procedure and remain subject to Turnstile and notification lifecycle hooks.
