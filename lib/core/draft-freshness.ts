export function draftMatchesSenderIdentity(
  draft: { senderFounderName?: string; senderAgentName?: string },
  project: { founderName: string; agentName: string },
) {
  return (
    draft.senderFounderName === project.founderName &&
    draft.senderAgentName === project.agentName
  );
}
