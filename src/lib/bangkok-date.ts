export function bangkokServiceDate(instant = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function thaiServiceDate(serviceDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new Error("INVALID_SERVICE_DATE");
  const date = new Date(`${serviceDate}T00:00:00+07:00`);
  if (Number.isNaN(date.valueOf()) || bangkokServiceDate(date) !== serviceDate) throw new Error("INVALID_SERVICE_DATE");
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric",
  }).format(date);
}
