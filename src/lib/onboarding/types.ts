export type OnboardingStepKey =
  | 'business-basics'
  | 'add-business-sources'
  | 'connect-meta'
  | 'processing'
  | 'review-business-context'
  | 'setup-complete';

export type BusinessBasics = {
  businessName: string;
  websiteUrl: string;
  primaryMarket: string;
  businessType: string;
  advertisingGoal: string;
};

export type MetaConnectionStatus = 'not_connected' | 'connected' | 'skipped' | 'failed';
export type SourceStatus = 'added' | 'uploading' | 'processing' | 'complete' | 'failed';
export type ProcessingStatus = 'idle' | 'processing' | 'ready' | 'blocked' | 'failed';

export type OnboardingStepDefinition = {
  key: OnboardingStepKey;
  title: string;
  eyebrow: string;
  description: string;
  optional?: boolean;
};

export type MockBusiness = {
  id: string;
  workspaceId: string;
  name: string;
  websiteUrl: string | null;
  status: string;
};

export type MockOnboardingSession = {
  id: string;
  businessId: string;
  workspaceId: string;
  status: string;
  currentStep: string | null;
};

export type MockObjective = {
  id: string;
  title: string;
  description: string;
  purpose: 'CAMPAIGN_SETUP' | 'PERFORMANCE_ANALYSIS' | 'OPTIMIZATION' | 'CREATIVE_BRIEF' | 'TRACKING_AUDIT';
};

export type MockSource = {
  id: string;
  sourceType: 'website' | 'upload' | 'manual_note';
  sourceName: string;
  externalReference: string | null;
  status: SourceStatus;
  currentStage: string | null;
  progress: number;
  error: string | null;
};

export type MockProcessingState = {
  overallStatus: ProcessingStatus;
  currentMessage: string;
  sources: MockSource[];
  blockers: string[];
  canContinue: boolean;
};

export type MockCompiledProfile = {
  summary: string;
  offerings: string[];
  valuePropositions: string[];
  targetAudiences: string[];
  funnelGoal: string;
  targetCpa: string;
};

export type MockQuestion = {
  factKey: string;
  questionType: 'text' | 'select' | 'multi_select';
  question: string;
  options: string[];
  answer: string | string[] | null;
};

export type MockMetaConnection = {
  status: MetaConnectionStatus;
  connectionId: string | null;
  connectedAt: string | null;
  error: string | null;
};

export type MockAdAccount = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
};

export type MockPermissions = {
  canApprove: boolean;
  role: 'viewer' | 'editor' | 'admin';
};

export type MockCompletion = {
  approvalStatus: 'approved' | 'ready_for_admin_approval';
  dashboardHref: string;
  settingsHref: string;
};

export type MockOnboardingState = {
  business: MockBusiness;
  onboardingSession: MockOnboardingSession;
  businessBasics: BusinessBasics;
  selectedObjective: string | null;
  objectiveOptions: MockObjective[];
  sources: MockSource[];
  manualNotes: string;
  processing: MockProcessingState;
  compiledProfile: MockCompiledProfile;
  questions: MockQuestion[];
  metaConnection: MockMetaConnection;
  adAccounts: MockAdAccount[];
  selectedAdAccountId: string | null;
  permissions: MockPermissions;
  completion: MockCompletion;
};
