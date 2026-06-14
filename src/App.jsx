import { useEffect, useState, useCallback } from 'react';
import { HDate, HebrewCalendar, Location, Zmanim } from '@hebcal/core';
import { useFirestoreData } from './hooks/useFirestore';
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
  }).format(d);
}

function stripNikkud(text) {
  if (!text) return '';
  return text.replace(/[\u0591-\u05C7]/g, '');
}

/** Find the upcoming Shabbat's parsha */
function findParsha(hd, gloc) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilShabbat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const shabbat = new Date(now);
  shabbat.setDate(shabbat.getDate() + daysUntilShabbat);
  const shabbatHd = new HDate(shabbat);

  const cal = HebrewCalendar.calendar({
    start: shabbatHd, end: shabbatHd,
    il: true, location: gloc, sedrot: true,
  });

  if (cal) {
    for (const ev of cal) {
      // Don't rely on constructor.name — it is mangled by minifiers.
      // Parsha events render Hebrew text starting with 'פָּרָשַׁת' / 'פרשת'.
      const hebrew = stripNikkud(ev.render('he') || '').trim();
      if (/^פרש[הת] /.test(hebrew)) {
        return hebrew.replace(/\s*\(.*\)/, '').trim();
      }
    }
  }
  return '';
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

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { config, prayers, images } = useFirestoreData();
  const [showDefault, setShowDefault] = useState(true);
  const [clock, setClock] = useState('');
  const [jewishDate, setJewishDate] = useState('');
  const [dayAndDate, setDayAndDate] = useState('');
  const [zmanimTimes, setZmanimTimes] = useState([]);
  const [parshaName, setParshaName] = useState('');
  const [activeImage, setActiveImage] = useState(null);
  const [gloc, setGloc] = useState(null);

  // Build Location object from config
  useEffect(() => {
    const loc = config.location || {};
    setGloc(new Location(
      loc.lat ?? 31.42215,
      loc.lng ?? 34.58858,
      true,
      loc.timezone ?? 'Asia/Jerusalem',
      loc.elevation ?? 0,
    ));
  }, [config.location]);

  const updateData = useCallback(() => {
    if (!gloc) return;
    const now = new Date();
    const hd = new HDate(now);
    const z = new Zmanim(gloc, now);

    // Clock
    setClock(new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'Asia/Jerusalem',
    }).format(now));

    // Jewish date in header
    const tzaisAt = z.tzeit();
    const isAfterTzais = tzaisAt && now > tzaisAt;
    const displayHd = isAfterTzais
      ? new HDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
      : hd;
    const prefix = isAfterTzais ? 'אור ל' : '';
    setJewishDate((prefix + stripNikkud(displayHd.renderGematriya())).trim());

    // Day + Gregorian date
    const dow = new Intl.DateTimeFormat('he', { weekday: 'short', timeZone: 'Asia/Jerusalem' }).format(now);
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    setDayAndDate(`${dow}\u00a0|\u00a0${dd}/${mm}/${yyyy}`);

    // Zmanim
    setZmanimTimes(ZMANIM_ALL.map(({ fn, name }) => {
      let val = '';
      try { val = fmt(z[fn]()); } catch (e) {}
      return { name, time: val };
    }));

    // Parsha
    setParshaName(findParsha(hd, gloc));

    // Active image based on Hebrew date
    // displayHd has the correct Hebrew date
    const hMonth = displayHd.getMonth();        // 1‑based (1=Tishrei, 7=Nisan)
    const hDay   = displayHd.getDate();         // 1‑31
    const hYear  = displayHd.getFullYear();
    setActiveImage(findActiveImage(images, hMonth, hDay, hYear));
  }, [gloc, images]);

  // Recompute every time gloc changes (Firebase location)
  useEffect(() => {
    if (!gloc) return;
    updateData();
    const ci = setInterval(() => setClock(
      new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date())
    ), 1000);
    const di = setInterval(updateData, 60000);
    return () => { clearInterval(ci); clearInterval(di); };
  }, [gloc, updateData]);

  // Toggle between default view and image view
  useEffect(() => {
    if (!config) return;
    const defaultDur = (config.defaultViewDuration ?? 15) * 1000;
    const imageDur  = (config.imageDisplayDuration ?? 15) * 1000;

    // If no active image, always show default
    if (!activeImage) {
      setShowDefault(true);
      return;
    }

    // Toggle between default and image view
    let timer;
    const tick = () => {
      setShowDefault(prev => {
        const next = !prev;
        timer = setTimeout(tick, next ? defaultDur : imageDur);
        return next;
      });
    };
    timer = setTimeout(tick, defaultDur); // start with default view

    return () => clearTimeout(timer);
  }, [activeImage, config]);

  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) {}
  };

  // ── render ──────────────────────────────────────────────────────────────

  const title = config?.title ?? 'משכן שמואל';

  return (
    <div id="content-wrapper" onClick={toggleFullScreen} style={{ cursor: 'pointer' }}>
      <div className="container-fluid p-0 w-100 h-100 d-flex flex-column">

        {/* Header */}
        <div className="row align-items-end mt-3 mb-3 ps-5 pe-5 text-center">
          <span className="h1 col-4 mb-0 ps-3 pe-5">{jewishDate}</span>
          <span id="title" className="col-4 red">{title}</span>
          <span className="h1 col-4 mb-0 ps-3 pe-3">{dayAndDate}</span>
        </div>

        {/* Spacer image (matches original's broken image — 16px spacer) */}
        <img
          src="/line.png"
          className="col-12 mb-4 w-100"
          alt=""
          style={{ height: 16, objectFit: 'none' }}
        />

        {showDefault ? (
          /* ══════ Default view: zmanim | parsha + clock | prayers ══════ */
          <div className="row ps-5 pe-5 mt-4 flex-grow-1 mb-3">

            <div className="bordered col-4 d-flex flex-column p-3 pb-5 pe-5 justify-content-between">
              {zmanimTimes.map((z, i) => (
                <div key={i} className="d-flex flex-row justify-content-between h1">
                  <span>{z.name}</span>
                  <span>{z.time}</span>
                </div>
              ))}
            </div>

            <div className="bordered col-4 d-flex flex-column text-center justify-content-between">
              <div className="d-flex flex-column">
                <span className="h1 col-12 text-center mb-0">פרשת השבוע</span>
                {parshaName && (
                  <span className="col-12 text-center red special-text">{parshaName}</span>
                )}
              </div>
              <span id="clock">{clock}</span>
            </div>

            <div className="bordered col-4 d-flex flex-column p-3 pb-5 justify-content-between">
              {prayers.map((p, i) => (
                <div key={i} className="d-flex flex-column align-items-center">
                  <span className="h1 mb-0">{p.name}</span>
                  <span className="h2 prayer-time">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ══════ Image view (holiday schedule) ══════ */
          <div className="row ps-5 pe-5 mt-4 flex-grow-1 mb-3">
            {activeImage && (
              <div className="col-12 d-flex align-items-center justify-content-center" style={{ flex: 1 }}>
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.name || ''}
                  className="w-100 h-100"
                  style={{ objectFit: 'fill' }}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
