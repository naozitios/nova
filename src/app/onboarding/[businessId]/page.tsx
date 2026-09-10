'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { initialOnboardingState } from '@/lib/onboarding/initial-state';
import { resolveOnboardingBusinessId } from '@/lib/onboarding/business-id';
import { processingRunSignature } from '@/lib/onboarding/processing-signature';
import { DEMO_BUSINESS_ID } from '@/lib/demo-user';
import {
  compileOnboardingDraft,
  completeOnboardingUpload,
  createOnboardingUploadIntent,
  fetchOnboardingReview,
  getOnboardingState,
  queueOnboardingScan,
  registerOnboardingSource,
  startOnboardingSession,
  submitOnboardingAnswers,
  type OnboardingReview,
  type OnboardingSourceResult,
  type OnboardingStateResponse,
} from '@/lib/onboarding/api';
import type { JsonValue } from '@/core/business-context/types';
import { canContinueFromStep, getCompletionStatus, getNextStepIndex, ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import type { BusinessBasics, MockOnboardingState, MockSource } from '@/lib/onboarding/types';
import { Loader2 } from 'lucide-react';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { OnboardingActionFooter } from '@/components/onboarding/OnboardingActionFooter';
import { OnboardingCard } from '@/components/onboarding/OnboardingCard';
import { BusinessBasicsForm } from '@/components/onboarding/BusinessBasicsForm';
import { UploadDropzone } from '@/components/onboarding/UploadDropzone';
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

function mapBackendSourceStatus(status: string): MockSource['status'] {
  if (status === 'processed' || status === 'processed_with_warnings' || status === 'completed') return 'complete';
  if (status === 'failed' || status === 'failed_permanent' || status === 'blocked_needs_user_action') return 'failed';
  if (status === 'registered' || status === 'queued') return 'added';
  return 'processing';
}

function mapBackendSourceType(sourceType: string): MockSource['sourceType'] {
  if (sourceType === 'website') return 'website';
  if (sourceType === 'manual_note' || sourceType === 'user_answer') return 'manual_note';
  return 'upload';
}

function mapSourceResultToMockSource(
  source: OnboardingSourceResult,
  fallbackType?: MockSource['sourceType'],
): MockSource {
  const status = mapBackendSourceStatus(source.status);
  return {
    id: source.id,
    sourceType: fallbackType ?? mapBackendSourceType(source.sourceType),
    sourceName: source.sourceName,
    externalReference: source.externalReference,
    status,
    currentStage: source.currentStage,
    progress: status === 'complete' ? 100 : source.progress,
    error: status === 'failed' ? source.currentStage : null,
  };
}

function mapStateSources(sources: OnboardingStateResponse['sources']): MockSource[] {
  const seen = new Set<string>();
  return sources.filter((src) => {
    if (seen.has(src.id)) return false;
    seen.add(src.id);
    return true;
  }).map((src) => {
    const status = mapBackendSourceStatus(src.status);
    return {
      id: src.id,
      sourceType: mapBackendSourceType(src.sourceType),
      sourceName: src.sourceName,
      externalReference: src.externalReference,
      status,
      currentStage: src.currentStage,
      progress: status === 'complete' ? 100 : src.progress,
      error: status === 'failed' ? src.currentStage : null,
    };
  });
}

function businessBasicsAnswers(businessBasics: BusinessBasics) {
  return [
    { factKey: 'business.name', answer: businessBasics.businessName.trim() },
    { factKey: 'market.primary', answer: businessBasics.primaryMarket },
    { factKey: 'advertising.primary_objective', answer: businessBasics.advertisingGoal },
    { factKey: 'business.primary_outcome', answer: businessBasics.advertisingGoal },
    { factKey: 'economics.monthly_meta_budget', answer: 0 },
  ];
}

function isReadyRouteStage(routeStage: string): boolean {
  return routeStage === 'review' || routeStage === 'context' || routeStage === 'complete';
}

function isProcessingReady(onboardingState: OnboardingStateResponse): boolean {
  return onboardingState.readiness.approvalReady || isReadyRouteStage(onboardingState.readiness.routeStage);
}

function applyBackendState(
  current: MockOnboardingState,
  onboardingState: OnboardingStateResponse,
): MockOnboardingState {
  const sources = mapStateSources(onboardingState.sources);
  const blockers = onboardingState.readiness.blockers.map(String);
  const routeStage = onboardingState.readiness.routeStage;
  const processingReady = onboardingState.readiness.approvalReady || isReadyRouteStage(routeStage);

  return {
    ...current,
    business: {
      ...current.business,
      workspaceId: onboardingState.business.workspaceId,
      name: onboardingState.business.name,
      websiteUrl: onboardingState.business.websiteUrl ?? '',
    },
    businessBasics: {
      ...current.businessBasics,
      businessName: onboardingState.business.name,
      websiteUrl: onboardingState.business.websiteUrl ?? '',
    },
    sources,
    processing: {
      ...current.processing,
      overallStatus: processingReady ? 'ready' : sources.some((src) => src.status === 'failed') ? 'failed' : sources.length > 0 ? 'processing' : 'idle',
      currentMessage: processingReady ? 'Business context ready for review.' : sources.length > 0 ? 'Processing business sources.' : '',
      sources,
      blockers,
      canContinue: processingReady && blockers.length === 0,
    },
  };
}

export default function OnboardingPage() {
  const params = useParams<{ businessId: string }>();
  const router = useRouter();
  const businessId = params?.businessId;
  const [state, setState] = useState<MockOnboardingState>(() => structuredClone(initialOnboardingState));
  const canonicalBusinessId = businessId ? resolveOnboardingBusinessId(businessId, state.business.id) : '';
  const processingSignature = canonicalBusinessId
    ? processingRunSignature(canonicalBusinessId, state.sources)
    : '';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingBasics, setSavingBasics] = useState(false);
  const [savingSources, setSavingSources] = useState(false);
  const processingStartedFor = useRef<string | null>(null);
  const pendingUploadFiles = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    if (!businessId) return;

    const apiBusinessId = resolveOnboardingBusinessId(businessId);

    fetchOnboardingReview(apiBusinessId)
      .then((review: OnboardingReview) => {
        setState((s) => ({
          ...s,
          compiledProfile: mapBackendProfileToCompiledProfile(review.profile),
          sources: review.sources.map((src) => {
            const status = mapBackendSourceStatus(src.status);
            return {
              id: src.id,
              sourceType: src.type as 'website' | 'upload' | 'manual_note',
              sourceName: src.name,
              externalReference: null,
              status,
              currentStage: null,
              progress: status === 'complete' ? 100 : 0,
              error: null,
            };
          }),
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
          },
        }));
      })
      .catch((err) => {
        if (err?.status === 404) {
          setState((s) => ({
            ...s,
            compiledProfile: {
              summary: '',
              offerings: [],
              valuePropositions: [],
              targetAudiences: [],
              funnelGoal: '',
              targetCpa: '',
            },
            processing: {
              ...s.processing,
              sources: [],
            },
          }));
          return;
        }

        console.error('Failed to fetch onboarding review:', err);
      })
      .finally(() => setLoading(false));

    getOnboardingState(apiBusinessId)
      .then(async (onboardingState) => {
        const nextState = onboardingState.session
          ? onboardingState
          : await startOnboardingSession(apiBusinessId).then(() => getOnboardingState(apiBusinessId));

        setState((s) => applyBackendState(s, nextState));
      })
      .catch((err) => {
        console.error('Failed to fetch onboarding state:', err);
        if (err?.status === 404 && apiBusinessId !== DEMO_BUSINESS_ID) {
          router.replace(`/onboarding/${DEMO_BUSINESS_ID}`);
        }
      })
      .finally(() => setLoading(false));
  }, [businessId, router]);

  useEffect(() => {
    if (!canonicalBusinessId) return;
    if (ONBOARDING_STEPS[currentIndex].key !== 'processing') return;
    if (processingStartedFor.current === processingSignature) return;

    processingStartedFor.current = processingSignature;
    let cancelled = false;
    let pollTimeout: number | null = null;

    async function processOnboardingSources() {
      try {
        await queueOnboardingScan(canonicalBusinessId);

        const poll = async () => {
          if (cancelled) return;

          const onboardingState = await getOnboardingState(canonicalBusinessId);
          if (cancelled) return;

          const readyForReview = isProcessingReady(onboardingState);
          if (!readyForReview) {
            setState((s) => applyBackendState(s, onboardingState));
            pollTimeout = window.setTimeout(poll, 3000);
            return;
          }

          const draft = await compileOnboardingDraft(canonicalBusinessId);
          if (!cancelled) {
            setState((s) => ({
              ...applyBackendState(s, onboardingState),
              compiledProfile: mapBackendProfileToCompiledProfile(draft.profile),
            }));
          }
        };

        await poll();
      } catch (err) {
        console.error('Failed to process onboarding sources:', err);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            processing: {
              ...s.processing,
              overallStatus: 'failed',
              blockers: ['Backend processing could not be started.'],
              canContinue: false,
            },
          }));
        }
      }
    }

    void processOnboardingSources();

    return () => {
      cancelled = true;
      if (pollTimeout) window.clearTimeout(pollTimeout);
    };
  }, [canonicalBusinessId, currentIndex, processingSignature]);

  useEffect(() => {
    if (!canonicalBusinessId) return;
    if (ONBOARDING_STEPS[currentIndex].key !== 'processing') return;
    if (state.processing.canContinue) return;

    let cancelled = false;
    let pollTimeout: number | null = null;

    const refreshProcessingState = async () => {
      try {
        const onboardingState = await getOnboardingState(canonicalBusinessId);
        if (cancelled) return;

        if (!isProcessingReady(onboardingState)) {
          pollTimeout = window.setTimeout(refreshProcessingState, 3000);
          return;
        }

        const draft = await compileOnboardingDraft(canonicalBusinessId);
        if (cancelled) return;

        setState((s) => ({
          ...applyBackendState(s, onboardingState),
          compiledProfile: mapBackendProfileToCompiledProfile(draft.profile),
        }));
      } catch (err) {
        console.error('Failed to refresh onboarding processing state:', err);
      }
    };

    pollTimeout = window.setTimeout(refreshProcessingState, 3000);

    return () => {
      cancelled = true;
      if (pollTimeout) window.clearTimeout(pollTimeout);
    };
  }, [canonicalBusinessId, currentIndex, state.processing.canContinue]);

  useEffect(() => {
    if (ONBOARDING_STEPS[currentIndex].key !== 'add-business-sources') return;
    const url = state.businessBasics.websiteUrl?.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/\./.test(url)) return;

    setState((s) => {
      const existing = s.sources.find((src) => src.sourceType === 'website');
      if (existing?.externalReference === url) return s;
      if (existing) {
        return {
          ...s,
          sources: s.sources.map((src) =>
            src.id === existing.id
              ? { ...src, externalReference: url, sourceName: url, status: 'added' as const }
              : src,
          ),
        };
      }
      return {
        ...s,
        sources: [
          ...s.sources,
          {
            id: `src_website_${Date.now()}`,
            sourceType: 'website' as const,
            sourceName: url,
            externalReference: url,
            status: 'added' as const,
            currentStage: 'queued',
            progress: 0,
            error: null,
          },
        ],
      };
    });
  }, [currentIndex, state.businessBasics.websiteUrl]);

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

  const persistBusinessBasicsAndGoNext = async () => {
    if (!canonicalBusinessId) return;

    setSavingBasics(true);
    try {
      await submitOnboardingAnswers(canonicalBusinessId, {
        answers: businessBasicsAnswers(state.businessBasics),
      });
      const onboardingState = await getOnboardingState(canonicalBusinessId);
      setState((s) => applyBackendState(s, onboardingState));
      setCurrentIndex(getNextStepIndex(state, currentIndex));
    } catch (err) {
      console.error('Failed to save onboarding answers:', err);
    } finally {
      setSavingBasics(false);
    }
  };

  const persistSourcesAndGoNext = async () => {
    if (!canonicalBusinessId) return;

    const localSources = state.sources.filter((src) =>
      src.id.startsWith('src_website_') || src.id.startsWith('src_upload_'),
    );

    if (localSources.length === 0) {
      goNext();
      return;
    }

    setSavingSources(true);
    setState((s) => ({
      ...s,
      sources: s.sources.map((src) =>
        src.id.startsWith('src_upload_') ? { ...src, status: 'uploading' as const, currentStage: 'uploading' } : src,
      ),
    }));

    try {
      const replacements = new Map<string, MockSource>();

      for (const source of localSources) {
        if (source.sourceType === 'website' && source.externalReference) {
          const registered = await registerOnboardingSource(canonicalBusinessId, {
            sourceType: 'website',
            sourceName: source.sourceName,
            externalReference: source.externalReference,
          });
          replacements.set(source.id, mapSourceResultToMockSource(registered, 'website'));
        }

        if (source.sourceType === 'upload') {
          const file = pendingUploadFiles.current.get(source.id);
          if (!file) continue;

          const intent = await createOnboardingUploadIntent(canonicalBusinessId, {
            sourceName: file.name,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            documentClass: 'other',
          });
          const completed = await completeOnboardingUpload(canonicalBusinessId, {
            uploadId: intent.id,
            uploadUrl: intent.uploadUrl,
            storagePath: intent.storagePath,
            file,
          });
          pendingUploadFiles.current.delete(source.id);
          replacements.set(source.id, mapSourceResultToMockSource(completed, 'upload'));
        }
      }

      setState((s) => ({
        ...s,
        sources: s.sources.map((src) => replacements.get(src.id) ?? src),
      }));

      const onboardingState = await getOnboardingState(canonicalBusinessId);
      setState((s) => applyBackendState(s, onboardingState));
      setCurrentIndex(getNextStepIndex(state, currentIndex));
    } catch (err) {
      console.error('Failed to save onboarding sources:', err);
      setState((s) => ({
        ...s,
        sources: s.sources.map((src) =>
          src.id.startsWith('src_upload_') || src.id.startsWith('src_website_')
            ? { ...src, status: 'failed' as const, currentStage: 'save_failed', error: 'Could not save this source.' }
            : src,
        ),
      }));
    } finally {
      setSavingSources(false);
    }
  };

  const updateManualNotes = (notes: string) => {
    setState((s) => ({ ...s, manualNotes: notes }));
  };

  const updateBusinessBasics = (update: Partial<BusinessBasics>) => {
    setState((s) => ({ ...s, businessBasics: { ...s.businessBasics, ...update } }));
  };

  const handleFileSelect = (files: FileList) => {
    const newSources: MockSource[] = Array.from(files).map((file, i) => {
      const id = `src_upload_${Date.now()}_${i}`;
      pendingUploadFiles.current.set(id, file);
      return {
        id,
        sourceType: 'upload',
        sourceName: file.name,
        externalReference: null,
        status: 'added',
        currentStage: 'queued',
        progress: 0,
        error: null,
      };
    });
    setState((s) => ({ ...s, sources: [...s.sources, ...newSources] }));
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
            key={step.key}
            value={state.businessBasics}
            onChange={updateBusinessBasics}
          />
        );

      case 'add-business-sources':
        return (
          <div className="grid gap-6">
            <UploadDropzone onFileSelect={handleFileSelect} onMockUpload={mockUpload} />
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
        return <ProcessingTimeline processing={{ ...state.processing, sources: state.sources }} />;

      case 'review-business-context':
        return (
          <BusinessContextReview
            profile={state.compiledProfile}
            sources={state.sources}
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
            <div className="flex w-full items-center justify-end">
              <Button
                onClick={persistSourcesAndGoNext}
                disabled={!canGoNext || savingSources}
              >
                {savingSources ? 'Saving sources…' : 'Next'}
              </Button>
            </div>
          ) : step.key === 'business-basics' ? (
            <div className="flex w-full items-center justify-end">
              <Button onClick={persistBusinessBasicsAndGoNext} disabled={!canGoNext || savingBasics}>
                {savingBasics ? 'Saving basics…' : 'Continue'}
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
                <Button variant="ghost" onClick={() => { metaSkip(); goNext(); }}>
                  Do this later
                </Button>
              </div>
            ) : state.metaConnection.status === 'skipped' ? (
              <div className="flex w-full items-center justify-end">
                <Button onClick={goNext}>
                  Next
                </Button>
              </div>
            ) : null
          ) : step.key === 'processing' ? (
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-10 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">
                  Step 4 of 6: Processing deep analysis…
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
