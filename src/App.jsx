import { useMemo } from 'react';
import { useFirestoreData } from './hooks/useFirestore';
import { useVersionReload } from './hooks/useVersionReload';
import { useClock } from './hooks/useClock';
import { useSlideshow } from './hooks/useSlideshow';
import { computeDisplayData } from './lib/displayData';
import { computeEventLines } from './lib/events';
import Header from './components/Header';
import ZmanimColumn from './components/ZmanimColumn';
import CenterPanel from './components/CenterPanel';
import PrayersColumn from './components/PrayersColumn';
import HolidayImage from './components/HolidayImage';
import './index.css';

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
  const { config, location: gloc, prayers, images } = useFirestoreData();
  useVersionReload(); // Firestore /version/current → reload on newer deploy
  const { now, minute } = useClock();

  // Heavy date/zmanim/parsha math recomputed once per minute (keyed by the
  // minute bucket), not on every clock tick. Pure computation during render.
  const { jewishDate, dayAndDate, zmanimTimes, reading, activeImage } = useMemo(
    () => computeDisplayData(gloc, images, new Date(minute * 60000)),
    [gloc, images, minute],
  );

  // Holiday/event lines for the center column — same minute-bucket cadence as
  // the other heavy date math. Pure computation during render.
  const { banners, timed } = useMemo(
    () => computeEventLines(gloc, now),
    [gloc, minute], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { showingImage, handleImageLoad, handleImageError } = useSlideshow(
    activeImage,
    config.defaultViewDuration * 1000,
    config.imageDisplayDuration * 1000,
  );

  // ── render ──────────────────────────────────────────────────────────────

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

        <Header jewishDate={jewishDate} title={config.title} dayAndDate={dayAndDate} />

        {/* No horizontal separator — original used line.png only as vertical
            column edges via .bordered CSS (Asset 2.jpg was broken/404 there) */}

        {/* Default view — ALWAYS MOUNTED. It is never torn down; the holiday
            image simply covers it (absolute, z-index 10). The previous
            conditional-render approach unmounted/remounted this entire tree
            on every flip: from-scratch render + layout each time, and an
            empty flash while React rebuilt the DOM on the flip back. */}
        <div className="row ps-5 pe-5 mt-4 flex-grow-1 mb-3">
          <ZmanimColumn zmanimTimes={zmanimTimes} />
          <CenterPanel reading={reading} banners={banners} timed={timed} now={now} />
          <PrayersColumn prayers={prayers} />
        </div>

        {activeImage && (
          <HolidayImage
            key={activeImage.imageUrl}
            image={activeImage}
            visible={showingImage}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

      </div>
    </div>
  );
}
