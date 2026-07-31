import type {
  GenericMutationCtx,
  GenericQueryCtx,
  AnyDataModel,
} from "convex/server";
import type { Id } from "../_generated/dataModel";
import { assertOwnedRecord } from "../../lib/core/authorization";

type ReadCtx = GenericQueryCtx<AnyDataModel> | GenericMutationCtx<AnyDataModel>;

export async function requireIdentity(ctx: ReadCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity;
}

export async function requireProject(ctx: ReadCtx, projectId: Id<"projects">) {
  const identity = await requireIdentity(ctx);
  const project = await ctx.db.get(projectId);
  assertOwnedRecord(project as any, identity.subject, "Project");
  return { identity, project };
}

export async function requireCandidate(
  ctx: ReadCtx,
  candidateId: Id<"projectCandidates">,
) {
  const identity = await requireIdentity(ctx);
  const candidate = await ctx.db.get(candidateId);
  assertOwnedRecord(candidate as any, identity.subject, "Candidate");
  return { identity, candidate };
}
