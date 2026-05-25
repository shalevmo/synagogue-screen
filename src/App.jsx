import { useEffect, useState, useCallback } from 'react';
import { HDate, HebrewCalendar, Location, Zmanim } from '@hebcal/core';
import './index.css';

const GLOC = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem');

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

const PRAYERS = [
  { name: 'שחרית של חול',     time: '07:00' },
  { name: 'מנחה וקבלת שבת',   time: 'עם כניסת השבת' },
  { name: 'שחרית של שבת',     time: '08:00' },
  { name: 'מנחה של שבת',      time: '13:15' },
  { name: 'ערבית של מוצ״ש',   time: '5 דקות לפני צאת השבת' },
];

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

/** Look ahead to the next Shabbat and find the ParshaEvent */
function findParsha(hd) {
  // Get calendar for the next ~30 days to find the upcoming Shabbat parsha
  const end = new HDate(hd);
  end.abs(); // need to advance
  // Simple approach: query the shabbat day directly
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilShabbat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const shabbat = new Date(now);
  shabbat.setDate(shabbat.getDate() + daysUntilShabbat);
  const shabbatHd = new HDate(shabbat);

  const cal = HebrewCalendar.calendar({
    start: shabbatHd, end: shabbatHd,
    il: true, location: GLOC, sedrot: true,
  });

  if (cal) {
    for (const ev of cal) {
      if (ev.constructor.name === 'ParshaEvent') {
        return stripNikkud(ev.render('he')).replace(/\s*\(.*\)/, '').trim();
      }
    }
  }
  return '';
}

export default function App() {
  const [showTimes, setShowTimes] = useState(true);
  const [clock, setClock] = useState('');
  const [jewishDate, setJewishDate] = useState('');
  const [dayAndDate, setDayAndDate] = useState('');
  const [zmanimTimes, setZmanimTimes] = useState([]);
  const [parshaName, setParshaName] = useState('');
  const [isPesach, setIsPesach] = useState(false);

  const updateData = useCallback(() => {
    const now = new Date();
    const hd = new HDate(now);
    const z = new Zmanim(GLOC, now);

    setClock(new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'Asia/Jerusalem',
    }).format(now));

    const tzaisAt = z.tzeit();
    const isAfterTzais = tzaisAt && now > tzaisAt;
    const displayHd = isAfterTzais
      ? new HDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
      : hd;
    const prefix = isAfterTzais ? 'אור ל' : '';
    setJewishDate((prefix + stripNikkud(displayHd.renderGematriya())).trim());

    const dow = new Intl.DateTimeFormat('he', { weekday: 'short', timeZone: 'Asia/Jerusalem' }).format(now);
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    setDayAndDate(`${dow}\u00a0|\u00a0${dd}/${mm}/${yyyy}`);

    setZmanimTimes(ZMANIM_ALL.map(({ fn, name }) => {
      let val = '';
      try { val = fmt(z[fn]()); } catch (e) {}
      return { name, time: val };
    }));

    // Find upcoming Shabbat parsha
    setParshaName(findParsha(hd));

    // Check if Pesach
    const cal = HebrewCalendar.calendar({
      start: hd, end: hd, il: true, location: GLOC, candlelighting: true,
      shabbatMevarchim: true, candleLightingMins: 21, havdalahMins: 32,
    });
    let pesach = false;
    if (cal) {
      for (const ev of cal) {
        const desc = ev.render?.('he') ? stripNikkud(ev.render('he')).trim() : '';
        if (desc.includes('פסח')) pesach = true;
      }
    }
    setIsPesach(pesach);
  }, []);

  useEffect(() => {
    updateData();
    const ci = setInterval(() => setClock(
      new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }).format(new Date())
    ), 1000);
    const di = setInterval(updateData, 60000);
    const ti = setInterval(() => setShowTimes(prev => !prev), 15000);
    return () => { clearInterval(ci); clearInterval(di); clearInterval(ti); };
  }, [updateData]);

  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) {}
  };

  return (
    <div id="content-wrapper" onClick={toggleFullScreen} style={{ cursor: 'pointer' }}>
      <div className="container-fluid p-0 w-100 h-100 d-flex flex-column">

        <div className="row align-items-end mt-3 mb-3 ps-5 pe-5 text-center">
          <span className="h1 col-4 mb-0 ps-3 pe-5">{jewishDate}</span>
          <span id="title" className="col-4 red">משכן שמואל</span>
          <span className="h1 col-4 mb-0 ps-3 pe-3">{dayAndDate}</span>
        </div>

        <img
          src={isPesach ? '/pesach.jpg' : '/line.png'}
          className="col-12 mb-4 w-100"
          alt=""
          style={isPesach ? {} : { height: 16, objectFit: 'none' }}
        />

        {showTimes ? (
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
                {parshaName && <span className="col-12 text-center red special-text">{parshaName}</span>}
              </div>
              <span id="clock">{clock}</span>
            </div>
            <div className="bordered col-4 d-flex flex-column p-3 pb-5 justify-content-between">
              {PRAYERS.map((p, i) => (
                <div key={i} className="d-flex flex-column align-items-center">
                  <span className="h1 mb-0">{p.name}</span>
                  <span className="h2 prayer-time">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="row ps-5 pe-5 mt-4 flex-grow-1 mb-3">
            <div className="bordered col-4 d-flex flex-column p-3 pb-5 pe-5 justify-content-between">
              {zmanimTimes.slice(0, 3).map((z, i) => (
                <div key={i} className="d-flex flex-row justify-content-between h1">
                  <span>{z.name}</span><span>{z.time}</span>
                </div>
              ))}
            </div>
            <div className="bordered col-4 d-flex flex-column text-center justify-content-between">
              <img src="/pesach.jpg" className="w-100" alt="" style={{ flex: 1, objectFit: 'cover' }} />
              <span id="clock">{clock}</span>
            </div>
            <div className="bordered col-4 d-flex flex-column p-3 pb-5 justify-content-between">
              {zmanimTimes.slice(3, 6).map((z, i) => (
                <div key={i} className="d-flex flex-row justify-content-between h1">
                  <span>{z.name}</span><span>{z.time}</span>
                </div>
              ))}
              {zmanimTimes.slice(6).map((z, i) => (
                <div key={i + 6} className="d-flex flex-column align-items-center">
                  <span className="h1 mb-0">{z.time}</span>
                  <span className="h2 prayer-time">{z.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
