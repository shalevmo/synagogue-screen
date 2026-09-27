import { useEffect, useState } from 'react';
import { needsImageReset } from '../lib/slideshow';

/**
 * Default-view ⇄ holiday-image slideshow.
 *
 * Returns whether the image is currently shown, plus the load/error handlers
 * for the <img> (see components/HolidayImage.jsx).
 *
 * @param {object|null} activeImage - scheduled image doc (or null)
 * @param {number} defaultDur - default-view duration, ms
 * @param {number} imageDur - image-view duration, ms
 */
export function useSlideshow(activeImage, defaultDur, imageDur) {
  const [showDefault, setShowDefault] = useState(true);
  const [imageReady, setImageReady] = useState(false);

  // When the image being displayed changes (URL is the identity that matters —
  // the <img> is keyed by imageUrl), restart from the default view. The
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

  // Show the current view for its configured duration, then flip.
  // The cycle only runs while the scheduled image is fully decoded & ready —
  // if the image is still downloading, the default view simply stays up.
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

  const handleImageError = () => setImageReady(false);

  // The image view is only painted once the bitmap is fully decoded.
  const showingImage = Boolean(activeImage && !showDefault && imageReady);

  return { showingImage, handleImageLoad, handleImageError };
}
