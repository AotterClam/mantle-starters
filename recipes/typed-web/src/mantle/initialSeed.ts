import { DiagnosticError } from "@aotter/mantle/spec";
import type { CmsRuntime } from "@aotter/mantle/runtime";

type SeedEntry = Readonly<Record<string, unknown>>;
type SeedFile = {
  readonly collections?: Readonly<Record<string, readonly SeedEntry[]>>;
  readonly locales?: Readonly<Record<string, Readonly<Record<string, readonly SeedEntry[]>>>>;
};

export function createInitialSeedRuntime<Env>(
  seed: SeedFile,
  getRuntime: (env: Env) => Promise<CmsRuntime>,
): (env: Env) => Promise<CmsRuntime> {
  // ponytail: entry identity is the seed marker; add durable metadata only if hard-deleted starter rows must stay deleted.
  let seeded: Promise<CmsRuntime> | null = null;
  return (env) => {
    if (seeded) return seeded;
    seeded = getRuntime(env)
      .then(async (runtime) => {
        await seedInitialContent(runtime, seed);
        return runtime;
      })
      .catch((error) => {
        seeded = null;
        throw error;
      });
    return seeded;
  };
}

async function seedInitialContent(runtime: CmsRuntime, seed: SeedFile): Promise<void> {
  for (const [collection, entries] of seedEntries(seed)) {
    for (const entry of entries) await seedEntry(runtime, collection, entry);
  }
}

function seedEntries(seed: SeedFile): Array<readonly [string, readonly SeedEntry[]]> {
  return [
    ...Object.entries(seed.collections ?? {}),
    ...Object.values(seed.locales ?? {}).flatMap((pack) => Object.entries(pack)),
  ];
}

async function seedEntry(runtime: CmsRuntime, collection: string, entry: SeedEntry): Promise<void> {
  const { status, ...data } = entry;
  if (status !== "draft" && status !== "published") {
    throw new Error(`Initial seed ${collection} entry must declare draft or published status.`);
  }
  if (await findSeedEntry(runtime, collection, data)) return;

  let created;
  try {
    created = await runtime.createDraft.execute({ collection, data, authorId: null });
  } catch (error) {
    if (!(error instanceof DiagnosticError) || error.diagnostic.code !== "CONFLICT") throw error;
    if (!await findSeedEntry(runtime, collection, data)) throw error;
    return;
  }
  if (status === "published") await runtime.requestPublish.execute({ id: created.id });
}

async function findSeedEntry(
  runtime: CmsRuntime,
  collection: string,
  data: Readonly<Record<string, unknown>>,
) {
  const locale = typeof data.locale === "string" ? data.locale : undefined;
  if (typeof data.slug === "string") {
    return runtime.entryReader.readBySlug({ collection, slug: data.slug, locale });
  }
  if (typeof data.type === "string") {
    return runtime.entryReader.readByDataField({ collection, field: "type", value: data.type, locale });
  }
  if (typeof data.productSlug === "string") {
    return runtime.entryReader.readByDataField({ collection, field: "productSlug", value: data.productSlug, locale });
  }
  throw new Error(`Initial seed ${collection} entry needs a stable slug, type, or productSlug.`);
}
