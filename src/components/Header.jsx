import { memo } from 'react';

/** Top row: Hebrew date | synagogue title | weekday + Gregorian date */
function Header({ jewishDate, title, dayAndDate }) {
  return (
    <div className="row align-items-end mt-3 mb-3 ps-5 pe-5 text-center">
      <span className="h1 col-4 mb-0 ps-3 pe-5">{jewishDate}</span>
      <span id="title" className="col-4 red">{title}</span>
      <span className="h1 col-4 mb-0 ps-3 pe-3">{dayAndDate}</span>
    </div>
  );
}

export default memo(Header);
