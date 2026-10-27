import { isValidPublicationWindow } from "../../../backend/publicationSchedule.mjs";

function monthDays(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return [];
  const [year, mm] = month.split("-").map(Number);
  const total = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  return Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}
function madridDay(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Madrid", year:"numeric",month:"2-digit",day:"2-digit" }).formatToParts(new Date(iso));
  const item = Object.fromEntries(parts.map(({type,value})=>[type,value]));
  return `${item.year}-${item.month}-${item.day}`;
}
export function campaignMonth(month, campaigns) {
  const days = monthDays(month);
  const calendar = days.map((date) => ({ date, campaigns: [] }));
  for (const campaign of Array.isArray(campaigns) ? campaigns : []) {
    const window = campaign?.schedule;
    if (!window?.startAt || !isValidPublicationWindow(window)) continue;
    const start = madridDay(window.startAt);
    const end = window.endAt ? madridDay(window.endAt) : null;
    const finalEndIsMidnight = window.endAt
      ? new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Madrid",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(window.endAt)) === "00:00"
      : false;
    for (const day of calendar) {
      if (day.date >= start && (!end || (finalEndIsMidnight ? day.date < end : day.date <= end))) {
        day.campaigns.push({ id: String(campaign.id || ""), title: String(campaign.title || ""), enabled: campaign.enabled !== false });
      }
    }
  }
  return calendar;
}
