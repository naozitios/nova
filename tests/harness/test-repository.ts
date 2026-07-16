import type { RepositoryPort } from "@/core/business-context/repository.port";
import type { ServiceResult } from "@/core/business-context/types";

export type RepoOverrides = Partial<{
  [K in keyof RepositoryPort]: RepositoryPort[K];
}>;

export function createFakeRepository(overrides: RepoOverrides = {}): RepositoryPort {
  return new Proxy({} as RepositoryPort, {
    get(_target, prop: string) {
      if (prop in overrides) {
        return (overrides as Record<string, unknown>)[prop];
      }
      return async (..._args: unknown[]) => ({ ok: true, data: undefined }) as ServiceResult<unknown>;
    },
  });
}
