# Publication seed prompt

Initial page and post entries are written to D1 from
`.mantle/overlays/publication/seed.json`:

- `site` controls nav/footer/brand metadata.
- `collections.page[0].sections` controls every visible homepage block.
- `collections.posts` owns stable slugs; `collections.post-translations`
  owns the locale-specific copy to replace.

Create two short published posts and one draft for `{{BRAND}}` in the
canonical locale. One post should explain the site's purpose. One should
demonstrate a normal update/news entry. Keep copy short enough to inspect
in local preview.
