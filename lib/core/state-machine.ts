import type { CandidateStatus } from "@/lib/types";

const CANDIDATE_TRANSITIONS: Record<
  CandidateStatus,
  readonly CandidateStatus[]
> = {
  ready: ["sending", "dismissed", "no_contact"],
  sending: ["sent", "send_failed", "send_unknown"],
  sent: [],
  dismissed: [],
  send_failed: ["sending", "dismissed"],
  send_unknown: [],
  no_contact: ["ready", "dismissed"],
};

export function canTransitionCandidate(
  from: CandidateStatus,
  to: CandidateStatus,
): boolean {
  return CANDIDATE_TRANSITIONS[from].includes(to);
}

export function assertCandidateTransition(
  from: CandidateStatus,
  to: CandidateStatus,
) {
  if (!canTransitionCandidate(from, to)) {
    throw new Error(`Invalid candidate transition: ${from} → ${to}`);
  }
}
