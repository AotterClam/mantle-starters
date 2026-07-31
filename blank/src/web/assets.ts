export const assetBuild = "mantle-starter-assets-20260731-intake-a11y";

export function asset(path: string): string {
  return `${path}?v=${assetBuild}`;
}
