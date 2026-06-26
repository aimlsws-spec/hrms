/**
 * WebcamCapture — browser camera capture component for WFH selfie evidence.
 *
 * IMPORTANT NOTICE (rendered to employee):
 *   "This selfie is collected as attendance evidence only
 *    and is not used for biometric identification."
 *
 * Capture flow:
 *   pre-prompt → camera init → live preview → capture → review → confirm → upload
 *
 * Max 3 retake attempts. Camera stream stopped immediately after upload.
 * No image data retained in browser memory after upload completes.
 */
import { useRef, useState, useCallback, useEffect } from 'react'

const MAX_ATTEMPTS = 3
const JPEG_QUALITY = 0.85

export interface CaptureResult {
  blob:         Blob
  cameraLabel:  string
  attemptCount: number
}

interface Props {
  onCapture:   (result: CaptureResult) => Promise<void>  // called when employee confirms
  onSkip:      () => void                                 // proceed without selfie (HR review path)
  isUploading: boolean
  uploadError: string | null
}

type Stage =
  | 'consent'     // pre-permission explanation
  | 'init'        // getUserMedia in progress
  | 'preview'     // live camera stream
  | 'captured'    // frozen frame, retake / confirm buttons
  | 'uploading'   // upload in progress
  | 'done'        // upload complete

interface CameraError {
  code:    'PERMISSION_DENIED' | 'NOT_FOUND' | 'IN_USE' | 'UNAVAILABLE' | 'UNKNOWN'
  message: string
  guide:   string
}

function classifyError(err: unknown): CameraError {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return {
      code:    'PERMISSION_DENIED',
      message: 'Camera access was blocked.',
      guide:   'Click the camera icon in your browser address bar → Allow, then refresh.',
    }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return {
      code:    'NOT_FOUND',
      message: 'No camera was found on this computer.',
      guide:   '',
    }
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return {
      code:    'IN_USE',
      message: 'Camera is in use by another application.',
      guide:   'Close any video call or camera software and try again.',
    }
  return {
    code:    'UNKNOWN',
    message: 'Camera could not be started.',
    guide:   'Try refreshing the page. If the problem persists, use the "Skip" option.',
  }
}

