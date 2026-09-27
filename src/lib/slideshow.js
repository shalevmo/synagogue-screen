/**
 * Slideshow image-transition logic.
 *
 * The holiday <img> in App.jsx is keyed by `imageUrl`: React reuses the same
 * DOM node (and the browser fires NO new load event) whenever the key is
 * unchanged. The "did the image change?" check MUST therefore compare by
 * imageUrl as well — resetting on anything else (e.g. Firestore doc identity)
 * re-arms the decode gate with no load event to clear it, and the poster is
 * silently never shown again.
 *
 * Incident (Rosh Hashana 5787, 2026-09-11): the schedule was split across the
 * Hebrew year boundary into two docs (27–29 Elul 5786 + 1–2 Tishrei 5787)
 * sharing ONE imageUrl. At tzeit on erev RH the display date rolled to the
 * next day, the active doc switched, the old doc-identity comparison reset
 * imageReady — and with no new load event, the poster stayed hidden through
 * the entire holiday.
 */

/** The image identity that matters for DOM keying / reset decisions */
export function activeImageUrl(image) {
  return image?.imageUrl ?? null;
}

/**
 * Decide whether switching to `nextImage` requires a slideshow reset
 * (back to default view + re-arm the decode/readiness gate).
 * Pure — safe to call during render.
 *
 * @param {string|null} prevUrl - imageUrl of the previously active image
 * @param {object|null} nextImage - newly active image doc (or null)
 * @returns {boolean} true when the displayed image must restart
 */
export function needsImageReset(prevUrl, nextImage) {
  return activeImageUrl(nextImage) !== prevUrl;
}