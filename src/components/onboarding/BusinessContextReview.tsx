import { AlertCircle } from 'lucide-react'
import { OnboardingCard } from './OnboardingCard'
import { toProfileSections } from '@/lib/onboarding/profile-view'
import type { OnboardingReview } from '@/lib/onboarding/api'

type BusinessContextReviewProps = {
  review: OnboardingReview
  canApprove: boolean
}

export function BusinessContextReview({ review, canApprove }: BusinessContextReviewProps) {
  const sections = toProfileSections(review.profile)

  return (
    <div className="grid gap-6">
      {sections.length === 0 && (
        <OnboardingCard>
          <p className="text-sm text-[#645d58]">No business context compiled yet.</p>
        </OnboardingCard>
      )}

      {sections.map((section) => (
        <OnboardingCard key={section.key}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">
            {section.title}
          </h3>
          <div className="grid gap-3">
            {section.fields.map((field) => (
              <div key={field.label}>
                <p className="text-xs font-medium text-[#8d716b]">{field.label}</p>
                {renderValue(field.value)}
              </div>
            ))}
          </div>
        </OnboardingCard>
      ))}

      {review.unresolvedFields.length > 0 && (
        <OnboardingCard>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Missing Information</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-[#645d58]">
            {review.unresolvedFields.map((field) => (
              <li key={field}>{humanizeKey(field)}</li>
            ))}
          </ul>
        </OnboardingCard>
      )}

      {review.warnings.length > 0 && (
        <OnboardingCard>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Warnings</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-[#645d58]">
            {review.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </OnboardingCard>
      )}

      {review.sources.length > 0 && (
        <OnboardingCard>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Sources</h3>
          <div className="grid gap-2">
            {review.sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3">
                <span className="text-sm text-[#251816]">{s.name}</span>
                <span className="text-xs text-[#8d716b]">{s.type} &mdash; {s.status}</span>
              </div>
            ))}
          </div>
        </OnboardingCard>
      )}

      {review.questions.length > 0 && (
        <OnboardingCard>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Clarifying Questions</h3>
          <div className="grid gap-4">
            {review.questions.map((q) => (
              <div key={q.factKey} className="rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3">
                <p className="text-sm font-medium text-[#251816]">{q.question}</p>
                {q.answer != null && (
                  <p className="mt-2 text-sm text-[#645d58]">
                    {Array.isArray(q.answer) ? (q.answer as unknown[]).map(formatItem).join(', ') : String(q.answer)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </OnboardingCard>
      )}

      {!canApprove && (
        <div className="flex items-start gap-3 rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3 text-sm text-[#645d58]">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#8d716b]" />
          Workspace admin approval is required before NOVA uses this context.
        </div>
      )}
    </div>
  )
}

function formatItem(item: unknown): string {
  return typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)
}

function renderValue(value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-sm text-[#645d58]">None</p>
    return (
      <ul className="list-inside list-disc space-y-1 text-sm text-[#251816]">
        {value.map((item, i) => <li key={i}>{formatItem(item)}</li>)}
      </ul>
    )
  }
  if (value === null || value === undefined) {
    return <p className="text-sm italic text-[#8d716b]">No data</p>
  }
  if (typeof value === 'object') {
    return <p className="text-sm text-[#251816]">{JSON.stringify(value)}</p>
  }
  return <p className="text-sm font-medium text-[#251816]">{String(value)}</p>
}

function humanizeKey(key: string): string {
  return key
    .split('.')
    .map((part) => part.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' / ')
}
