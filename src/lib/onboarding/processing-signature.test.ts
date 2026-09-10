import { describe, expect, it } from 'vitest';
import { processingRunSignature } from './processing-signature';

describe('processingRunSignature', () => {
  it('changes when source IDs change for the same business', () => {
    const first = processingRunSignature('biz-1', [
      { id: 'source-a' },
    ]);
    const second = processingRunSignature('biz-1', [
      { id: 'source-a' },
      { id: 'source-b' },
    ]);

    expect(second).not.toBe(first);
  });

  it('is stable when source order changes', () => {
    const first = processingRunSignature('biz-1', [
      { id: 'source-b' },
      { id: 'source-a' },
    ]);
    const second = processingRunSignature('biz-1', [
      { id: 'source-a' },
      { id: 'source-b' },
    ]);

    expect(second).toBe(first);
  });
});
