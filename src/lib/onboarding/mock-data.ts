import type { MockOnboardingState } from './types';

export const mockOnboardingState: MockOnboardingState = {
  business: {
    id: 'biz_nova_media',
    workspaceId: 'ws_demo_agency',
    name: 'Nova Media Group',
    websiteUrl: 'https://novamediagroup.example',
    status: 'active',
  },
  onboardingSession: {
    id: 'onb_demo_001',
    businessId: 'biz_nova_media',
    workspaceId: 'ws_demo_agency',
    status: 'created',
    currentStep: 'business-basics',
  },
  selectedObjective: 'campaign_setup',
  objectiveOptions: [
    {
      id: 'campaign_setup',
      title: 'Campaign setup',
      description: 'Prepare audience, offer, and positioning context for new launches.',
      purpose: 'CAMPAIGN_SETUP',
    },
    {
      id: 'performance_analysis',
      title: 'Performance analysis',
      description: 'Help NOVA explain what is working and where budget is leaking.',
      purpose: 'PERFORMANCE_ANALYSIS',
    },
    {
      id: 'optimization',
      title: 'Optimization',
      description: 'Prioritize actions that improve spend efficiency and conversion quality.',
      purpose: 'OPTIMIZATION',
    },
    {
      id: 'creative_brief',
      title: 'Creative brief',
      description: 'Turn business context into strong angles, claims, and creative direction.',
      purpose: 'CREATIVE_BRIEF',
    },
    {
      id: 'tracking_audit',
      title: 'Tracking audit',
      description: 'Check whether measurement, attribution, and funnel signals are usable.',
      purpose: 'TRACKING_AUDIT',
    },
  ],
  sources: [
    {
      id: 'src_website',
      sourceType: 'website',
      sourceName: 'Company website',
      externalReference: 'https://novamediagroup.example',
      status: 'complete',
      currentStage: 'extracted',
      progress: 100,
      error: null,
    },
    {
      id: 'src_deck',
      sourceType: 'upload',
      sourceName: 'Q3 growth deck.pdf',
      externalReference: null,
      status: 'processing',
      currentStage: 'summarizing',
      progress: 78,
      error: null,
    },
  ],
  manualNotes: 'Premium lead generation agency focused on high-consideration B2B services.',
  processing: {
    overallStatus: 'ready',
    currentMessage: 'Business context is ready for review.',
    sources: [],
    blockers: [],
    canContinue: true,
  },
  compiledProfile: {
    summary: 'Nova Media Group helps B2B teams turn paid acquisition into qualified pipeline.',
    offerings: ['Paid social strategy', 'Creative testing', 'Funnel analysis', 'Performance optimization'],
    valuePropositions: [
      'Turns fragmented ad data into clear next actions.',
      'Combines creative, audience, and funnel context before recommending spend changes.',
    ],
    targetAudiences: ['B2B founders', 'Growth leads', 'Agency operators'],
    funnelGoal: 'Generate qualified sales conversations',
    targetCpa: '$180',
  },
  questions: [
    {
      factKey: 'audience.primary_segments',
      questionType: 'text',
      question: 'Which customer segment should NOVA prioritize first?',
      options: [],
      answer: 'B2B SaaS teams with active paid social spend.',
    },
  ],
  metaConnection: {
    status: 'skipped',
    connectionId: null,
    connectedAt: null,
    error: null,
  },
  adAccounts: [
    {
      id: 'act_822109',
      name: 'Nova Media Growth',
      currency: 'USD',
      timezone: 'America/New_York',
      status: 'active',
    },
    {
      id: 'act_774512',
      name: 'Nova Sandbox',
      currency: 'USD',
      timezone: 'America/Los_Angeles',
      status: 'active',
    },
  ],
  selectedAdAccountId: null,
  permissions: {
    canApprove: false,
    role: 'editor',
  },
  completion: {
    approvalStatus: 'ready_for_admin_approval',
    dashboardHref: '/dashboard',
    settingsHref: '/settings',
  },
};

mockOnboardingState.processing.sources = [...mockOnboardingState.sources];
