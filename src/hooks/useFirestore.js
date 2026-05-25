/**
 * Firestore hook — fetches and subscribes to app config + prayers + image schedules.
 *
 * Firestore schema:
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
 *   /images/{autoId}
 *     name:      string   (display name / description)
 *     imageUrl:  string   (Firebase Storage URL or any public URL)
 *     startDay:  number   (1-30)
 *     startMonth: number  (1=Nisan … 7=Tishrei … 12=Adar I, 13=Adar II — Jewish calendar month index)
 *     endDay:    number
 *     endMonth:  number
 *     year:      number|null  (null = every year, e.g. 5786 = only that year)
 */

import { useEffect, useState, useRef } from 'react';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/** Hard-coded defaults used when Firebase is unavailable or empty */
export const DEFAULTS = {
  defaultViewDuration: 15,
  imageDisplayDuration: 15,
  title: 'משכן שמואל',
  location: {
    lat: 31.42215,
    lng: 34.58858,
    timezone: 'Asia/Jerusalem',
    name: 'Netivot, Israel',
    elevation: 0,
  },
  prayers: [
    { name: 'שחרית של חול',     time: '07:00' },
    { name: 'מנחה וקבלת שבת',   time: 'עם כניסת השבת' },
    { name: 'שחרית של שבת',     time: '08:00' },
    { name: 'מנחה של שבת',      time: '13:15' },
    { name: 'ערבית של מוצ״ש',   time: '5 דקות לפני צאת השבת' },
  ],
};

/**
 * Converts a Firestore timestamp / date string to a comparable integer.
 * Compares only month and day (not year) for recurring schedules.
 */
function packMonthDay(month, day) {
  return (month - 1) * 30 + day; // crude but works for ≤ comparison
}

/** Check whether a Hebrew date (month, day) falls within [start, end] range */
function isDateInRange(hMonth, hDay, startMonth, startDay, endMonth, endDay) {
  const target = packMonthDay(hMonth, hDay);
  const start = packMonthDay(startMonth, startDay);
  const end = packMonthDay(endMonth, endDay);
  // Handle wrap-around (e.g., Adar → Nisan)
  if (start <= end) return target >= start && target <= end;
  return target >= start || target <= end;
}

/**
 * Check if a Firestore image schedule is active for the given Hebrew date + year.
 * If the schedule's year is set, it must also match.
 */
function isImageActive(image, hMonth, hDay, hYear) {
  if (image.year != null && image.year !== hYear) return false;
  return isDateInRange(
    hMonth, hDay,
    image.startMonth, image.startDay,
    image.endMonth, image.endDay,
  );
}

/**
 * React hook — subscribes to Firestore and returns live data.
 * Falls back to DEFAULTS if Firebase is not configured or offline.
 */
export function useFirestoreData() {
  const [config, setConfig] = useState(null);
  const [prayers, setPrayers] = useState(null);
  const [images, setImages] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const unsubRef = useRef([]);

  useEffect(() => {
    // Subscribe to /config/app-config
    const unsubConfig = onSnapshot(
      doc(db, 'config', 'app-config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            defaultViewDuration: data.defaultViewDuration ?? DEFAULTS.defaultViewDuration,
            imageDisplayDuration: data.imageDisplayDuration ?? DEFAULTS.imageDisplayDuration,
            title: data.title ?? DEFAULTS.title,
            location: data.location ?? DEFAULTS.location,
          });
        } else {
          setConfig({ ...DEFAULTS, title: DEFAULTS.title, location: DEFAULTS.location });
        }
      },
      (err) => {
        console.warn('Firestore config unavailable, using defaults:', err.message);
        setConfig({ ...DEFAULTS, title: DEFAULTS.title, location: DEFAULTS.location });
      }
    );

    // Subscribe to /prayers (ordered)
    const qPrayers = query(collection(db, 'prayers'), orderBy('order'));
    const unsubPrayers = onSnapshot(
      qPrayers,
      (snap) => {
        if (!snap.empty) {
          setPrayers(snap.docs.map(d => d.data()));
        } else {
          setPrayers(null); // null = use DEFAULTS
        }
      },
      (err) => {
        console.warn('Firestore prayers unavailable:', err.message);
        setPrayers(null);
      }
    );

    // Subscribe to /images
    const qImages = query(collection(db, 'images'), orderBy('name'));
    const unsubImages = onSnapshot(
      qImages,
      (snap) => {
        if (!snap.empty) {
          setImages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setImages(null);
        }
      },
      (err) => {
        console.warn('Firestore images unavailable:', err.message);
        setImages(null);
      }
    );

    unsubRef.current = [unsubConfig, unsubPrayers, unsubImages];
    return () => unsubRef.current.forEach(u => u());
  }, []);

  // Re-evaluate which image is active whenever images or today's Hebrew date changes
  return {
    config: config || DEFAULTS,
    prayers: prayers || DEFAULTS.prayers,
    images: images || [],
    isConfigured: config != null,
    isImageActive,
  };
}
