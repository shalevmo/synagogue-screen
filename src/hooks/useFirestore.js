/**
 * Firestore hook — fetches and subscribes to app config + prayers + image schedules.
 *
 * Firestore schema (fallback values live in src/lib/defaults.js):
 *
 *   /config/app-config
 *     defaultViewDuration: number (seconds to show default view, default 15)
 *     imageDisplayDuration: number (seconds to show image before switching back, default 15)
 *     location: { lat, lng, timezone, name, elevation }
 *     title: string (synagogue name, default "משכן שמואל")
 *
 *   /prayers/{autoId}
 *     order: number
 *     name:  string  (Hebrew)
 *     time:  string  ("07:00" or "עם כניסת השבת")
 *
 *   /images/{autoId}   (active-date logic: src/lib/imageSchedule.js)
 *     name:      string   (display name / description)
 *     imageUrl:  string   (Firebase Storage URL or any public URL)
 *     startDay:  number   (1-30)
 *     startMonth: number  (1=Nisan … 7=Tishrei … 12=Adar I, 13=Adar II — Jewish calendar month index)
 *     endDay:    number
 *     endMonth:  number
 *     year:      number|null  (null = every year, e.g. 5786 = only that year)
 *
 *   /version/current
 *     version:    string  ("1.0.20" — the deployed package.json version,
 *                          written by the deploy workflow; see
 *                          src/hooks/useVersionReload.js)
 *     deployedAt: string  (ISO timestamp, informational)
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  DEFAULT_CONFIG, DEFAULT_PRAYERS, normalizeConfig, toHebcalLocation,
} from '../lib/defaults';

/** Stable empty array: returning a literal `[]` from the hook would give App
 * a fresh identity on every render, dragging the minute-bucketed display memo
 * into a per-second recompute in the fallback (no-Firestore) config. */
const EMPTY_IMAGES = [];

/**
 * Subscribe to a Firestore doc or query. `onData` maps a snapshot to state;
 * on error the state gets `fallback`. Returns the unsubscribe function.
 */
function watch(ref, label, setState, onData, fallback) {
  return onSnapshot(
    ref,
    (snap) => setState(onData(snap)),
    (err) => {
      console.warn(`Firestore ${label} unavailable, using defaults:`, err.message);
      setState(fallback);
    },
  );
}

/** Collection snapshot → array of docs with ids, or null when empty */
function docsOrNull(snap) {
  return snap.empty ? null : snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * React hook — subscribes to Firestore and returns live data, always fully
 * populated: falls back to lib/defaults.js when Firebase is unavailable,
 * empty, or holds a bad value.
 *
 * `location` is a validated hebcal Location built from config.location.
 */
export function useFirestoreData() {
  const [config, setConfig] = useState(null);
  const [prayers, setPrayers] = useState(null);
  const [images, setImages] = useState(null);

  useEffect(() => {
    const unsubs = [
      watch(doc(db, 'config', 'app-config'), 'config', setConfig,
        snap => snap.exists() ? normalizeConfig(snap.data()) : DEFAULT_CONFIG,
        DEFAULT_CONFIG),
      watch(query(collection(db, 'prayers'), orderBy('order')), 'prayers', setPrayers,
        docsOrNull, null),
      watch(query(collection(db, 'images'), orderBy('name')), 'images', setImages,
        docsOrNull, null),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const resolvedConfig = config ?? DEFAULT_CONFIG;
  const location = useMemo(
    () => toHebcalLocation(resolvedConfig.location),
    [resolvedConfig.location],
  );

  return {
    config: resolvedConfig,
    location,
    prayers: prayers ?? DEFAULT_PRAYERS,
    images: images ?? EMPTY_IMAGES,
  };
}
