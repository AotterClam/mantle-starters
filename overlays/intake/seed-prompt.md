# Intake seed prompt

Create short homepage copy for `{{BRAND}}` in the canonical locale. Keep
the homepage visitor-facing: explain the intake, then drive to one
multi-step branching form.

The homepage is initially written to D1 from `.mantle/overlays/intake/seed.json`:
`site` controls nav/footer/brand metadata, and
`collections.page[0].sections` controls every visible homepage section.
Use `intake` for the main form section. Keep fields flat enough to store
directly in the `intake-submissions` Schema.

Use the RSVP/application shape unless the owner asks for quiz scoring:
name, email, one decision question, conditional follow-up fields, and
result copy keyed by the decision answer.

Keep `seed.locale` aligned with the page being rendered; the intake form
submits that render context as `replyLocale`. If routing selects a locale at
request time, pass it to `HomePage`. Do not add `locale` to
`intake-submissions`: Mantle reserves `data.locale` for localized entries.

Do not seed fake submissions. Real responses are created through the public
Procedure and remain subject to Turnstile and notification lifecycle hooks.
