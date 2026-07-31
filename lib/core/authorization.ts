export function assertOwnedRecord<
  T extends { ownerId: string } | null | undefined,
>(
  record: T,
  subject: string,
  label = "Record",
): asserts record is Exclude<T, null | undefined> {
  if (!record || record.ownerId !== subject)
    throw new Error(`${label} not found`);
}
