export function assertInboxOwnership(
  ownerId: string,
  inboxId: string,
  rawBindings = process.env.AGENTMAIL_INBOX_BINDINGS,
) {
  if (!rawBindings)
    throw new Error("AGENTMAIL_INBOX_BINDINGS is not configured.");

  let bindings: unknown;
  try {
    bindings = JSON.parse(rawBindings);
  } catch {
    throw new Error("AGENTMAIL_INBOX_BINDINGS must be valid JSON.");
  }

  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings))
    throw new Error("AGENTMAIL_INBOX_BINDINGS must map owners to inboxes.");
  const allowed = (bindings as Record<string, unknown>)[ownerId];
  if (
    !Array.isArray(allowed) ||
    !allowed.some((value) => value === inboxId.trim())
  )
    throw new Error("This AgentMail inbox is not assigned to your account.");
}
