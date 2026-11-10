type ConsoleAssetPathInput = { readonly key: string; readonly isAsset: boolean; readonly hasExtension: boolean };

export function consoleAssetPath({ key, isAsset, hasExtension }: ConsoleAssetPathInput): string {
  if (!isAsset && !hasExtension) {
    return '/index.html';
  }

  return `/${key}`;
}
