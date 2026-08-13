# Publication overlay

Use this when the launch type intent is `publication`.

First useful shape:

- keep the public homepage driven by
  `.mantle/overlays/publication/seed.json`;
- use `site` for nav/footer/brand metadata and
  `collections.page[0].sections` for every visible homepage block;
- keep `posts` as the stable parent and `post-translations` as its localized child;
- expose `published-posts` at `/api/views/published-posts`;
- replace the seeded publication cards and posts before adding custom
  archive/detail routes.

Use `mantle:theme` for brand and visual polish after the content
model works.

Do not restore the old publication-specific starter or `theme.default`
path. Publication now grows from the shared typed-web runtime as presence
and intake.
