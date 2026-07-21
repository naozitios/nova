'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { mockOnboardingState } from '@/lib/onboarding/mock-data';
import { fetchOnboardingReview, getOnboardingState, type OnboardingReview } from '@/lib/onboarding/api';
import type { JsonValue } from '@/core/business-context/types';
import { canContinueFromStep, getCompletionStatus, getNextStepIndex, ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import type { BusinessBasics, MockOnboardingState, MockSource } from '@/lib/onboarding/types';
import { Loader2 } from 'lucide-react';
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

function mapBackendProfileToCompiledProfile(profile: Record<string, JsonValue>): MockOnboardingState['compiledProfile'] {
  const business = profile.business as Record<string, JsonValue> | undefined;
  const offers = profile.offers as Record<string, JsonValue> | undefined;
  const brand = profile.brand as Record<string, JsonValue> | undefined;
  const customers = profile.customers as Record<string, JsonValue> | undefined;
  const conversion = profile.conversion_journey as Record<string, JsonValue> | undefined;
  const economics = profile.economics as Record<string, JsonValue> | undefined;

  const summary = typeof business?.summary === 'string'
    ? business.summary
    : typeof business?.description === 'string'
      ? business.description
      : '';

  const offerings = Array.isArray(offers?.items)
    ? offers.items.filter((x): x is string => typeof x === 'string')
    : Array.isArray(offers?.list)
      ? offers.list.filter((x): x is string => typeof x === 'string')
      : [];

  const valuePropositions = Array.isArray(brand?.value_propositions)
    ? brand.value_propositions.filter((x): x is string => typeof x === 'string')
    : Array.isArray(brand?.messaging)
      ? brand.messaging.filter((x): x is string => typeof x === 'string')
      : [];

  const targetAudiences = Array.isArray(customers?.segments)
    ? customers.segments.filter((x): x is string => typeof x === 'string')
    : Array.isArray(customers?.target_audiences)
      ? customers.target_audiences.filter((x): x is string => typeof x === 'string')
      : [];

  const funnelGoal = typeof conversion?.primary_goal === 'string'
    ? conversion.primary_goal
    : typeof economics?.goal === 'string'
      ? economics.goal
      : 'Generate qualified sales conversations';

  const targetCpa = typeof economics?.target_cpa === 'string'
    ? economics.target_cpa
    : typeof economics?.cpa_target === 'string'
      ? economics.cpa_target
      : '$180';

  return { summary, offerings, valuePropositions, targetAudiences, funnelGoal, targetCpa };
}

export default function OnboardingPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId;
  const [state, setState] = useState<MockOnboardingState>(() => structuredClone(mockOnboardingState));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    fetchOnboardingReview(businessId)
      .then((review: OnboardingReview) => {
        setState((s) => ({
          ...s,
          compiledProfile: mapBackendProfileToCompiledProfile(review.profile),
          sources: review.sources.map((src) => ({
            id: src.id,
            sourceType: src.type as 'website' | 'upload' | 'manual_note',
            sourceName: src.name,
            externalReference: null,
            status: src.status === 'completed' ? 'complete' : src.status === 'failed' ? 'failed' : 'processing',
            currentStage: null,
            progress: src.status === 'completed' ? 100 : 0,
            error: null,
          })),
          questions: review.questions.map((q) => ({
            factKey: q.factKey,
            questionType: 'text' as const,
            question: q.question,
            options: [],
            answer: typeof q.answer === 'string' ? q.answer : null,
          })),
          processing: {
            ...s.processing,
            blockers: review.warnings,
            canContinue: review.warnings.length === 0,
          },
        }));
      })
      .catch((err) => {
        console.error('Failed to fetch onboarding review:', err);
      })
      .finally(() => setLoading(false));

    getOnboardingState(businessId)
      .then((onboardingState) => {
        setState((s) => ({
          ...s,
          business: {
            ...s.business,
            workspaceId: onboardingState.business.workspaceId,
            name: onboardingState.business.name,
            websiteUrl: onboardingState.business.websiteUrl ?? '',
          },
          businessBasics: {
            ...s.businessBasics,
            businessName: onboardingState.business.name,
            websiteUrl: onboardingState.business.websiteUrl ?? '',
          },
          sources: onboardingState.sources.map((src) => ({
            id: src.id,
            sourceType: src.sourceType as 'website' | 'upload' | 'manual_note',
            sourceName: src.sourceName,
            externalReference: src.externalReference,
            status: src.status === 'completed' ? 'complete' : src.status === 'failed' ? 'failed' : 'processing',
            currentStage: src.currentStage,
            progress: src.status === 'completed' ? 100 : 0,
            error: null,
          })),
        }));
      })
      .catch((err) => {
        console.error('Failed to fetch onboarding state:', err);
      })
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(() => {
    const workspaceId = state.business.workspaceId;
    if (!workspaceId) return;

    let cancelled = false;

    fetch(`/api/meta/connections?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data: { connected: boolean; connection: { id: string; status: string; selected_ad_account_id: string | null } | null }) => {
        if (cancelled) return;

        const isConnected = data.connected && data.connection?.status === 'connected';

        setState((s) => ({
          ...s,
          metaConnection: {
            ...s.metaConnection,
            status: isConnected ? 'connected' : 'not_connected',
            connectionId: data.connection?.id ?? null,
            error: null,
          },
        }));

        if (!isConnected) return;

        return fetch(`/api/meta/ad-accounts?workspace_id=${workspaceId}`)
          .then((res) => res.json())
          .then((data: { accounts: Array<{ id: string; accountId: string; name: string; currency: string; timezoneName: string; businessId: string; businessName: string; isSelected: boolean }> }) => {
            if (cancelled) return;

            const selectedId = data.accounts.find((a) => a.isSelected)?.id ?? null;

            setState((s) => ({
              ...s,
              adAccounts: data.accounts.map((account) => ({
                id: account.id,
                name: account.name,
                accountId: account.accountId,
                currency: account.currency,
                timezone: account.timezoneName,
                businessName: account.businessName,
                isSelected: account.isSelected,
                status: 'active',
              })),
              selectedAdAccountId: selectedId,
            }));
          });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch Meta connection:', err);
        }
      });

    return () => { cancelled = true; };
  }, [state.business.workspaceId]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="size-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading your business context...</p>
        </div>
      </div>
    );
  }

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
            key={state.businessBasics.businessName}
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
      layout={step.key === 'business-basics' || step.key === 'processing' || isReviewStep || step.key === 'setup-complete' ? 'centered' : 'sidebar'}
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
