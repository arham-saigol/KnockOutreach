export function isDuplicateWebhook(
  existingEventId: string | undefined,
  incomingEventId: string,
) {
  return existingEventId === incomingEventId;
}
