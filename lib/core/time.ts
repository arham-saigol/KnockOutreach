export function productHuntDay(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, date] = day.split("-").map(Number);
  const start = zonedMidnight(year, month, date);
  const followingDate = new Date(Date.UTC(year, month - 1, date + 1));
  const end = zonedMidnight(
    followingDate.getUTCFullYear(),
    followingDate.getUTCMonth() + 1,
    followingDate.getUTCDate(),
  );
  return {
    day,
    postedAfter: start.toISOString(),
    postedBefore: end.toISOString(),
  };
}

export function completedProductHuntDay(now = new Date()) {
  return productHuntDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

function zonedMidnight(year: number, month: number, date: number) {
  const localMidnightAsUtc = Date.UTC(year, month - 1, date);
  let instant = localMidnightAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = offsetMinutes(new Date(instant));
    const resolved = localMidnightAsUtc - offset * 60_000;
    if (resolved === instant) break;
    instant = resolved;
  }

  return new Date(instant);
}

function offsetMinutes(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(instant);
  const offset =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-08:00";
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  return match
    ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
    : -480;
}
