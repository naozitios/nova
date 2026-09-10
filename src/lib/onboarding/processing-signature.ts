export function processingRunSignature(
  businessId: string,
  sources: Array<{ id: string }>,
): string {
  const sourceIds = sources.map((source) => source.id).sort().join(',');
  return `${businessId}:${sourceIds}`;
}
