import type { ServiceResult } from './types'

export interface UploadStoragePort {
  upload(params: { bucket: string; path: string; content: Buffer; contentType: string }): Promise<ServiceResult<{ storagePath: string }>>
  download(params: { bucket: string; path: string }): Promise<ServiceResult<Buffer>>
  delete(params: { bucket: string; path: string }): Promise<ServiceResult<void>>
  getSignedUrl(params: { bucket: string; path: string; expiresIn?: number }): Promise<ServiceResult<string>>
}
