import type { ServiceResult } from './types'

export interface UploadedFile {
  id: string
  workspaceId: string
  businessId: string
  fileName: string
  mimeType: string
  storagePath: string
  checksum: string
  sizeBytes: number
  createdAt: Date
}

export interface UploadRepositoryPort {
  createUpload(data: Omit<UploadedFile, 'id' | 'createdAt'>): Promise<ServiceResult<UploadedFile>>
  getUpload(workspaceId: string, uploadId: string): Promise<ServiceResult<UploadedFile | null>>
  listUploads(filter: { workspaceId: string; businessId?: string }): Promise<ServiceResult<{ items: UploadedFile[]; total: number }>>
  deleteUpload(workspaceId: string, uploadId: string): Promise<ServiceResult<void>>
}
