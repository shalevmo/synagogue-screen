/**
 * Holiday image (e.g. Rosh Hashana schedule) — full screen.
 *
 * Stays mounted the whole time it is scheduled, so the browser downloads and
 * decodes it in the background during the default view and keeps the decoded
 * bitmap across flips: no re-download, no re-decode. Visibility flips via a
 * 1s opacity crossfade (CSS class .holiday-image + data-hidden) instead of
 * mounting/unmounting. The caller keys it by imageUrl — see lib/slideshow.js
 * for why the reset logic must use the same identity.
 */
export default function HolidayImage({ image, visible, onLoad, onError }) {
  return (
    <img
      className="holiday-image"
      data-view="holiday-image"
      data-hidden={visible ? 'false' : 'true'}
      src={image.imageUrl}
      alt={image.name || ''}
      fetchPriority="high"
      onLoad={onLoad}
      onError={onError}
    />
  );
}
