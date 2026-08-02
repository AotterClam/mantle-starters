# Publication overlay

Use this when the launch type intent is `publication`.

First useful shape:

- edit the public homepage directly in `public/index.html`;
- keep `posts` as the core Schema;
- expose `published-posts` at `/api/views/published-posts`;
- replace the seeded publication cards and posts before adding custom
  archive/detail routes.

Use `mantle:theme` for brand and layout polish after the content model works.

Do not restore the old publication-specific starter or `theme.default`
path. Publication uses the same minimal Worker façade as every other type.
