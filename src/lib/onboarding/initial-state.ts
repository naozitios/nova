import type { MockOnboardingState } from './types';

export const initialOnboardingState: MockOnboardingState = {
  business: {
    id: '',
    workspaceId: '',
    name: '',
    websiteUrl: '',
    status: '',
  },
  onboardingSession: {
    id: '',
    businessId: '',
    workspaceId: '',
    status: '',
    currentStep: null,
  },
  businessBasics: {
    businessName: '',
    websiteUrl: '',
    primaryMarket: '',
    businessType: '',
    advertisingGoal: '',
  },
  selectedObjective: null,
  objectiveOptions: [],
  sources: [],
  manualNotes: '',
  processing: {
    overallStatus: 'idle',
    currentMessage: '',
    sources: [],
    blockers: [],
    canContinue: true,
  },
  compiledProfile: {
    summary: '',
    offerings: [],
    valuePropositions: [],
    targetAudiences: [],
    funnelGoal: '',
    targetCpa: '',
  },
  questions: [],
  metaConnection: {
    status: 'not_connected',
    connectionId: null,
    connectedAt: null,
    error: null,
  },
  adAccounts: [],
  selectedAdAccountId: null,
  permissions: {
    canApprove: false,
    role: 'viewer',
  },
  completion: {
    approvalStatus: 'ready_for_admin_approval',
    dashboardHref: '',
    settingsHref: '',
  },
};
