'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { mockOnboardingState } from '@/lib/onboarding/mock-data';
import { canContinueFromStep, getCompletionStatus, getNextStepIndex, ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import type { MockOnboardingState, MockSource } from '@/lib/onboarding/types';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { OnboardingActionFooter } from '@/components/onboarding/OnboardingActionFooter';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import { ObjectiveCard } from '@/components/onboarding/ObjectiveCard';
import { UploadDropzone } from '@/components/onboarding/UploadDropzone';
import { SourceStatusCard } from '@/components/onboarding/SourceStatusCard';
import { MetaConnectPanel } from '@/components/onboarding/MetaConnectPanel';
import { ProcessingTimeline } from '@/components/onboarding/ProcessingTimeline';
import { BusinessContextReview } from '@/components/onboarding/BusinessContextReview';
import { AdAccountSelector } from '@/components/onboarding/AdAccountSelector';
import { CompletionSummary } from '@/components/onboarding/CompletionSummary';

function helperTextForStep(stepKey: string): string {
  switch (stepKey) {
    case 'business-basics':
      return 'Review and confirm your business details before continuing.';
    case 'primary-objective':
      return 'Pick one objective to focus NOVA\'s setup.';
    case 'add-business-sources':
      return 'Add at least one source or note so NOVA has context to work with.';
    case 'connect-meta':
      return 'You can skip this and connect later from Settings.';
    case 'processing':
      return 'Wait for NOVA to finish analyzing your sources.';
    case 'review-business-context':
      return 'Read through the compiled profile and flag anything that needs changes.';
    case 'select-ad-account':
      return 'Choose the ad account you want NOVA to manage.';
    case 'setup-complete':
      return 'Setup is done. Head to the dashboard to start working.';
    default:
      return '';
  }
}

export default function OnboardingPage() {
  const [state, setState] = useState<MockOnboardingState>(() => structuredClone(mockOnboardingState));
  const [currentIndex, setCurrentIndex] = useState(0);

  const goBack = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const goNext = () => {
    setCurrentIndex(getNextStepIndex(state, currentIndex));
  };

  const selectObjective = (objectiveId: string) => {
    setState((s) => ({ ...s, selectedObjective: objectiveId }));
  };

  const updateManualNotes = (notes: string) => {
    setState((s) => ({ ...s, manualNotes: notes }));
  };

  const mockUpload = () => {
    setState((s) => {
      if (s.sources.some((src) => src.sourceName === 'Brand voice notes.pdf')) return s;

      const uploadSource: MockSource = {
        id: 'src_brand_voice',
        sourceType: 'upload',
        sourceName: 'Brand voice notes.pdf',
        externalReference: null,
        status: 'complete',
        currentStage: 'extracted',
        progress: 100,
        error: null,
      };

      return {
        ...s,
        sources: [...s.sources, uploadSource],
        processing: {
          ...s.processing,
          sources: [...s.processing.sources, uploadSource],
        },
      };
    });
  };

  const metaConnect = () => {
    setState((s) => ({
      ...s,
      metaConnection: {
        status: 'connected',
        connectionId: 'conn_mock_meta',
        connectedAt: new Date().toISOString(),
        error: null,
      },
      selectedAdAccountId: null,
    }));
  };

  const metaSkip = () => {
    setState((s) => ({
      ...s,
      metaConnection: {
        status: 'skipped',
        connectionId: null,
        connectedAt: null,
        error: null,
      },
      selectedAdAccountId: null,
    }));
  };

  const metaRetry = () => {
    setState((s) => ({
      ...s,
      metaConnection: {
        status: 'not_connected',
        connectionId: null,
        connectedAt: null,
        error: null,
      },
      selectedAdAccountId: null,
    }));
  };

  const markReadyForReview = () => {
    setState((s) => ({
      ...s,
      processing: {
        overallStatus: 'ready',
        currentMessage: 'Business context is ready for review.',
        sources: s.processing.sources.map((src) => ({
          ...src,
          status: 'complete' as const,
          progress: 100,
        })),
        blockers: [],
        canContinue: true,
      },
    }));
  };

  const selectAdAccount = (accountId: string) => {
    setState((s) => ({ ...s, selectedAdAccountId: accountId }));
  };

  const step = ONBOARDING_STEPS[currentIndex];
  const canGoNext = canContinueFromStep(state, currentIndex);
  const isFinalStep = currentIndex === ONBOARDING_STEPS.length - 1;
  const isSkippedMeta = state.metaConnection.status === 'skipped';

  const skippedStepKeys = isSkippedMeta ? ['connect-meta', 'select-ad-account'] : [];

  const renderStep = () => {
    switch (step.key) {
      case 'business-basics':
        return (
          <OnboardingCard>
            <h3 className="text-lg font-semibold text-[#251816]">{state.business.name}</h3>
            <p className="mt-1 text-sm text-[#645d58]">
              {state.business.websiteUrl || 'Website not provided'}
            </p>
            <div className="mt-4 space-y-2 text-sm text-[#645d58]">
              <p>
                <span className="font-medium text-[#251816]">Workspace:</span>{' '}
                {state.business.workspaceId}
              </p>
              <p>
                <span className="font-medium text-[#251816]">Status:</span>{' '}
                {state.business.status}
              </p>
            </div>
            <p className="mt-6 text-sm text-[#645d58]">
              Confirm these details are correct before continuing. You can update them later from Settings.
            </p>
          </OnboardingCard>
        );

      case 'primary-objective':
        return (
          <div className="grid gap-4">
            {state.objectiveOptions.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                selected={state.selectedObjective === objective.id}
                onSelect={() => selectObjective(objective.id)}
              />
            ))}
          </div>
        );

      case 'add-business-sources':
        return (
          <div className="grid gap-6">
            <UploadDropzone onMockUpload={mockUpload} />
            {state.sources.length > 0 && (
              <div className="grid gap-3">
                {state.sources.map((source) => (
                  <SourceStatusCard key={source.id} source={source} />
                ))}
              </div>
            )}
            <OnboardingCard>
              <label className="block text-sm font-medium text-[#251816]">
                Manual notes
              </label>
              <Textarea
                value={state.manualNotes}
                onChange={(e) => updateManualNotes(e.target.value)}
                placeholder="Add any additional context about your business..."
                className="mt-2"
                rows={4}
              />
            </OnboardingCard>
            <p className="text-xs text-[#8d716b]">
              Supported formats: PDF, DOCX, PPTX, XLSX up to 50MB. You can also paste notes directly above.
            </p>
          </div>
        );

      case 'connect-meta':
        return (
          <MetaConnectPanel
            status={state.metaConnection.status}
            onConnect={metaConnect}
            onSkip={metaSkip}
            onRetry={metaRetry}
          />
        );

      case 'processing':
        return (
          <div className="grid gap-4">
            <ProcessingTimeline processing={state.processing} />
            {!state.processing.canContinue && (
              <Button variant="outline" onClick={markReadyForReview}>
                Mark ready for review
              </Button>
            )}
          </div>
        );

      case 'review-business-context':
        return (
          <BusinessContextReview
            profile={state.compiledProfile}
            questions={state.questions}
            canApprove={state.permissions.canApprove}
          />
        );

      case 'select-ad-account':
        return (
          <AdAccountSelector
            metaStatus={state.metaConnection.status}
            accounts={state.adAccounts}
            selectedAdAccountId={state.selectedAdAccountId}
            onSelect={selectAdAccount}
            onRefresh={() => {}}
            onRetryMeta={metaRetry}
          />
        );

      case 'setup-complete':
        return (
          <CompletionSummary
            state={state}
            completionStatus={getCompletionStatus(state)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingShell
      currentIndex={currentIndex}
      skippedStepKeys={skippedStepKeys}
      onBack={goBack}
      canGoBack={currentIndex > 0}
      footer={
        <OnboardingActionFooter>
          <span className="text-sm text-[#8d716b]">
            {helperTextForStep(step.key)}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={currentIndex === 0}
            >
              Back
            </Button>
            {isFinalStep ? (
              <Button asChild className="bg-[#aa3016] text-white hover:bg-[#d14a2e]">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canGoNext} className="bg-[#aa3016] text-white hover:bg-[#d14a2e]">
                Continue
              </Button>
            )}
          </div>
        </OnboardingActionFooter>
      }
    >
      {renderStep()}
    </OnboardingShell>
  );
}
