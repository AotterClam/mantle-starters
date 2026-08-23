import catalog from "../../.mantle/overlays/intake/messages.json";

type Messages = (typeof catalog.locales)[keyof typeof catalog.locales];

export function messagesForLocale(locale: string): Messages {
  const locales = catalog.locales as unknown as Record<string, Messages>;
  const key = Object.keys(locales).find((candidate) => candidate.toLowerCase() === locale.toLowerCase());
  return locales[key ?? catalog.canonicalLocale] ?? Object.values(locales)[0]!;
}
