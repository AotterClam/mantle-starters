import { DiagnosticError } from "@aotter/mantle/spec";
import type { MantleRuntime } from "@aotter/mantle/runtime";

type SeedEntry = Readonly<Record<string, unknown>>;
type SeedFile = {
  readonly collections?: Readonly<Record<string, readonly SeedEntry[]>>;
  readonly locales?: Readonly<Record<string, Readonly<Record<string, readonly SeedEntry[]>>>>;
};

const SEED_MARKER = "initial-v1";

export function createInitialSeedRuntime<Env extends { readonly DB: D1Database }>(
  seed: SeedFile,
  getRuntime: (env: Env) => Promise<MantleRuntime>,
): (env: Env) => Promise<MantleRuntime> {
  let seeded: Promise<MantleRuntime> | null = null;
  return (env) => {
    if (seeded) return seeded;
    seeded = getRuntime(env)
      .then(async (runtime) => {
        if (await hasInitialSeed(env.DB)) return runtime;
        await seedInitialContent(runtime, seed);
        await markInitialSeed(env.DB);
        return runtime;
      })
      .catch((error) => {
        seeded = null;
        throw error;
      });
    return seeded;
  };
}

async function hasInitialSeed(db: D1Database): Promise<boolean> {
  try {
    return await db
      .prepare("SELECT 1 FROM _mantle_starter_seed WHERE id = ? LIMIT 1")
      .bind(SEED_MARKER)
      .first() !== null;
  } catch (error) {
    if (String(error).includes("no such table: _mantle_starter_seed")) return false;
    throw error;
  }
}

async function markInitialSeed(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS _mantle_starter_seed (id TEXT PRIMARY KEY)"),
    db.prepare("INSERT OR IGNORE INTO _mantle_starter_seed (id) VALUES (?)").bind(SEED_MARKER),
  ]);
}

async function seedInitialContent(runtime: MantleRuntime, seed: SeedFile): Promise<void> {
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

async function seedEntry(runtime: MantleRuntime, collection: string, entry: SeedEntry): Promise<void> {
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
  runtime: MantleRuntime,
  collection: string,
  data: Readonly<Record<string, unknown>>,
) {
  const locale = typeof data.locale === "string" ? data.locale : undefined;
  if (typeof data.slug === "string") {
    return runtime.entries.readBySlug({ collection, slug: data.slug, locale });
  }
  if (typeof data.type === "string") {
    return runtime.entries.readByDataField({ collection, field: "type", value: data.type, locale });
  }
  if (typeof data.productSlug === "string") {
    return runtime.entries.readByDataField({ collection, field: "productSlug", value: data.productSlug, locale });
  }
  throw new Error(`Initial seed ${collection} entry needs a stable slug, type, or productSlug.`);
}
