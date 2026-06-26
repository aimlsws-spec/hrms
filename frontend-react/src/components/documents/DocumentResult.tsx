interface Props {
  title: string
  filename?: string
  filepath?: string
  html?: string
  details?: { label: string; value: string }[]
  onReset: () => void
}

function openHtmlDocument(html: string, docTitle: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  // Set title after load so print dialog shows a useful name
  if (win) {
    win.addEventListener('load', () => {
      win.document.title = docTitle
      URL.revokeObjectURL(url)
    })
  }
}

export default function DocumentResult({ title, filename, filepath, html, details = [], onReset }: Props) {
  // Normalise filepath: if it's a server-relative path starting with /files/
  // or /download/ keep as-is; otherwise, if only a filename is present, build
  // the /files/{filename} URL that the backend serves.
  const downloadHref =
    filepath
      ? (filepath.startsWith('http') || filepath.startsWith('/') ? filepath : `/files/${filepath}`)
      : filename
        ? `/files/${filename}`
        : null

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="font-semibold text-green-800">{title} Generated</h4>
          </div>

          {details.map(d => (
            <p key={d.label} className="text-sm text-green-700 mb-1">
              <span className="font-medium">{d.label}:</span> {d.value}
            </p>
          ))}

          {filename && (
            <p className="text-sm text-green-700 mb-4">
              <span className="font-medium">File:</span> {filename}
            </p>
          )}

          <div className="flex gap-3 mt-4 flex-wrap">
            {/* HTML response — open in new tab for print/save-as-PDF */}
            {html && (
              <button
                onClick={() => openHtmlDocument(html, title)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open &amp; Print / Save PDF
              </button>
            )}

            {/* File response — direct download link */}
            {downloadHref && (
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                download={filename}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download PDF
              </a>
            )}
          </div>
        </div>

        <button
          onClick={onReset}
          className="shrink-0 text-green-600 hover:text-green-800 text-sm font-medium"
        >
          ← Generate another
        </button>
      </div>
    </div>
  )
}
