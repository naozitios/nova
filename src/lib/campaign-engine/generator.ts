import { CampaignConfig, CreativeConfig, AdSetConfig } from './types';

export interface CampaignFormInput {
  name: string;
  platform: string[];
  objective: string;
  totalBudget: string;
  startDate: string;
  endDate: string;
  countries: string;
  ageMin: string;
  ageMax: string;
  languages: string;
  headline: string;
  bodyText: string;
  destinationUrl: string;
  mediaUrl: string;
  adSets?: AdSetConfig[];
}

export function generateConfig(input: CampaignFormInput): CampaignConfig {
  const countries = input.countries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const languages = input.languages.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);

  const creative: CreativeConfig = {
    headline: input.headline,
    bodyText: input.bodyText,
    destinationUrl: input.destinationUrl,
    mediaUrl: input.mediaUrl || '',
    mediaType: 'image',
  };

  const adSet: AdSetConfig = {
    name: `${input.name} - Ad Set`,
    targeting: {
      countries,
      ageRange: [parseInt(input.ageMin) || 18, parseInt(input.ageMax) || 65],
      languages,
    },
    bidAmount: Math.round((parseInt(input.totalBudget) || 0) * 0.003),
    creatives: [creative],
  };

  return {
    name: input.name,
    platform: input.platform as CampaignConfig['platform'],
    objective: input.objective as CampaignConfig['objective'],
    totalBudget: parseInt(input.totalBudget) || 0,
    startDate: input.startDate,
    endDate: input.endDate,
    adSets: [adSet],
  };
}

export function configToFormInput(config: CampaignConfig): CampaignFormInput {
  const adSet = config.adSets[0];
  return {
    name: config.name,
    platform: config.platform,
    objective: config.objective,
    totalBudget: config.totalBudget.toString(),
    startDate: config.startDate,
    endDate: config.endDate,
    countries: adSet?.targeting.countries.join(', ') || '',
    ageMin: (adSet?.targeting.ageRange[0] || 18).toString(),
    ageMax: (adSet?.targeting.ageRange[1] || 65).toString(),
    languages: adSet?.targeting.languages.join(', ') || '',
    headline: adSet?.creatives[0]?.headline || '',
    bodyText: adSet?.creatives[0]?.bodyText || '',
    destinationUrl: adSet?.creatives[0]?.destinationUrl || '',
    mediaUrl: adSet?.creatives[0]?.mediaUrl || '',
    adSets: config.adSets,
  };
}
