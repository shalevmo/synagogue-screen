/**
 * Single source of truth for the kiosk's fallback data — what the screen
 * shows when Firestore is unreachable, empty, or holds a bad value.
 *
 * Plain module (no Firebase, no React) so node scripts can import it too.
 */

import { HDate, Location, Zmanim } from '@hebcal/core';

/** Netivot — the synagogue's location */
export const DEFAULT_LOCATION = Object.freeze({
  lat: 31.42215,
  lng: 34.58858,
  timezone: 'Asia/Jerusalem',
  name: 'Netivot, Israel',
  elevation: 0,
});

/** Shape of /config/app-config, with every field filled in */
export const DEFAULT_CONFIG = Object.freeze({
  defaultViewDuration: 15,  // seconds
  imageDisplayDuration: 15, // seconds
  title: 'משכן שמואל',
  location: DEFAULT_LOCATION,
});

/** Shown when /prayers is empty or unavailable */
export const DEFAULT_PRAYERS = Object.freeze([
  { name: 'שחרית של חול',     time: '07:00' },
  { name: 'מנחה וקבלת שבת',   time: 'עם כניסת השבת' },
  { name: 'שחרית של שבת',     time: '08:00' },
  { name: 'מנחה של שבת',      time: '13:15' },
  { name: 'ערבית של מוצ״ש',   time: '5 דקות לפני צאת השבת' },
]);

function buildLocation(loc) {
  return new Location(loc.lat, loc.lng, true, loc.timezone, loc.elevation);
}

/**
 * Build a hebcal Location from a (possibly partial or garbage) Firestore
 * `location` value. Missing fields fall back per-field to DEFAULT_LOCATION.
 * A bad doc (garbage lat or timezone) would otherwise throw inside every
 * zmanim computation and white-screen the kiosk, so validate by construction:
 * smoke-run a sunrise and fall back to the default location if it throws.
 */
export function toHebcalLocation(loc) {
  try {
    const candidate = buildLocation({ ...DEFAULT_LOCATION, ...stripNullish(loc) });
    new Zmanim(candidate, new HDate()).sunrise(); // validates tz + coords
    return candidate;
  } catch {
    console.warn('Bad config.location, falling back to Netivot default');
    return buildLocation(DEFAULT_LOCATION);
  }
}

/** Drop null/undefined fields so a spread over defaults behaves like `??` */
function stripNullish(obj) {
  if (!obj || typeof obj !== 'object') return {};
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}

/**
 * Normalize a raw /config/app-config doc: every field present, per-field
 * fallback to DEFAULT_CONFIG. Unknown fields are dropped.
 */
export function normalizeConfig(data) {
  const d = stripNullish(data);
  return {
    defaultViewDuration: d.defaultViewDuration ?? DEFAULT_CONFIG.defaultViewDuration,
    imageDisplayDuration: d.imageDisplayDuration ?? DEFAULT_CONFIG.imageDisplayDuration,
    title: d.title ?? DEFAULT_CONFIG.title,
    location: d.location ?? DEFAULT_CONFIG.location,
  };
}
