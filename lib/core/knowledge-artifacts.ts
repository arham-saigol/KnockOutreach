type SourceArtifact = {
  url: string;
  hash: string;
  storageId?: string;
};

export function sourceArtifactIsVersioned(
  page: { url: string; contentHash: string; storageId?: string },
  versionSources: SourceArtifact[][],
) {
  return versionSources.some((sources) =>
    sources.some(
      (source) =>
        (Boolean(page.storageId) && source.storageId === page.storageId) ||
        (!source.storageId &&
          source.url === page.url &&
          source.hash === page.contentHash),
    ),
  );
}
