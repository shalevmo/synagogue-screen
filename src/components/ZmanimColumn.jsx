import { memo } from 'react';

/** Left column: Or Hahaim zmanim (rows from lib/displayData.js) */
function ZmanimColumn({ zmanimTimes }) {
  return (
    <div className="bordered col-4 d-flex flex-column p-3 pb-5 pe-5 justify-content-between">
      {zmanimTimes.map(z => (
        <div key={z.name} className="d-flex flex-row justify-content-between h1">
          <span>{z.name}</span>
          <span>{z.time}</span>
        </div>
      ))}
    </div>
  );
}

export default memo(ZmanimColumn);
