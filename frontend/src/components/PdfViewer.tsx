import { useEffect, useRef, useState } from 'react';

interface PdfViewerProps {
  url: string;
  title: string;
}

/** Zoom steps offered next to the PDF. `null` means "fit the width". */
const ZOOM_STEPS = [null, 1, 1.5, 2] as const;

/** The bits of the PDF.js API this component uses. */
interface PdfJsApi {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: {
    url: string;
    withCredentials?: boolean;
    isEvalSupported?: boolean;
  }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (options: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (options: {
          canvasContext: CanvasRenderingContext2D;
          viewport: unknown;
        }) => { promise: Promise<void> };
      }>;
      cleanup: () => Promise<void>;
    }>;
    destroy: () => Promise<void>;
  };
}

/**
 * Renders a PDF with PDF.js.
 *
 * A WebView -- which is what the kiosk uses -- cannot draw PDFs itself, so
 * the portal falls back to this renderer when it detects it is running inside
 * the kiosk WebView. Chrome keeps its own, nicer, PDF viewer.
 *
 * PDF.js 3.x is used deliberately: the kiosk tablets run a WebView from
 * 2021 (Chrome 94) and PDF.js 4+ needs a much newer browser.
 */
export function PdfViewer({ url, title }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    setLoading(true);
    setError(null);
    setPageCount(0);

    async function render(host: HTMLDivElement) {
      try {
        const [module, worker] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.js?url'),
        ]);

        if (cancelled) return;

        const pdfjs = ((module as { default?: PdfJsApi }).default ?? module) as PdfJsApi;
        const workerSrc = (worker as { default?: string }).default ?? '';
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

        const task = pdfjs.getDocument({ url, withCredentials: false, isEvalSupported: false });
        const doc = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }

        setPageCount(doc.numPages);
        host.replaceChildren();

        const zoom = ZOOM_STEPS[zoomIndex];
        const available = host.clientWidth || 800;

        for (let number = 1; number <= doc.numPages; number += 1) {
          if (cancelled) break;
          const page = await doc.getPage(number);
          if (cancelled) break;

          const base = page.getViewport({ scale: 1 });
          const scale = zoom ?? Math.min(2, available / base.width);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.maxWidth = `${Math.floor(viewport.width)}px`;
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto var(--space-3)';
          canvas.style.borderRadius = 'var(--radius-button)';
          canvas.style.background = '#FFFFFF';
          host.appendChild(canvas);

          const context = canvas.getContext('2d');
          if (!context) continue;
          await page.render({ canvasContext: context, viewport }).promise;
        }

        await doc.cleanup();
        await task.destroy();
        if (!cancelled) setLoading(false);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'This PDF could not be opened.');
        setLoading(false);
      }
    }

    void render(container);

    return () => {
      cancelled = true;
    };
  }, [url, zoomIndex]);

  return (
    <div className="stack">
      <div className="inline-actions pdf-controls">
        <span className="text-secondary text-small">
          {loading ? 'Loading…' : `${pageCount} page${pageCount === 1 ? '' : 's'}`}
        </span>
        <span className="pdf-zoom">
          <button
            type="button"
            className="button button--secondary button--small"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
          >
            −
          </button>
          <span className="text-secondary text-small">
            {ZOOM_STEPS[zoomIndex] === null ? 'Fit' : `${ZOOM_STEPS[zoomIndex]}×`}
          </span>
          <button
            type="button"
            className="button button--secondary button--small"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))}
          >
            +
          </button>
        </span>
        <a className="button button--soft button--small" href={url} download>
          Download
        </a>
      </div>

      {error ? <p className="notice notice--error">{error}</p> : null}

      <div className="viewer__stage viewer__stage--pdf">
        {loading ? (
          <div className="loading-row">
            <span className="spinner" aria-hidden="true" />
            Loading {title}…
          </div>
        ) : null}
        <div ref={containerRef} className="pdf-pages" />
      </div>
    </div>
  );
}
