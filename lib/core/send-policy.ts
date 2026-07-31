const CONTACTING_STATES = new Set([
  "sending",
  "sent",
  "delivered",
  "received",
  "send_unknown",
]);

export function hasConflictingSend(sends: Array<{ status: string }>) {
  return sends.some((send) => CONTACTING_STATES.has(send.status));
}

export function assertNoDuplicateSend(sends: Array<{ status: string }>) {
  if (hasConflictingSend(sends))
    throw new Error("This recipient already has an active or completed send.");
}
