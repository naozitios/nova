'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { mockOnboardingState } from '@/lib/onboarding/mock-data';
import { canContinueFromStep, getCompletionStatus, getNextStepIndex, ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import type { BusinessBasics, MockOnboardingState, MockSource } from '@/lib/onboarding/types';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { OnboardingActionFooter } from '@/components/onboarding/OnboardingActionFooter';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import { BusinessBasicsForm } from '@/components/onboarding/BusinessBasicsForm';
import { UploadDropzone } from '@/components/onboarding/UploadDropzone';
import { SourceStatusCard } from '@/components/onboarding/SourceStatusCard';
import { MetaConnectPanel } from '@/components/onboarding/MetaConnectPanel';
import { ProcessingTimeline } from '@/components/onboarding/ProcessingTimeline';
import { BusinessContextReview } from '@/components/onboarding/BusinessContextReview';
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

  const updateBusinessBasics = (update: Partial<BusinessBasics>) => {
    setState((s) => ({ ...s, businessBasics: { ...s.businessBasics, ...update } }));
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

  const skippedStepKeys = isSkippedMeta ? ['connect-meta'] : [];

  const renderStep = () => {
    switch (step.key) {
      case 'business-basics':
        return (
          <BusinessBasicsForm
            value={state.businessBasics}
            onChange={updateBusinessBasics}
          />
        );

      case 'add-business-sources':
        return (
          <div className="grid gap-6">
            <UploadDropzone onMockUpload={mockUpload} />
            <OnboardingCard>
              <label className="block text-xl font-semibold text-foreground mb-4">
                Brand Specific Notes
              </label>
              <Textarea
                value={state.manualNotes}
                onChange={(e) => updateManualNotes(e.target.value)}
                placeholder="Paste specific campaign goals, prohibited terminology, or unique brand voice instructions..."
                className="mt-2"
                rows={4}
              />
              <div className="flex justify-end mt-4">
                <span className="text-xs text-muted-foreground">{state.manualNotes.length} / 2000 characters</span>
              </div>
            </OnboardingCard>
          </div>
        );

      case 'connect-meta':
        return (
          <MetaConnectPanel
            status={state.metaConnection.status}
            adAccounts={state.adAccounts}
            selectedAccountId={state.selectedAdAccountId}
            onSelectAccount={selectAdAccount}
            onRefresh={() => {}}
            onConnect={metaConnect}
            onSkip={() => { metaSkip(); goNext(); }}
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
      layout={step.key === 'business-basics' || step.key === 'processing' || isReviewStep || step.key === 'select-ad-account' || step.key === 'setup-complete' ? 'centered' : 'sidebar'}
      sidebar={step.key === 'processing' || isReviewStep || step.key === 'setup-complete' ? undefined : <SidebarContextPanel state={state} variant={step.key === 'connect-meta' ? 'meta' : step.key === 'add-business-sources' ? 'active-sources' : 'default'} />}
      onBack={goBack}
      canGoBack={currentIndex > 0}
      footer={step.key === 'setup-complete' ? null : (
        <OnboardingActionFooter>
          {step.key === 'add-business-sources' ? (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Files are encrypted and only used to train NOVA
              </span>
              <Button
                onClick={goNext}
                disabled={!canGoNext}
              >
                Next
              </Button>
            </div>
          ) : step.key === 'connect-meta' ? (
            state.metaConnection.status === 'connected' && state.selectedAdAccountId ? (
              <div className="flex w-full items-center justify-end">
                <Button onClick={goNext}>
                  Next
                </Button>
              </div>
            ) : state.metaConnection.status === 'connected' ? (
              <div className="flex w-full items-center justify-end">
                <Button variant="ghost" onClick={goNext}>
                  Do this later
                </Button>
              </div>
            ) : null
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
