/**
 * D225 departure status of a published trip as people see it in search and trip lists.
 * "รถออกแล้ว" is shown only when a departure was actually recorded. Without a record the status is
 * derived from the planned time and is worded as the plan, never as a fact about the vehicle.
 */
export type DepartureCode = "CANCELLED" | "UNKNOWN" | "WAITING" | "DUE" | "DEPARTED";
export interface DepartureStatus { code: DepartureCode; text: string; detail: string }

const clock = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export function departureStatus(trip: { cancelled: boolean; departureAt: string | null; departedAt: string | null }, now: Date): DepartureStatus {
  if (trip.cancelled) return { code: "CANCELLED", text: "ยกเลิก", detail: "รอบรถนี้ถูกยกเลิก" };
  if (trip.departedAt) return { code: "DEPARTED", text: "รถออกแล้ว", detail: `บันทึกรถออกเมื่อ ${clock(trip.departedAt)} น.` };
  if (!trip.departureAt) return { code: "UNKNOWN", text: "ยังไม่ระบุเวลาออก", detail: "แผนยังไม่ระบุเวลาออกรถ" };
  return new Date(trip.departureAt) > now
    ? { code: "WAITING", text: "ยังไม่ถึงเวลาออก", detail: `ออกตามแผน ${clock(trip.departureAt)} น.` }
    : { code: "DUE", text: "ถึงเวลาออกตามแผนแล้ว", detail: `แผนออก ${clock(trip.departureAt)} น. ยังไม่มีการบันทึกรถออก` };
}