export default function WebcamCapture({ onCapture, onSkip, isUploading, uploadError }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)

  const [stage,        setStage]        = useState<Stage>('consent')
  const [cameraError,  setCameraError]  = useState<CameraError | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl,  setCapturedUrl]  = useState<string | null>(null)
  const [cameraLabel,  setCameraLabel]  = useState('')
  const [attemptCount, setAttemptCount] = useState(0)

  // Stop stream on unmount
  useEffect(() => {
    return () => stopStream()
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function revokeCapturedUrl() {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl)
      setCapturedUrl(null)
    }
  }

  const startCamera = useCallback(async () => {
    setStage('init')
    setCameraError(null)
    try {
      // Prefer HD resolution; browser may downgrade based on hardware
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream

      // Capture device label (audit signal — may indicate virtual camera)
      const videoTrack = stream.getVideoTracks()[0]
      setCameraLabel(videoTrack?.label ?? '')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStage('preview')
    } catch (err) {
      stopStream()
      setCameraError(classifyError(err))
      setStage('consent') // return to consent so employee can choose Skip
    }
  }, [])

  const captureFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    revokeCapturedUrl()

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setCapturedUrl(URL.createObjectURL(blob))
        setAttemptCount(n => n + 1)
        stopStream() // stop live stream — show frozen frame
        setStage('captured')
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  }, [capturedUrl])

  const retake = useCallback(async () => {
    revokeCapturedUrl()
    setCapturedBlob(null)
    await startCamera()
  }, [startCamera])

  const confirmAndUpload = useCallback(async () => {
    if (!capturedBlob) return
    setStage('uploading')
    await onCapture({ blob: capturedBlob, cameraLabel, attemptCount })
    // Parent controls isUploading; set done only on success (parent will re-render or dismiss)
    setStage('done')
    revokeCapturedUrl()
    setCapturedBlob(null)
  }, [capturedBlob, cameraLabel, attemptCount, onCapture])

  // ── Render ─────────────────────────────────────────────────────────────────

  const btnPrimary = 'flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors'
  const btnOutline = 'flex items-center justify-center gap-2 h-10 px-5 border-2 border-gray-200 text-gray-600 hover:bg-gray-50 text-[13px] font-semibold rounded-xl transition-colors'

  // Consent screen — always shown first, and on camera error
  if (stage === 'consent' || (stage === 'init' && !cameraError)) {
    return (
      <div className="space-y-4">
        {/* Compliance notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-[12px] font-semibold text-blue-700 mb-1">
            <i className="fa-solid fa-circle-info mr-1.5" />
            Attendance Evidence Notice
          </p>
          <p className="text-[12px] text-blue-600 leading-relaxed">
            This selfie is collected as attendance evidence only and is{' '}
            <strong>not used for biometric identification</strong>. It is
            stored securely and reviewed by HR only when attendance is
            disputed or flagged. It is automatically deleted after 12 months.
          </p>
        </div>

        {/* Camera error (if previous attempt failed) */}
        {cameraError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1">
            <p className="text-[13px] font-semibold text-red-700">
              <i className="fa-solid fa-circle-exclamation mr-1.5" />
              {cameraError.message}
            </p>
            {cameraError.guide && (
              <p className="text-[12px] text-red-600">{cameraError.guide}</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={startCamera}
            disabled={stage === 'init'}
            className={btnPrimary + ' flex-1'}
          >
            {stage === 'init'
              ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Starting camera…</>
              : <><i className="fa-solid fa-camera text-[12px]" /> Open Camera</>
            }
          </button>
          <button onClick={onSkip} className={btnOutline + ' shrink-0'}>
            Skip
          </button>
        </div>

        {cameraError?.code === 'NOT_FOUND' && (
          <p className="text-[11px] text-gray-400 text-center">
            No camera detected — your attendance will be submitted for HR review without a selfie.
          </p>
        )}
      </div>
    )
  }

  // Live preview
  if (stage === 'preview') {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          {/* Face guide oval */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <ellipse
              cx="50" cy="50" rx="28" ry="36"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          </svg>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            aria-label="Live camera preview — centre your face in the oval guide"
          />
        </div>
        <p className="text-[11px] text-center text-gray-400">
          Centre your face in the oval. Ensure you are well lit.
        </p>
        <div className="flex gap-3">
          <button onClick={captureFrame} className={btnPrimary + ' flex-1'}>
            <i className="fa-solid fa-camera text-[12px]" />
            {attemptCount > 0 ? `Take Selfie (Attempt ${attemptCount + 1} of ${MAX_ATTEMPTS})` : 'Take Selfie'}
          </button>
          <button onClick={onSkip} className={btnOutline + ' shrink-0'}>Skip</button>
        </div>
      </div>
    )
  }

  // Frozen captured frame — review before confirming
  if (stage === 'captured') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          {capturedUrl && (
            <img
              src={capturedUrl}
              alt="Captured selfie preview"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        {uploadError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2">
            <p className="text-[12px] text-red-600">
              <i className="fa-solid fa-circle-exclamation mr-1.5" />
              {uploadError}
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={confirmAndUpload}
            disabled={isUploading}
            className={btnPrimary + ' flex-1'}
          >
            {isUploading
              ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Uploading…</>
              : <><i className="fa-solid fa-check text-[12px]" /> Looks Good — Continue</>
            }
          </button>
          {attemptCount < MAX_ATTEMPTS && !isUploading && (
            <button onClick={retake} className={btnOutline + ' shrink-0'}>
              <i className="fa-solid fa-rotate-left text-[12px]" /> Retake
            </button>
          )}
        </div>
        {attemptCount >= MAX_ATTEMPTS && (
          <p className="text-[11px] text-center text-amber-600">
            Maximum retakes reached — this photo will be used.
          </p>
        )}
      </div>
    )
  }

  // Done
  if (stage === 'done') {
    return (
      <div className="flex items-center gap-2 py-3 text-emerald-600">
        <i className="fa-solid fa-circle-check text-[18px]" />
        <p className="text-[13px] font-semibold">Selfie captured and submitted.</p>
      </div>
    )
  }

  // Hidden canvas for frame capture (never rendered visibly)
  return <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
}
