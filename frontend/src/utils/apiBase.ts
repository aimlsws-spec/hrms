import axios from 'axios'

/**
 * The API may live on another host than the website (e.g. site on hrmsf.*, API on hrmsb.*).
 * VITE_API_URL is that address, e.g. "https://hrmsb.pro.seawindsolution.com/api".
 * When it is empty (local dev, or API proxied on the same host) nothing below does anything.
 *
 * Most calls go through api/client.ts, which already uses VITE_API_URL. A few places call
 * axios / fetch / window.open with a bare "/api/..." path; this makes those reach the API host too.
 */
export const API_ORIGIN: string = (import.meta.env.VITE_API_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

const BACKEND_PATH = /^\/(api|auth|images)\//

/** Prefix a root-relative backend path ("/api/...") with the API host. Other URLs are returned unchanged. */
export function withApiBase(url: string): string {
  return API_ORIGIN && BACKEND_PATH.test(url) ? API_ORIGIN + url : url
}

if (API_ORIGIN) {
  axios.defaults.baseURL = API_ORIGIN

  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    nativeFetch(typeof input === 'string' ? withApiBase(input) : input, init)

  const nativeOpen = window.open.bind(window)
  window.open = (url?: string | URL, target?: string, features?: string) =>
    nativeOpen(typeof url === 'string' ? withApiBase(url) : url, target, features)
}
