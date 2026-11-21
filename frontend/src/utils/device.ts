/** Attendance actions are desktop-only. The server enforces this too (User-Agent check). */
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|BlackBerry|webOS|Windows Phone/i

export function isMobileDevice(): boolean {
  return typeof navigator !== 'undefined' && MOBILE_UA.test(navigator.userAgent)
}
