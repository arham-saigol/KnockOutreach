export function assertCompleteClassification(
  requestedIds: string[],
  resultIds: string[],
) {
  const requested = new Set(requestedIds);
  const seen = new Set<string>();

  for (const id of resultIds) {
    if (!requested.has(id))
      throw new Error(`Universal classification returned unknown ID: ${id}`);
    if (seen.has(id))
      throw new Error(`Universal classification duplicated ID: ${id}`);
    seen.add(id);
  }

  if (seen.size !== requested.size)
    throw new Error("Universal classification omitted one or more launches");
}
