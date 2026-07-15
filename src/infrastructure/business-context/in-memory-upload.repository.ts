import type {
  UploadedFile,
  UploadRepositoryPort,
} from '@/core/business-context/upload-repository.port'
import type { ServiceResult } from '@/core/business-context/types'

export class InMemoryUploadRepository implements UploadRepositoryPort {
  private uploads = new Map<string, UploadedFile>()

  async createUpload(data: Omit<UploadedFile, 'id' | 'createdAt'>): Promise<ServiceResult<UploadedFile>> {
    const upload: UploadedFile = {
      ...data,
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
    }
    this.uploads.set(upload.id, upload)
    return { ok: true, data: upload }
  }

  async getUpload(workspaceId: string, uploadId: string): Promise<ServiceResult<UploadedFile | null>> {
    const upload = this.uploads.get(uploadId)
    if (!upload || upload.workspaceId !== workspaceId) {
      return { ok: true, data: null }
    }
    return { ok: true, data: upload }
  }

  async listUploads(filter: { workspaceId: string; businessId?: string }): Promise<ServiceResult<{ items: UploadedFile[]; total: number }>> {
    const items = Array.from(this.uploads.values()).filter(
      (u) => u.workspaceId === filter.workspaceId && (!filter.businessId || u.businessId === filter.businessId),
    )
    return { ok: true, data: { items, total: items.length } }
  }

  async deleteUpload(workspaceId: string, uploadId: string): Promise<ServiceResult<void>> {
    this.uploads.delete(uploadId)
    return { ok: true, data: undefined }
  }
}
