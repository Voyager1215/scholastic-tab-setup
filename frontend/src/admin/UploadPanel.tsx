import { useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { uploadFile, type UploadProgress } from '../upload';
import { SUBJECTS, formatBytes, type Subject } from '../types';

export function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState<Subject>('Physics');
  const [publish, setPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile(next: File | null) {
    setFile(next);
    setDone(null);
    setError(null);
    if (next && !title) {
      setTitle(next.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Give the resource a title.');
      return;
    }

    setBusy(true);
    setError(null);
    setDone(null);
    setProgress({ loaded: 0, total: file.size, percent: 0, label: 'Starting' });

    try {
      const item = await uploadFile(
        { title: title.trim(), description: description.trim(), subject, published: publish },
        file,
        setProgress,
      );
      setDone(`“${item.title}” uploaded to ${item.subject}.`);
      setTitle('');
      setDescription('');
      setFile(null);
      setProgress(null);
      onUploaded();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : (cause as Error).message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section__head">
        <h2 className="admin-section__title">Upload resource</h2>
        <span className="text-secondary text-small">
          {file ? `${file.name} · ${formatBytes(file.size)}` : 'No file selected'}
        </span>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="upload-title">
            Title
          </label>
          <input
            id="upload-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Unit 4 — Laws of Motion"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="upload-description">
            Description <span className="field__hint">(optional)</span>
          </label>
          <textarea
            id="upload-description"
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short summary shown on the subject page."
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label className="field__label" htmlFor="upload-subject">
              Subject
            </label>
            <select
              id="upload-subject"
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

          <div className="field">
            <label className="field__label" htmlFor="upload-file">
              File
            </label>
            <input
              id="upload-file"
              className="input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov,.mp3,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
            <span className="field__hint">
              PDFs, images and video. Large videos are uploaded in parts and can resume after a
              dropped connection.
            </span>
          </div>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
          />
          Publish immediately (visible to students on the subject page)
        </label>

        {progress ? (
          <div className="stack">
            <div className="progress" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress__fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="text-secondary text-small">
              {progress.label} — {progress.percent}% ({formatBytes(progress.loaded)} of{' '}
              {formatBytes(progress.total)})
            </p>
          </div>
        ) : null}

        {error ? <p className="notice notice--error">{error}</p> : null}
        {done ? <p className="notice">{done}</p> : null}

        <div className="inline-actions">
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Uploading…' : 'Upload resource'}
          </button>
        </div>
      </form>
    </section>
  );
}
