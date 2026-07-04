import { Container } from '@/di/container';

/** Convenience wrapper: sends a prompt to the AI service and returns the response. */
export async function processPrompt(prompt: string) {
  return Container.getAIService().processPrompt(prompt);
}

/** Convenience wrapper: applies a single AI action. */
export async function applyAction(action: any) {
  return Container.getAIService().applyAction(action);
}

/** Convenience wrapper: applies multiple AI actions concurrently. */
export async function applyAllActions(actions: any[]) {
  return Container.getAIService().applyAllActions(actions);
}

/** Convenience wrapper: returns the message from the most recent AI response. */
export function getLastResponse() {
  return Container.getAIService().getLastResponse();
}
