/** Right column: prayer times from Firestore */
export default function PrayersColumn({ prayers }) {
  return (
    <div className="bordered col-4 d-flex flex-column p-3 pb-5 justify-content-between">
      {prayers.map(p => (
        <div key={p.id ?? p.name} className="d-flex flex-column align-items-center">
          <span className="h1 mb-0">{p.name}</span>
          <span className="h2 prayer-time">{p.time}</span>
        </div>
      ))}
    </div>
  );
}
