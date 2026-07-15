export interface CatalogEntry {
  version: string
  factKeys: string[]
  promptHint: string
}

export interface ExtractionCatalog {
  version: string
  entries: Record<string, CatalogEntry>
}

export const REQUIRED_SECTIONS = [
  'business',
  'offers',
  'customers',
  'conversion_journey',
  'economics',
  'brand',
  'creative_capacity',
  'measurement',
] as const

const CATALOG_VERSION = '1.0.0'

const catalogEntries: Record<string, CatalogEntry> = {
  business: {
    version: CATALOG_VERSION,
    factKeys: [
      'business.name',
      'business.industry',
      'business.description',
      'business.website_url',
      'business.founded_year',
      'business.location',
      'business.company_size',
    ],
    promptHint:
      'Extract core business identity facts: name, industry, description, website, founding year, location, and company size.',
  },
  offers: {
    version: CATALOG_VERSION,
    factKeys: [
      'offers.product_names',
      'offers.pricing.tier_count',
      'offers.pricing.tier_name',
      'offers.unique_selling_proposition',
      'offers.target_market_segment',
      'offers.guarantee_policy',
    ],
    promptHint:
      'Extract product and pricing facts: product names, pricing tiers, USP, target segments, and guarantees.',
  },
  customers: {
    version: CATALOG_VERSION,
    factKeys: [
      'customers.primary_persona',
      'customers.pain_points',
      'customers.decision_criteria',
      'customers.buying_triggers',
      'customers.objection_list',
    ],
    promptHint:
      'Extract customer profile facts: primary persona, pain points, decision criteria, buying triggers, and objections.',
  },
  conversion_journey: {
    version: CATALOG_VERSION,
    factKeys: [
      'conversion_journey.funnel_stages',
      'conversion_journey.key_touchpoints',
      'conversion_journey.typical_sales_cycle_length',
      'conversion_journey.decision_makers',
      'conversion_journey.onboarding_steps',
    ],
    promptHint:
      'Extract conversion journey facts: funnel stages, touchpoints, sales cycle length, decision makers, and onboarding steps.',
  },
  economics: {
    version: CATALOG_VERSION,
    factKeys: [
      'economics.revenue_model',
      'economics.average_order_value',
      'economics.customer_lifetime_value',
      'economics.customer_acquisition_cost',
      'economics.profit_margin',
    ],
    promptHint:
      'Extract economic facts: revenue model, AOV, LTV, CAC, and profit margins.',
  },
  brand: {
    version: CATALOG_VERSION,
    factKeys: [
      'brand.positioning_statement',
      'brand.brand_voice',
      'brand.visual_identity',
      'brand.values',
      'brand.competitors',
    ],
    promptHint:
      'Extract brand facts: positioning, voice, visual identity, values, and competitors.',
  },
  creative_capacity: {
    version: CATALOG_VERSION,
    factKeys: [
      'creative_capacity.content_types',
      'creative_capacity.production_budget',
      'creative_capacity.team_resources',
      'creative_capacity.brand_assets_available',
      'creative_capacity.copy_guidelines',
    ],
    promptHint:
      'Extract creative capacity facts: content types, budget, team resources, brand assets, and copy guidelines.',
  },
  measurement: {
    version: CATALOG_VERSION,
    factKeys: [
      'measurement.primary_kpis',
      'measurement.tracking_tools',
      'measurement.attribution_model',
      'measurement.reporting_cadence',
      'measurement.benchmark_data',
    ],
    promptHint:
      'Extract measurement facts: KPIs, tracking tools, attribution model, reporting cadence, and benchmarks.',
  },
}

const FACT_KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

export function getCatalog(): ExtractionCatalog {
  return {
    version: CATALOG_VERSION,
    entries: catalogEntries,
  }
}

export function getCatalogVersion(): string {
  return CATALOG_VERSION
}

export function listFactKeys(): string[] {
  return Object.values(catalogEntries).flatMap((entry) => entry.factKeys)
}

export function validateFactKey(
  key: string,
): { valid: true } | { valid: false; reason: string } {
  if (key.length === 0) {
    return { valid: false, reason: 'Fact key must not be empty' }
  }
  if (key.startsWith('.') || key.endsWith('.')) {
    return {
      valid: false,
      reason: 'Fact key must not start or end with a dot',
    }
  }
  if (key.includes('..')) {
    return { valid: false, reason: 'Fact key must not contain double dots' }
  }
  if (/[A-Z]/.test(key)) {
    return { valid: false, reason: 'Fact key must be lowercase' }
  }
  if (/\s/.test(key)) {
    return { valid: false, reason: 'Fact key must not contain spaces' }
  }
  if (!FACT_KEY_REGEX.test(key)) {
    return {
      valid: false,
      reason: 'Fact key must use dotted lowercase notation (e.g. business.name)',
    }
  }
  return { valid: true }
}

export function buildPromptTemplate(section: string): string {
  const entry = catalogEntries[section]
  if (!entry) return ''

  const keyList = entry.factKeys.map((k) => `- factKey: ${k}`).join('\n')

  return `Extract facts for the "${section}" section of the Business Context profile.

${entry.promptHint}

Expected fact keys:
${keyList}

For each extracted fact:
1. Assign one of the expected factKeys above.
2. Provide a confidence score between 0.0 and 1.0 indicating how certain you are about the extracted value.
3. Include a source excerpt that supports the extracted value.`
}
