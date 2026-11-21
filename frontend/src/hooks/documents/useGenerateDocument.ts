import { useState } from 'react'
import { documentsApi } from '../../api/documents'
import type {
  GenerateResult,
  SalarySlipPayload,
  OfferLetterPayload,
  ExperienceLetterPayload,
  RelievingLetterPayload,
  AppointmentLetterPayload,
} from '../../types/document'

type GenerateFn =
  | ((p: SalarySlipPayload) => Promise<{ data: GenerateResult }>)
  | ((p: OfferLetterPayload) => Promise<{ data: GenerateResult }>)
  | ((p: ExperienceLetterPayload) => Promise<{ data: GenerateResult }>)
  | ((p: RelievingLetterPayload) => Promise<{ data: GenerateResult }>)
  | ((p: AppointmentLetterPayload) => Promise<{ data: GenerateResult }>)

export function useGenerateDocument() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<GenerateResult | null>(null)

  async function generate(apiFn: GenerateFn, payload: Parameters<typeof apiFn>[0]) {
    setError('')
    setResult(null)
    setIsLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (apiFn as (p: any) => Promise<{ data: GenerateResult }>)(payload)
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || data.message || 'Generation failed.')
      }
    } catch (err: unknown) {
      // Extract the real error from the HTTP response body when available
      const axErr = err as { response?: { data?: { message?: string; detail?: string } }; message?: string }
      const msg =
        axErr?.response?.data?.message  ||
        axErr?.response?.data?.detail   ||
        axErr?.message                  ||
        'Connection failed. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function appointmentLetter(payload: AppointmentLetterPayload) {
    setError('')
    setResult(null)
    setIsLoading(true)
    try {
      const { data } = await documentsApi.generateAppointmentLetter(payload)
      if (data.success) {
        setResult(data)
      } else {
        setError(data.message || 'Generation failed.')
      }
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } }; message?: string }
      setError(axErr?.response?.data?.message || axErr?.message || 'Connection failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const generators = {
    salarySlip:       (p: SalarySlipPayload)       => generate(documentsApi.generateSalarySlip, p),
    offerLetter:      (p: OfferLetterPayload)       => generate(documentsApi.generateOfferLetter, p),
    experienceLetter: (p: ExperienceLetterPayload)  => generate(documentsApi.generateExperienceLetter, p),
    relievingLetter:  (p: RelievingLetterPayload)   => generate(documentsApi.generateRelievingLetter, p),
    appointmentLetter,
  }

  function reset() {
    setResult(null)
    setError('')
  }

  return { isLoading, error, result, reset, ...generators }
}
