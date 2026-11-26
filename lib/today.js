// All "today" lookups use New York time regardless of the server's clock
export const TIME_ZONE = "America/New_York";

// Returns { month, day } for the current date in New York (month is 1-12)
export const getToday = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { month: get("month"), day: get("day") };
};
