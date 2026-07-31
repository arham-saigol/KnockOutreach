export function productHuntDay(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, date] = day.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, date, 12));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(noonUtc);
  const offset =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-08:00";
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = match
    ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
    : -480;
  const start = new Date(Date.UTC(year, month - 1, date) - minutes * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    day,
    postedAfter: start.toISOString(),
    postedBefore: end.toISOString(),
  };
}
