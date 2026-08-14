import { DiagnosticError } from "@aotter/mantle/spec";
import type { CmsRuntime } from "@aotter/mantle/runtime";
import { bindMantleSite } from "../../../.mantle/generated/site.js";
import type { HomeContent, HomeSection } from "./types.js";

export async function resolveHomeContent(
  getRuntime: () => Promise<CmsRuntime>,
  locale: string,
): Promise<HomeContent> {
  const runtime = await getRuntime();
  const site = bindMantleSite(runtime);
  const pageResult = await site.views["home"]({ params: { locale } });
  if (!pageResult.ok) throw new DiagnosticError(pageResult.diagnostic);
  return {
    sections: pageResult.result.rows[0]?.sections as readonly HomeSection[] | undefined ?? [],
  };
}
