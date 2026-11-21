/// <reference types="vite/client" />

// Allow static image imports (PNG, SVG, etc.)
declare module '*.png' {
  const value: string
  export default value
}
declare module '*.svg' {
  const value: string
  export default value
}
