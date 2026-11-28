/**
 * Resolves a public/ static asset path against Vite's configured BASE_URL so
 * root-hosted previews ("/") and subpath production deployments ("/app/" or "./")
 * both load static workers and sprites without broken 404 paths.
 */
export function resolvePublicAssetUrl(assetPath: string, baseUrl?: string): string {
  const rawBase =
    baseUrl ??
    (typeof import.meta !== 'undefined' &&
    typeof (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL === 'string'
      ? (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env!.BASE_URL!
      : '/');

  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const cleanAsset = assetPath.replace(/^\/+/, '');
  return `${normalizedBase}${cleanAsset}`;
}
