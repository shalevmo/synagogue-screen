// Module scope: Intl formatter construction is expensive.
const CLOCK_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, timeZone: 'Asia/Jerusalem',
});

/** Center column: parsha/holiday reading, event lines, clock + version */
export default function CenterPanel({ reading, banners, timed, now }) {
  return (
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

      <div className="d-flex flex-column">
        <span id="clock">{CLOCK_FMT.format(now)}</span>
        <span id="version">v{__APP_VERSION__}</span>
      </div>
    </div>
  );
}
