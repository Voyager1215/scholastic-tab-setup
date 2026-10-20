/**
 * Detects the environment the portal is running in.
 *
 * The kiosk opens the portal in the DPC's own WebView (see PortalActivity in
 * the DPC). A WebView cannot draw PDFs, so the portal swaps in its own PDF
 * renderer there. Chrome keeps its native, nicer, PDF viewer.
 *
 * The DPC appends a `KioskPortal/1.0` token to the WebView's user agent, so
 * the check is exact rather than a guess. The generic WebView markers are
 * checked as a fallback.
 */

const KIOSK_TOKEN = 'KioskPortal/';

export function isKioskWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;

  if (ua.includes(KIOSK_TOKEN)) return true;
  if (ua.includes('; wv') || ua.includes('WebView')) return true;
  return false;
}
