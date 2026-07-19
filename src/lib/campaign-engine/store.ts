import { Container } from '@/di/container';
import type { CampaignFormInput } from '@/core/campaign/generator';
import type { CampaignConfig } from '@/core/campaign/types';

export const campaignStore = {
  create(input: CampaignFormInput, authoredBy = 'system') {
    return Container.getCampaignService().create(input, authoredBy);
  },

  get(id: string) {
    return Container.getCampaignService().get(id);
  },

  list() {
    return Container.getCampaignService().list();
  },

  update(id: string, input: Partial<CampaignFormInput>, authoredBy = 'system', commitMessage = 'Campaign updated') {
    return Container.getCampaignService().update(id, input, authoredBy, commitMessage);
  },

  getVersion(id: string, versionNumber: number) {
    return Container.getCampaignService().getVersion(id, versionNumber);
  },

  getVersionHistory(id: string) {
    return Container.getCampaignService().getVersionHistory(id);
  },

  rollback(id: string, versionNumber: number, authoredBy = 'system') {
    return Container.getCampaignService().rollback(id, versionNumber, authoredBy);
  },

  checkDrift(id: string, platformState: Partial<CampaignConfig>) {
    return Container.getCampaignService().checkDrift(id, platformState);
  },

  getExecutionPlan(id: string) {
    return Container.getCampaignService().getExecutionPlan(id);
  },

  delete(id: string) {
    return Container.getCampaignService().delete(id);
  },
};
