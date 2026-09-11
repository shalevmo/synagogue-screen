import { useEffect, useState, useMemo } from 'react';
import { HDate, Location, Zmanim } from '@hebcal/core';
import { useFirestoreData } from './hooks/useFirestore';
import { stripNikkud, findShabbatReading } from './lib/reading';
import './index.css';

// ─── zmanim keys (unchanged) ──────────────────────────────────────────────────

const ZMANIM_ALL = [
  { fn: 'alotHaShachar',   name: 'עלות השחר' },
  { fn: 'neitzHaChama',    name: 'זריחה' },
  { fn: 'sofZmanShmaMGA',  name: 'סו״ז שמע מג״א' },
  { fn: 'sofZmanShma',     name: 'סו״ז שמע גר״א' },
  { fn: 'sofZmanTfillaMGA',name: 'סו״ז תפילה מג״א' },
  { fn: 'sofZmanTfilla',   name: 'סו״ז תפילה גר״א' },
  { fn: 'chatzot',         name: 'חצות' },
  { fn: 'shkiah',          name: 'שקיעה' },
  { fn: 'tzaisBaalHatanya',name: 'צאת הכוכבים' },
];

// ─── module-scope Intl formatters (hoisted: construction is expensive) ────────

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
});
const CLOCK_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, timeZone: 'Asia/Jerusalem',
});
const DOW_FMT = new Intl.DateTimeFormat('he', { weekday: 'short', timeZone: 'Asia/Jerusalem' });

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '';
  return TIME_FMT.format(d);
}

/** Check whether a Hebrew date falls inside a Firestore schedule range */
function isDateInRange(hMonth, hDay,
                       startMonth, startDay,
                       endMonth, endDay) {
  const pack = (m, d) => (m - 1) * 30 + d;
  const t = pack(hMonth, hDay);
  const s = pack(startMonth, startDay);
  const e = pack(endMonth, endDay);
  if (s <= e) return t >= s && t <= e;
  return t >= s || t <= e;   // wrap-around
}

/** Find the first active image for the current Hebrew date/year */
function findActiveImage(images, hMonth, hDay, hYear) {
  if (!images || images.length === 0) return null;
  return images.find(img => {
    if (img.year != null && img.year !== hYear) return false;
    return isDateInRange(
      hMonth, hDay,
      img.startMonth, img.startDay,
      img.endMonth, img.endDay,
    );
  }) || null;
}

/**
 * Compute all date-derived display data (Hebrew date, Gregorian date,
 * zmanim, parsha/holiday reading, active image) for a given instant.
 * Pure function — called from render via useMemo, never from an effect.
 */
function computeDisplayData(gloc, images, now) {
  const hd = new HDate(now);
  const z = new Zmanim(gloc, now);

  // Jewish date in header
  const tzaisAt = z.tzeit();
  const isAfterTzais = tzaisAt && now > tzaisAt;
  const displayHd = isAfterTzais
    ? new HDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    : hd;
  const prefix = isAfterTzais ? 'אור ל' : '';
  const jewishDate = (prefix + stripNikkud(displayHd.renderGematriya())).trim();

  // Day + Gregorian date
  const dow = DOW_FMT.format(now);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dayAndDate = `${dow}\u00a0|\u00a0${dd}/${mm}/${yyyy}`;

  // Zmanim
  const zmanimTimes = ZMANIM_ALL.map(({ fn, name }) => {
    let val = '';
    try {
      val = fmt(z[fn]());
    } catch {
      // certain zmanim may not exist for this location/date — leave blank
    }
    return { name, time: val };
  });

  // Parsha — or the holiday reading when no regular parsha is read
  // (Rosh Hashana / Yom Kippur / Sukkot / Shmini Atzeret / Pesach Shabbats).
  const reading = findShabbatReading(now, gloc);

  // Active image based on Hebrew date (displayHd has the correct date)
  const hMonth = displayHd.getMonth();        // 1‑based (1=Tishrei, 7=Nisan)
  const hDay   = displayHd.getDate();         // 1‑31
  const hYear  = displayHd.getFullYear();
  const activeImage = findActiveImage(images, hMonth, hDay, hYear);

  return { jewishDate, dayAndDate, zmanimTimes, reading, activeImage };
}

/** Toggle browser fullscreen (module scope — pure, uses no component state) */
async function toggleFullScreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // browser may refuse (e.g. no user gesture); kiosk runs fullscreen anyway
  }
}

