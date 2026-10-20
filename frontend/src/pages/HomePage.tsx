import { SubjectGrid } from '../components/SubjectCard';

export function HomePage() {
  return (
    <>
      <img
        className="hero__banner"
        src="/scholastic-hero.jpg"
        alt="Scholastic Science Academy — strive for success"
      />

      <section className="hero">
        <h1 className="hero__title">Learning Resources</h1>
        <p className="hero__subtitle">
          Explore study materials, notes, diagrams and video lectures.
        </p>
      </section>

      <SubjectGrid />

      <section className="admin-section" style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="admin-section__title">How this portal works</h2>
        <ul className="storage-rows" style={{ marginTop: 'var(--space-2)' }}>
          <li className="storage-rows__row">
            <span>New material appears automatically</span>
            <span>No app reinstall needed</span>
          </li>
          <li className="storage-rows__row">
            <span>Everything is organised by subject</span>
            <span>Physics · Chemistry · Biology · Mathematics</span>
          </li>
          <li className="storage-rows__row">
            <span>Works on the kiosk tablets over Wi-Fi</span>
            <span>Touch friendly</span>
          </li>
        </ul>
      </section>
    </>
  );
}
