import { Link } from 'react-router-dom';
import { SUBJECTS, subjectSlug, type Subject } from '../types';
import { SubjectIcon } from './icons';

const HINTS: Record<Subject, string> = {
  Physics: 'Notes, diagrams, experiments and lecture videos.',
  Chemistry: 'Reaction diagrams, lab images and lessons.',
  Biology: 'Study notes, specimen images and classes.',
  Mathematics: 'Formula sheets, graphs and worked examples.',
};

export function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <Link className="subject-card" to={`/subject/${subjectSlug(subject)}`}>
      <span className="subject-card__icon" aria-hidden="true">
        <SubjectIcon subject={subject} size={30} />
      </span>
      <span className="subject-card__title">{subject}</span>
      <span className="subject-card__hint">{HINTS[subject]}</span>
    </Link>
  );
}

export function SubjectGrid() {
  return (
    <div className="subject-grid">
      {SUBJECTS.map((subject) => (
        <SubjectCard key={subject} subject={subject} />
      ))}
    </div>
  );
}
