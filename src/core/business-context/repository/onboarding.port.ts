import type {
  OnboardingQuestion,
  OnboardingSession,
  ServiceResult,
} from '../types'
import type { PaginationParams } from './repository.port'

export interface OnboardingFilter {
  workspaceId: string
  businessId?: string
  status?: string
}

export interface QuestionFilter {
  workspaceId: string
  sessionId: string
  status?: 'open' | 'answered' | 'dismissed'
}

export interface OnboardingRepositoryPort {
  createOnboardingSession(
    data: Omit<OnboardingSession, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<OnboardingSession>>

  getOnboardingSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<ServiceResult<OnboardingSession | null>>

  listOnboardingSessions(
    filter: OnboardingFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingSession[]; total: number }>>

  updateOnboardingSession(
    workspaceId: string,
    sessionId: string,
    data: Partial<
      Pick<
        OnboardingSession,
        'status' | 'currentStep' | 'completedAt' | 'error'
      >
    >,
  ): Promise<ServiceResult<OnboardingSession>>

  createOnboardingQuestion(
    data: Omit<OnboardingQuestion, 'id'>,
  ): Promise<ServiceResult<OnboardingQuestion>>

  getOnboardingQuestion(
    workspaceId: string,
    questionId: string,
  ): Promise<ServiceResult<OnboardingQuestion | null>>

  listOnboardingQuestions(
    filter: QuestionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingQuestion[]; total: number }>>

  answerOnboardingQuestion(
    workspaceId: string,
    questionId: string,
    answer: unknown,
    answeredBy: string,
  ): Promise<ServiceResult<OnboardingQuestion>>
}
