export const assetBuild = "mantle-starter-assets-20260729-cold-start";

export function asset(path: string): string {
  return `${path}?v=${assetBuild}`;
}
