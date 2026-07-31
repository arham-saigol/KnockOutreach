export type ProjectStatus = "crawling" | "synthesizing" | "ready" | "failed";

export type CandidateStatus =
  | "ready"
  | "sending"
  | "sent"
  | "dismissed"
  | "send_failed"
  | "send_unknown"
  | "no_contact";

export interface ExclusionRules {
  keywords: string[];
  domains: string[];
  categories: string[];
  notes: string;
  cooldownDays: number;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  founderName: string;
  agentName: string;
  inboxId: string;
  status: ProjectStatus;
  knowledgeVersion: number;
  exclusions: ExclusionRules;
}

export interface Candidate {
  id: string;
  projectId: string;
  name: string;
  tagline: string;
  thumbnailUrl?: string;
  productHuntUrl: string;
  websiteUrl: string;
  companyContext: string;
  recipientEmail?: string;
  emailConfidence?: number;
  emailEvidenceUrl?: string;
  alternativeEmails: string[];
  matchReason: string;
  subject: string;
  body: string;
  status: CandidateStatus;
  completedAt?: number;
  error?: string;
}

export interface DailyRun {
  id: string;
  day: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: string;
  counts: {
    fetched: number;
    eligible: number;
    enriched: number;
    drafted: number;
    failed: number;
  };
  startedAt: number;
  completedAt?: number;
  error?: string;
}
