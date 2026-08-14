import { toUrlLocale } from "@aotter/mantle/runtime";

export const LOCALE_COOKIE = "mantle_locale";

export function localeRootResponse(
  request: Request,
  locales: readonly string[],
  canonicalLocale: string,
): Response {
  const locale = rememberedLocale(request.headers.get("cookie"), locales)
    ?? acceptedLocale(request.headers.get("accept-language"), locales)
    ?? locales.find((candidate) => candidate.toLowerCase() === canonicalLocale.toLowerCase())
    ?? locales[0]
    ?? "en";
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store",
      Location: `/${toUrlLocale(locale)}`,
      Vary: "Cookie, Accept-Language",
    },
  });
}

function rememberedLocale(cookie: string | null, locales: readonly string[]): string | undefined {
  const value = cookie?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.slice(1).join("=");
  if (!value) return undefined;
  try {
    const locale = decodeURIComponent(value).toLowerCase();
    return locales.find((candidate) => candidate.toLowerCase() === locale);
  } catch {
    return undefined;
  }
}

function acceptedLocale(header: string | null, locales: readonly string[]): string | undefined {
  const requested = (header ?? "").split(",").map((part, index) => {
    const [tag = "", ...parameters] = part.trim().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="))?.split("=")[1];
    return { tag: tag.toLowerCase(), quality: quality === undefined ? 1 : Number(quality), index };
  }).filter(({ tag, quality }) => tag !== "*" && tag !== "" && Number.isFinite(quality) && quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const { tag } of requested) {
    const exact = locales.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;
    const language = tag.split("-")[0];
    const compatible = locales.find((locale) => locale.toLowerCase().split("-")[0] === language);
    if (compatible) return compatible;
  }
  return undefined;
}
