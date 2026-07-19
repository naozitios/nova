import { Container } from '@/di/container';
import type { AIActionItem } from '@/core/ai/types';

/** Convenience wrapper: sends a prompt to the AI service and returns the response. */
export async function processPrompt(prompt: string) {
  return Container.getAIService().processPrompt(prompt);
}

/** Convenience wrapper: applies a single AI action. */
export async function applyAction(action: AIActionItem) {
  return Container.getAIService().applyAction(action);
}

/** Convenience wrapper: applies multiple AI actions concurrently. */
export async function applyAllActions(actions: AIActionItem[]) {
  return Container.getAIService().applyAllActions(actions);
}

/** Convenience wrapper: returns the message from the most recent AI response. */
export function getLastResponse() {
  return Container.getAIService().getLastResponse();
}
