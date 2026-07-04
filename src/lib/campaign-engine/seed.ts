import { Container } from '@/di/container';

export async function ensureSeeded(): Promise<void> {
  await Container.getCampaignSeed().ensure();
}

export async function getSeededCampaigns() {
  return Container.getCampaignSeed().getSeeded();
}