/** Keyboard equivalent of the click-to-fullscreen handler (a11y) */
function handleKeyDown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleFullScreen();
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { config, prayers, images } = useFirestoreData();
  const [now, setNow] = useState(() => new Date());
  const [showDefault, setShowDefault] = useState(true);

  // Build Location object from config (memoized — no effect or extra state)
  const gloc = useMemo(() => {
    const loc = config.location || {};
    return new Location(
      loc.lat ?? 31.42215,
      loc.lng ?? 34.58858,
      true,
      loc.timezone ?? 'Asia/Jerusalem',
      loc.elevation ?? 0,
    );
  }, [config.location]);

  // Single ticker: the only state this component owns besides the view toggle.
  // setState runs inside the interval callback, never synchronously in the effect.
  useEffect(() => {
    const ci = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ci);
  }, []);

  // Heavy date/zmanim/parsha math recomputed once per minute (keyed by the
  // minute bucket), not on every clock tick. Pure computation during render.
  const minute = Math.floor(now.getTime() / 60000);
  const { jewishDate, dayAndDate, zmanimTimes, reading, activeImage } = useMemo(
    () => computeDisplayData(gloc, images, new Date(minute * 60000)),
    [gloc, images, minute],
  );
  const clock = CLOCK_FMT.format(now);

  // When the active image changes (new holiday image starts), restart the
  // slideshow cycle from the default view. Adjusting state during render is
  // the documented React pattern for reacting to changed props/state.
  const [prevImage, setPrevImage] = useState(activeImage);
  if (activeImage !== prevImage) {
    setPrevImage(activeImage);
    setShowDefault(true);
  }

  // Slideshow: show the current view for its configured duration, then flip.
  // The effect re-runs on each flip and schedules the next one — pure state
  // updates inside the timeout callback, StrictMode-safe.
  const defaultDur = (config.defaultViewDuration ?? 15) * 1000;
  const imageDur  = (config.imageDisplayDuration ?? 15) * 1000;
  useEffect(() => {
    if (!activeImage) return;
    const timer = setTimeout(
      () => setShowDefault(v => !v),
      showDefault ? defaultDur : imageDur,
    );
    return () => clearTimeout(timer);
  }, [activeImage, showDefault, defaultDur, imageDur]);

  // If no image is scheduled, always show the default view.
  const showingDefault = !activeImage || showDefault;

  // ── render ──────────────────────────────────────────────────────────────

  const title = config?.title ?? 'משכן שמואל';

  return (
    <div
      id="content-wrapper"
      role="button"
      tabIndex={0}
      aria-label="מסך מלא"
      onClick={toggleFullScreen}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer' }}
    >
      <div className="container-fluid p-0 w-100 h-100 d-flex flex-column">

        {/* Header */}
        <div className="row align-items-end mt-3 mb-3 ps-5 pe-5 text-center">
          <span className="h1 col-4 mb-0 ps-3 pe-5">{jewishDate}</span>
          <span id="title" className="col-4 red">{title}</span>
          <span className="h1 col-4 mb-0 ps-3 pe-3">{dayAndDate}</span>
        </div>

        {/* No horizontal separator — original used line.png only as vertical
            column edges via .bordered CSS (Asset 2.jpg was broken/404 there) */}

        {showingDefault ? (
          /* ══════ Default view: zmanim | parsha + clock | prayers ══════ */
          <div className="row ps-5 pe-5 mt-4 flex-grow-1 mb-3">

            <div className="bordered col-4 d-flex flex-column p-3 pb-5 pe-5 justify-content-between">
              {zmanimTimes.map(z => (
                <div key={z.name} className="d-flex flex-row justify-content-between h1">
                  <span>{z.name}</span>
                  <span>{z.time}</span>
                </div>
              ))}
            </div>

            <div className="bordered col-4 d-flex flex-column text-center justify-content-between">
              <div className="d-flex flex-column">
                <span className="h1 col-12 text-center mb-0">פרשת השבוע</span>
                {reading.text && (
                  <span className="col-12 text-center red special-text">{reading.text}</span>
                )}
              </div>
              <span id="clock">{clock}</span>
            </div>

            <div className="bordered col-4 d-flex flex-column p-3 pb-5 justify-content-between">
              {prayers.map(p => (
                <div key={p.id ?? p.name} className="d-flex flex-column align-items-center">
                  <span className="h1 mb-0">{p.name}</span>
                  <span className="h2 prayer-time">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ══════ Image view (holiday schedule) — full screen ══════ */
          activeImage && (
            <img
              src={activeImage.imageUrl}
              alt={activeImage.name || ''}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                objectFit: 'fill',
                zIndex: 10,
              }}
            />
          )
        )}

      </div>
    </div>
  );
}