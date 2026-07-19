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
import { UploadDropzone } from '@/components/onboarding/UploadDropzone';
import { SourceStatusCard } from '@/components/onboarding/SourceStatusCard';
import { MetaConnectPanel } from '@/components/onboarding/MetaConnectPanel';
import { ProcessingTimeline } from '@/components/onboarding/ProcessingTimeline';
import { BusinessContextReview } from '@/components/onboarding/BusinessContextReview';
import { AdAccountSelector } from '@/components/onboarding/AdAccountSelector';
import { CompletionSummary } from '@/components/onboarding/CompletionSummary';
import { SidebarContextPanel } from '@/components/onboarding/SidebarContextPanel';

function helperTextForStep(stepKey: string): string {
  switch (stepKey) {
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
      if (s.sources.some((src) => src.id === 'src_brand_voice')) return s;

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

  const selectAdAccount = (accountId: string) => {
    setState((s) => ({ ...s, selectedAdAccountId: accountId }));
  };

  const updateProfile = (field: keyof MockOnboardingState['compiledProfile'], value: unknown) => {
    setState((s) => ({
      ...s,
      compiledProfile: { ...s.compiledProfile, [field]: value },
    }));
  };

  const step = ONBOARDING_STEPS[currentIndex];
  const canGoNext = canContinueFromStep(state, currentIndex);
  const isFinalStep = currentIndex === ONBOARDING_STEPS.length - 1;
  const isSkippedMeta = state.metaConnection.status === 'skipped';
  const isReviewStep = step.key === 'review-business-context';

  const skippedStepKeys = isSkippedMeta ? ['connect-meta', 'select-ad-account'] : [];

  const renderStep = () => {
    switch (step.key) {
      case 'add-business-sources':
        return (
          <div className="grid gap-6">
            <OnboardingCard>
              <label className="block text-sm font-medium text-foreground">
                Primary objective
              </label>
              <select
                value={state.selectedObjective ?? ''}
                onChange={(e) => selectObjective(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <option value="" disabled>
                  Select an objective
                </option>
                {state.objectiveOptions.map((objective) => (
                  <option key={objective.id} value={objective.id}>
                    {objective.title}
                  </option>
                ))}
              </select>
            </OnboardingCard>
            <UploadDropzone onMockUpload={mockUpload} />
            {state.sources.length > 0 && (
              <div className="grid gap-3">
                {state.sources.map((source) => (
                  <SourceStatusCard key={source.id} source={source} />
                ))}
              </div>
            )}
            <OnboardingCard>
              <label className="block text-sm font-medium text-foreground">
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
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, DOCX, PPTX, XLSX up to 50MB. You can also paste notes directly above.
            </p>
          </div>
        );

      case 'connect-meta':
        return (
          <MetaConnectPanel
            status={state.metaConnection.status}
          />
        );

      case 'processing':
        return <ProcessingTimeline processing={state.processing} />;

      case 'review-business-context':
        return (
          <BusinessContextReview
            profile={state.compiledProfile}
            onUpdateProfile={updateProfile}
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
            onBack={goBack}
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
      layout={step.key === 'processing' || isReviewStep || step.key === 'select-ad-account' || step.key === 'setup-complete' ? 'centered' : 'sidebar'}
      sidebar={step.key === 'processing' || isReviewStep || step.key === 'setup-complete' ? undefined : <SidebarContextPanel state={state} variant={step.key === 'connect-meta' ? 'meta' : 'default'} />}
      onBack={goBack}
      canGoBack={currentIndex > 0}
      footer={step.key === 'setup-complete' ? null : (
        <OnboardingActionFooter>
          {step.key === 'add-business-sources' ? (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Files are encrypted and only used to train NOVA
              </span>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={goNext}>
                  Skip for now
                </Button>
                <Button
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  Let NOVA learn
                </Button>
              </div>
            </div>
          ) : step.key === 'connect-meta' ? (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-muted-foreground">
                NOVA will request read-only access to your Meta ad data
              </span>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => { metaSkip(); goNext(); }}>
                  Do this later
                </Button>
                <Button onClick={metaConnect}>
                  Connect Meta
                </Button>
              </div>
            </div>
          ) : step.key === 'processing' ? (
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Step 3 of 6: Processing deep analysis…
                </span>
              </div>
              <Button disabled={!state.processing.canContinue} onClick={goNext}>
                Next Step
              </Button>
            </div>
          ) : isReviewStep ? (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={currentIndex === 0}
              >
                Back
              </Button>
              <div className="flex items-center gap-4">
                <Button variant="secondary" className="hidden md:flex">
                  Save as Draft
                </Button>
                <Button disabled={!canGoNext} onClick={goNext}>
                  Confirm business context
                </Button>
              </div>
            </div>
          ) : step.key === 'select-ad-account' ? (
            <div className="flex w-full flex-col items-center justify-center gap-4">
              <Button
                onClick={goNext}
                disabled={!canGoNext}
                className="w-full min-w-[240px] md:w-auto"
              >
                Use this account
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By selecting this account, you grant NOVA AI permission to read performance data and suggest optimizations.
              </p>
            </div>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
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
                  <Button asChild>
                    <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <Button onClick={goNext} disabled={!canGoNext}>
                    Continue
                  </Button>
                )}
              </div>
            </>
          )}
        </OnboardingActionFooter>
      )}
    >
      {renderStep()}
    </OnboardingShell>
  );
}
