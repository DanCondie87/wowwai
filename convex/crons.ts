import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// US-062: Check for blocked tasks every 30 minutes
// Sends notification if a task assigned to Dali is blocked and
// no notification was sent in the last 4 hours.
// Respects quiet hours (23:00-08:00 Sydney time).
crons.interval(
  "check blocked tasks",
  { minutes: 30 },
  internal.notifications.processBlockerNotifications
);

// US-063: Auto-expire stale agent activity
// Marks agent activity as "idle" if no heartbeat received in 30 minutes.
// This ensures the pulsing 🦈 indicator doesn't get stuck.
crons.interval(
  "expire stale agent activity",
  { minutes: 5 },
  internal.agentActivity.expireStale
);

export default crons;
