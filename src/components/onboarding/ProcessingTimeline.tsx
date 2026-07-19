import { CheckCircle2, Loader2, Globe, FileText } from 'lucide-react';
import { OnboardingCard } from './OnboardingCard';
import type { MockProcessingState, MockSource } from '@/lib/onboarding/types';

type ProcessingTimelineProps = {
  processing: MockProcessingState;
};

type PipelineStep = {
  label: string;
  status: 'complete' | 'processing' | 'pending';
};

function getPipelineSteps(processing: MockProcessingState): PipelineStep[] {
  const sources = processing.sources;
  const hasCompleteWebsite = sources.some(
    (s) => s.sourceType === 'website' && s.status === 'complete',
  );
  const hasProcessingSource = sources.some((s) => s.status === 'processing');

  return [
    { label: 'Crawling website', status: hasCompleteWebsite ? 'complete' : 'pending' },
    { label: 'Reading uploaded documents', status: 'pending' },
    { label: 'Extracting products', status: hasProcessingSource ? 'processing' : 'pending' },
    { label: 'Identifying audiences', status: 'pending' },
    { label: 'Building context', status: 'pending' },
  ];
}

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'complete') {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <CheckCircle2 className="size-5" />
      </div>
    );
  }
  if (status === 'processing') {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <div className="size-2 rounded-full bg-current" />
    </div>
  );
}

function WebsiteSourceCard({ source }: { source: MockSource }) {
  return (
    <OnboardingCard>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">Website URL</span>
        </div>
        <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success uppercase">
          Active
        </span>
      </div>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-muted p-3 font-mono text-sm text-muted-foreground">
        {source.externalReference ?? source.sourceName}
      </div>
    </OnboardingCard>
  );
}

function UploadSourceCard({ source }: { source: MockSource }) {
  return (
    <OnboardingCard>
      <div className="mb-4 flex items-center gap-2">
        <FileText className="size-5 text-primary" />
        <span className="text-lg font-semibold text-foreground">{source.sourceName}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${source.progress}%` }}
          />
        </div>
        <span className="text-sm font-bold text-primary">{source.progress}%</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Extracting value propositions...</p>
    </OnboardingCard>
  );
}

export function ProcessingTimeline({ processing }: ProcessingTimelineProps) {
  const steps = getPipelineSteps(processing);
  const websiteSource = processing.sources.find((s) => s.sourceType === 'website');
  const uploadSource = processing.sources.find((s) => s.sourceType === 'upload');

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <OnboardingCard className="md:row-span-2">
        <h3 className="mb-4 border-b border-border pb-4 text-xl font-semibold text-foreground">
          Analysis Pipeline
        </h3>
        <ul className="flex flex-col gap-6">
          {steps.map((step) => (
            <li
              key={step.label}
              className={`flex items-center gap-4 ${step.status === 'pending' ? 'opacity-50' : ''}`}
            >
              <StepIcon status={step.status} />
              <span
                className={`text-sm ${
                  step.status === 'processing'
                    ? 'font-semibold text-foreground'
                    : step.status === 'complete'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      </OnboardingCard>

      {websiteSource && <WebsiteSourceCard source={websiteSource} />}
      {uploadSource && <UploadSourceCard source={uploadSource} />}
    </div>
  );
}
