function readTimeParts(timeKey) {
  if (typeof timeKey !== "string") return null;
  const match = timeKey.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  return { hour: hour === 24 ? 0 : hour, minute };
}

export function formatTimeKey12Hour(timeKey) {
  const parts = readTimeParts(timeKey);
  if (!parts) return "--:--";
  const period = parts.hour >= 12 ? "PM" : "AM";
  const hour12 = parts.hour % 12 || 12;
  const minute = String(parts.minute).padStart(2, "0");
  return `${hour12}:${minute} ${period}`;
}
