import { useState, type FormEvent } from 'react';
import { ApiError, patchMedia } from '../api';
import { SUBJECTS, type MediaItem, type Subject } from '../types';

export function EditDialog({
  item,
  onClose,
  onSaved,
}: {
  item: MediaItem;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [subject, setSubject] = useState<Subject>(item.subject);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await patchMedia(item.id, { title: title.trim(), description: description.trim(), subject });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save the changes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog__title" id="edit-title">
          Edit resource
        </h2>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="edit-title-field">
              Title
            </label>
            <input
              id="edit-title-field"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="edit-description">
              Description
            </label>
            <textarea
              id="edit-description"
              className="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="edit-subject">
              Subject
            </label>
            <select
              id="edit-subject"
              className="select"
              value={subject}
              onChange={(event) => setSubject(event.target.value as Subject)}
            >
              {SUBJECTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="notice notice--error">{error}</p> : null}

          <div className="dialog__actions">
            <button className="button button--secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
