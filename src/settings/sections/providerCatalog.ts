export type ProviderCatalogSearchItem = {
  id: string;
  label: string;
  description: string;
  modelLabels: readonly string[];
};

export function filterProviderCatalog<T extends ProviderCatalogSearchItem>(
  providers: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...providers];

  return providers.filter((provider) =>
    [
      provider.id,
      provider.label,
      provider.description,
      ...provider.modelLabels,
    ].some((value) => value.toLowerCase().includes(needle)),
  );
}
