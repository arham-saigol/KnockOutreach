import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 15:15 Asia/Karachi (UTC+5) = 10:15 UTC. At this time the workflow fetches
// the previous, fully completed America/Los_Angeles calendar day.
crons.daily(
  "global Product Hunt discovery",
  { hourUTC: 10, minuteUTC: 15 },
  internal.pipeline.startScheduled,
);

// Project-specific nextRefreshAt timestamps make this a rolling weekly refresh.
crons.daily(
  "refresh due project knowledge",
  { hourUTC: 11, minuteUTC: 0 },
  internal.projects.startDueRefreshes,
);

export default crons;
