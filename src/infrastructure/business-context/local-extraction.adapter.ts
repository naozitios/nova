import type {
  ExtractedFact,
  ExtractionPort,
  ExtractionRequest,
  ExtractionResult,
  ReconciliationRequest,
  ReconciliationResult,
} from '@/core/business-context/extraction.port';
import type { ServiceResult } from '@/core/business-context/types';
import { resolveFacts } from '@/core/business-context/resolver';

function excerpt(content: string): string {
  return content.trim().replace(/\s+/g, ' ').slice(0, 240);
}

function contains(content: string, value: string): boolean {
  return content.toLowerCase().includes(value.toLowerCase());
}

export class LocalExtractionAdapter implements ExtractionPort {
  async extractFacts(request: ExtractionRequest): Promise<ServiceResult<ExtractionResult>> {
    const content = request.contentText;
    const sourceExcerpt = excerpt(content);
    const facts: ExtractedFact[] = [];

    const addFact = (factKey: string, value: string | number | string[]) => {
      facts.push({
        factKey,
        value,
        confidence: 0.72,
        sourceExcerpt,
        evidenceLocator: { element: request.sourceDocumentId },
      });
    };

    const nameMatch = content.match(/\b([A-Z][A-Za-z0-9&' -]{2,80}?)\s+(?:sells|offers|provides|builds)\b/);
    if (nameMatch?.[1]) addFact('business.name', nameMatch[1].trim());
    if (contains(content, 'ecommerce') || contains(content, 'e-commerce')) addFact('offers.primary', 'ecommerce products');
    if (contains(content, 'United States')) addFact('customers.target_segment', 'United States');
    if (contains(content, 'sales')) addFact('advertising.primary_objective', 'sales');
    if (contains(content, 'Meta')) addFact('advertising.platforms', ['Meta']);

    return {
      ok: true,
      data: {
        facts,
        conflicts: [],
        warnings: ['Used local deterministic extraction.'],
      },
    };
  }

  async reconcileFacts(request: ReconciliationRequest): Promise<ServiceResult<ReconciliationResult>> {
    const resolution = resolveFacts(
      request.existingFacts.map((fact) => ({
        ...fact,
        id: fact.id,
        workspaceId: request.workspaceId,
        businessId: request.businessId,
        factKey: request.factKey,
        sourceId: '',
        sourceDocumentId: null,
        sourceExcerpt: null,
        evidenceLocator: null,
        supersedesFactId: null,
        validTo: null,
        createdAt: new Date(),
        createdBy: 'system',
      })),
      request.newFacts,
    );

    return {
      ok: true,
      data: {
        superseded: resolution.superseded.map((fact) => ({ oldFactId: fact.oldFactId, newFactId: '' })),
        conflicts: resolution.conflicts.map((conflict) => ({ factKey: conflict.factKey, values: conflict.values })),
        toCreate: resolution.toCreate,
        toUpdate: resolution.toUpdate,
      },
    };
  }
}
