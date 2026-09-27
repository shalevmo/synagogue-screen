/**
 * Poster (slideshow image) scheduling — which /images doc is active on a
 * given Hebrew date. Single source for lib/displayData.js and scripts/verify-slideshow.mjs.
 *
 * Schedule fields (see the /images schema in src/hooks/useFirestore.js):
 *   startMonth/startDay, endMonth/endDay — hebcal month index
 *     (1=Nisan … 7=Tishrei … 12=Adar / Adar I, 13=Adar II), inclusive range
 *   year — null/undefined = every year; otherwise must equal the Hebrew year
 *
 * Month numbering starts at Nisan, so a range whose start is after its end
 * in that numbering (e.g. Adar 12 → Nisan 1) is treated as wrapping around.
 * A range across Rosh Hashana (Elul 6 → Tishrei 7) does NOT wrap and needs
 * no special handling — but a year-pinned schedule must be split into two
 * docs there, since the Hebrew year changes at 1 Tishrei.
 */

/** Month/day → comparable integer (30-day months; ordering is all that matters) */
function packMonthDay(month, day) {
  return (month - 1) * 30 + day;
}

/** Whether Hebrew (month, day) falls inside the inclusive [start, end] range */
export function isDateInRange(hMonth, hDay, startMonth, startDay, endMonth, endDay) {
  const t = packMonthDay(hMonth, hDay);
  const s = packMonthDay(startMonth, startDay);
  const e = packMonthDay(endMonth, endDay);
  if (s <= e) return t >= s && t <= e;
  return t >= s || t <= e; // wrap-around
}

/** Whether one /images doc is scheduled for the given Hebrew date + year */
export function isImageActive(image, hMonth, hDay, hYear) {
  if (image.year != null && image.year !== hYear) return false;
  return isDateInRange(
    hMonth, hDay,
    image.startMonth, image.startDay,
    image.endMonth, image.endDay,
  );
}

/** First active image for the Hebrew date/year, or null */
export function findActiveImage(images, hMonth, hDay, hYear) {
  if (!images || images.length === 0) return null;
  return images.find(img => isImageActive(img, hMonth, hDay, hYear)) || null;
}
