/**
 * D225 limits for the multi-day planning tools. Drafts may be prepared further ahead than plans are published,
 * because a published date blocks branch opening/closing changes until that date is re-planned.
 * Single-day drafting and publication are not limited by these numbers.
 */
export const DRAFT_AHEAD_DAYS = 30;
export const PUBLISH_AHEAD_DAYS = 14;
export const RANGE_MAX_DAYS = 31;

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
/** Monday of the week containing the date (weeks run Monday to Sunday). */
export const weekStart = (iso: string) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
