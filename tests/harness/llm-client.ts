export interface FakeLlmResponse {
  facts: Array<{
    factKey: string;
    value: unknown;
    confidence: number;
    sourceExcerpt: string | null;
    evidenceLocator: unknown;
  }>;
  conflicts: unknown[];
  warnings: string[];
}

export class FakeLlmClient {
  public calls: Array<{ prompt: string; schema: unknown }> = [];
  private responses: FakeLlmResponse[];
  private i = 0;

  constructor(responses: FakeLlmResponse[] | FakeLlmResponse) {
    this.responses = Array.isArray(responses) ? responses : [responses];
  }

  complete = async (req: { prompt: string; schema: unknown }) => {
    this.calls.push({ prompt: req.prompt, schema: req.schema });
    const r = this.responses[this.i] ?? this.responses[this.responses.length - 1];
    this.i++;
    return r;
  };
}
