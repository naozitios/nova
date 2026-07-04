import { Container } from '@/di/container';

export const campaignStore = {
  create(input: any, authoredBy = 'system') {
    return Container.getCampaignService().create(input as any, authoredBy);
  },

  get(id: string) {
    return Container.getCampaignService().get(id);
  },

  list() {
    return Container.getCampaignService().list();
  },

  update(id: string, input: any, authoredBy = 'system', commitMessage = 'Campaign updated') {
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

  checkDrift(id: string, platformState: any) {
    return Container.getCampaignService().checkDrift(id, platformState as any);
  },

  getExecutionPlan(id: string) {
    return Container.getCampaignService().getExecutionPlan(id);
  },

  delete(id: string) {
    return Container.getCampaignService().delete(id);
  },
};
