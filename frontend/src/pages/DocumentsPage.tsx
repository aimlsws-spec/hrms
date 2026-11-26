import { useState } from 'react'
import Card from '../components/ui/Card'
import DocumentCard from '../components/documents/DocumentCard'
import OfferLetterForm from '../components/documents/OfferLetterForm'
import ExperienceLetterForm from '../components/documents/ExperienceLetterForm'
import RelievingLetterForm from '../components/documents/RelievingLetterForm'
import AppointmentLetterForm from '../components/documents/AppointmentLetterForm'
import SalarySlipForm from '../components/documents/SalarySlipForm'

type ActiveDoc = 'appointment' | 'offer' | 'salary' | 'relieving' | 'experience' | null

const DOCS = [
  {
    id: 'appointment' as const,
    title: 'Appointment Letter',
    description: 'Create appointment letter',
    color: 'green' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'offer' as const,
    title: 'Offer Letter',
    description: 'Create job offer letter',
    color: 'blue' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'salary' as const,
    title: 'Salary Slip',
    description: 'Generate employee payslip',
    color: 'green' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'relieving' as const,
    title: 'Relieving Letter',
    description: 'Exit documentation',
    color: 'orange' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  },
  {
    id: 'experience' as const,
    title: 'Experience Certificate',
    description: 'Work experience proof',
    color: 'purple' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
] as const

export default function DocumentsPage() {
  const [activeDoc, setActiveDoc] = useState<ActiveDoc>(null)

  function handleCardClick(id: ActiveDoc) {
    setActiveDoc(prev => (prev === id ? null : id))
  }
  
  function handleCancel() {
    setActiveDoc(null)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Generation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            HR enters employee details manually to generate official appointment letters, offer letters, salary slips, and certificates.
          </p>
        </div>
      </div>

      {/* Template notice banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
          <i className="fa-solid fa-file-signature text-xs" />
        </div>
        <div className="text-xs text-indigo-900">
          <p className="font-semibold">Company Template Formats</p>
          <p className="text-indigo-700/90 mt-0.5">
            Documents are generated using standard company formatting. To support custom organizational letterheads, seals, or specific clauses, HR can share the official templates/formats with the engineering team.
          </p>
        </div>
      </div>

      {/* Document cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {DOCS.map(doc => (
          <DocumentCard
            key={doc.id}
            title={doc.title}
            description={doc.description}
            icon={doc.icon}
            color={doc.color}
            isActive={activeDoc === doc.id}
            onClick={() => handleCardClick(doc.id)}
          />
        ))}
      </div>

      {/* Selected document form */}
      {activeDoc && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-5">
            {DOCS.find(d => d.id === activeDoc)?.title}
          </h3>
          {activeDoc === 'appointment' && <AppointmentLetterForm onCancel={handleCancel} />}
          {activeDoc === 'offer'       && <OfferLetterForm       onCancel={handleCancel} />}
          {activeDoc === 'salary'      && <SalarySlipForm        onCancel={handleCancel} />}
          {activeDoc === 'relieving'   && <RelievingLetterForm   onCancel={handleCancel} />}
          {activeDoc === 'experience'  && <ExperienceLetterForm  onCancel={handleCancel} />}
        </Card>
      )}

      {!activeDoc && (
        <Card>
          <p className="text-sm text-gray-400 text-center py-6">
            Select a document type above to begin generation.
          </p>
        </Card>
      )}
    </div>
  )
}
