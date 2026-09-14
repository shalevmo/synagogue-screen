import { useEffect, useState, useMemo } from 'react';
import { HDate, Location, Zmanim } from '@hebcal/core';
import { useFirestoreData } from './hooks/useFirestore';
import { stripNikkud, findShabbatReading } from './lib/reading';
import { needsImageReset } from './lib/slideshow';
import { computeEventLines } from './lib/events';
import { orHahaim, dayFlipTzais } from './lib/zmanim.js';
import './index.css';

// ─── left-column zmanim rows (Or Hahaim, locked "A" — see lib/zmanim.js) ──────

const ZMANIM_ROWS = [
  { key: 'alot',    name: 'עלות השחר' },
  { key: 'sunrise', name: 'זריחה' },
  { key: 'shmaMGA', name: 'סו״ז שמע מג״א' },
  { key: 'shmaGRA', name: 'סו״ז שמע גר״א' },
  { key: 'tefMGA',  name: 'סו״ז תפילה מג״א' },
  { key: 'tefGRA',  name: 'סו״ז תפילה גר״א' },
  { key: 'chatzot', name: 'חצות' },
  { key: 'shkiah',  name: 'שקיעה' },
  { key: 'tzais',   name: 'צאת הכוכבים' },
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

  // Jewish date in header
  // Day-flip tzeit — single source (lib/zmanim.js dayFlipTzais, locked in
  // docs/adr/0001-day-flip-tzais-85.md): the same call the event panel uses,
  // so header and panel flip inseparably. NOT the displayed OH tzais.
  const tzaisAt = dayFlipTzais(gloc, now);
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

  // Zmanim — Or Hahaim (left column follows the community's convention)
  const oh = orHahaim(gloc, now);
  const zmanimTimes = oh
    ? ZMANIM_ROWS.map(({ key, name }) => ({ name, time: fmt(oh[key]) }))
    : ZMANIM_ROWS.map(({ name }) => ({ name, time: '' }));

  // Parsha — or the holiday reading when no regular parsha is read
  // (Rosh Hashana / Yom Kippur / Sukkot / Shmini Atzeret / Pesach Shabbats).
  // On Shabbat itself (before tzais): today's reading, not next week's.
  const reading = findShabbatReading(now, gloc, tzaisAt);

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
  const [imageReady, setImageReady] = useState(false);

  // Build Location object from config (memoized — no effect or extra state).
  // Firestore owns this data: a bad `location` doc (garbage lat or timezone)
  // would throw inside every zmanim memo and white-screen the kiosk. Validate
  // by construction — smoke-run a sunrise once per config change and fall
  // back to the Netivot default if it throws.
  const gloc = useMemo(() => {
    const loc = config.location || {};
    try {
      const candidate = new Location(
        loc.lat ?? 31.42215,
        loc.lng ?? 34.58858,
        true,
        loc.timezone ?? 'Asia/Jerusalem',
        loc.elevation ?? 0,
      );
      new Zmanim(candidate, new HDate()).sunrise(); // smoke-test: validates tz + coords
      return candidate;
    } catch {
      console.warn('Bad config.location, falling back to Netivot default');
      return new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);
    }
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

  // Holiday/event lines for the center column — same minute-bucket cadence as
  // the other heavy date math. Pure computation during render.
  const { banners, timed } = useMemo(
    () => computeEventLines(gloc, now),
    [gloc, minute], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // When the image being displayed changes (URL is the identity that matters —
  // the <img> below is keyed by imageUrl), restart from the default view. The
  // new image is never displayed until it has fully downloaded AND decoded
  // (see handleImageLoad) — a progressive / half-painted image is never shown,
  // and the default view keeps running underneath in the meantime. Adjusting
  // state during render is the documented React pattern for reacting to
  // changed values. Logic lives in lib/slideshow.js (needsImageReset) —
  // compare by imageUrl, NOT doc identity: schedules split across year
  // boundaries share one URL, and resetting on a doc switch re-arms the
  // decode gate with no load event to clear it (RH 5787 incident).
  const nextUrl = activeImage?.imageUrl ?? null;
  const [prevImageUrl, setPrevImageUrl] = useState(nextUrl);
  if (needsImageReset(prevImageUrl, activeImage)) {
    setPrevImageUrl(nextUrl);
    setShowDefault(true);
    setImageReady(false);
  }

  // Slideshow: show the current view for its configured duration, then flip.
  // The cycle only runs while the scheduled image is fully decoded & ready —
  // if the image is still downloading, the default view simply stays up.
  const defaultDur = (config.defaultViewDuration ?? 15) * 1000;
  const imageDur  = (config.imageDisplayDuration ?? 15) * 1000;
  useEffect(() => {
    if (!activeImage || !imageReady) return;
    const timer = setTimeout(
      () => setShowDefault(v => !v),
      showDefault ? defaultDur : imageDur,
    );
    return () => clearTimeout(timer);
  }, [activeImage, imageReady, showDefault, defaultDur, imageDur]);

  // Fired when the <img> finishes downloading. decode() pushes the full
  // bitmap through the decoder off the paint path, so the first time the
  // image becomes visible it appears in one instant flip — no progressive
  // "split" render, no flash of the previous screen.
  const handleImageLoad = async (e) => {
    const el = e.currentTarget;
    try {
      if (el.decode) await el.decode();
    } catch {
      // decode() can reject when interrupted — the load event is authoritative
    }
    setImageReady(true);
  };

  // The image view is only painted once the bitmap is fully decoded.
  const showingImage = activeImage && !showDefault && imageReady;

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

        {/* Default view — ALWAYS MOUNTED. It is never torn down; the holiday
            image simply covers it (absolute, z-index 10). The previous
            conditional-render approach unmounted/remounted this entire tree
            on every flip: from-scratch render + layout each time, and an
            empty flash while React rebuilt the DOM on the flip back. */}
        <div className="row ps-5 pe-5 mt-4 flex-grow-1 mb-3">

          {/* ══════ Default view: zmanim | parsha + clock | prayers ══════ */}
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

            {/* Holiday & event lines (banners first, then timed) */}
            {(banners.length > 0 || timed.length > 0) && (
              <div className="d-flex flex-column event-panel">
                {banners.map((b, i) => (
                  <span key={`b-${i}`} className="h1 event-line event-banner">{b}</span>
                ))}
                {timed.map((t, i) => (
                  <div key={`t-${i}`} className="d-flex flex-row justify-content-center event-line">
                    <span className="h1">{t.label}</span>
                    <span className="h1">{t.time}</span>
                  </div>
                ))}
              </div>
            )}

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

        {/* ══════ Holiday image (e.g. Rosh Hashana schedule) — full screen ══════
            Stays mounted the whole time it is scheduled, so the browser
            downloads and decodes it in the background during the default view
            and keeps the decoded bitmap across flips: no re-download, no
            re-decode. Visibility flips via a 1s opacity crossfade (CSS class
            .holiday-image + data-hidden) instead of mounting/unmounting. */}
        {activeImage && (
          <img
            key={activeImage.imageUrl}
            className="holiday-image"
            data-view="holiday-image"
            data-hidden={showingImage ? 'false' : 'true'}
            src={activeImage.imageUrl}
            alt={activeImage.name || ''}
            fetchPriority="high"
            onLoad={handleImageLoad}
            onError={() => setImageReady(false)}
          />
        )}

      </div>
    </div>
  );
}