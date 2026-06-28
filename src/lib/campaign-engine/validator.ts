import { CampaignConfig, CreativeConfig } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

const VALID_OBJECTIVES = ['CONVERSIONS', 'BRAND_AWARENESS', 'TRAFFIC', 'RETENTION'];
const VALID_PLATFORMS = ['meta', 'google'];

export function validateConfig(config: CampaignConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config.name?.trim()) {
    errors.push({ field: 'name', message: 'Campaign name is required' });
  }

  if (!config.platform?.length) {
    errors.push({ field: 'platform', message: 'At least one platform must be selected' });
  } else {
    for (const p of config.platform) {
      if (!VALID_PLATFORMS.includes(p)) {
        errors.push({ field: 'platform', message: `Invalid platform: ${p}` });
      }
    }
  }

  if (!VALID_OBJECTIVES.includes(config.objective)) {
    errors.push({ field: 'objective', message: `Invalid objective: ${config.objective}` });
  }

  if (!config.totalBudget || config.totalBudget <= 0) {
    errors.push({ field: 'totalBudget', message: 'Budget must be greater than 0' });
  }

  if (!config.startDate) {
    errors.push({ field: 'startDate', message: 'Start date is required' });
  }

  if (!config.endDate) {
    errors.push({ field: 'endDate', message: 'End date is required' });
  }

  if (config.startDate && config.endDate && config.startDate > config.endDate) {
    errors.push({ field: 'endDate', message: 'End date must be after start date' });
  }

  if (!config.adSets?.length) {
    errors.push({ field: 'adSets', message: 'At least one ad set is required' });
  } else {
    for (let i = 0; i < config.adSets.length; i++) {
      const adSet = config.adSets[i];
      if (!adSet.name?.trim()) {
        errors.push({ field: `adSets[${i}].name`, message: 'Ad set name is required' });
      }
      if (!adSet.targeting?.countries?.length) {
        errors.push({ field: `adSets[${i}].targeting.countries`, message: 'At least one target country is required' });
      }
      if (!adSet.targeting?.languages?.length) {
        errors.push({ field: `adSets[${i}].targeting.languages`, message: 'At least one language is required' });
      }
      if (!adSet.bidAmount || adSet.bidAmount <= 0) {
        errors.push({ field: `adSets[${i}].bidAmount`, message: 'Bid amount must be greater than 0' });
      }
      for (let j = 0; j < adSet.creatives.length; j++) {
        const c = adSet.creatives[j];
        validateCreative(c, `adSets[${i}].creatives[${j}]`, errors);
      }
    }
  }

  return errors;
}

function validateCreative(creative: CreativeConfig, prefix: string, errors: ValidationError[]) {
  if (!creative.headline?.trim()) {
    errors.push({ field: `${prefix}.headline`, message: 'Headline is required' });
  }
  if (!creative.bodyText?.trim()) {
    errors.push({ field: `${prefix}.bodyText`, message: 'Body text is required' });
  }
  if (!creative.destinationUrl?.trim()) {
    errors.push({ field: `${prefix}.destinationUrl`, message: 'Destination URL is required' });
  }
  if (creative.destinationUrl && !creative.destinationUrl.startsWith('http')) {
    errors.push({ field: `${prefix}.destinationUrl`, message: 'Destination URL must start with http:// or https://' });
  }
}

export function formatErrors(errors: ValidationError[]): string {
  return errors.map(e => `${e.field}: ${e.message}`).join('\n');
}
