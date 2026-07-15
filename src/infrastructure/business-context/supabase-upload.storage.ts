import type { UploadStoragePort } from '@/core/business-context/upload-storage.port'
import type { ServiceResult } from '@/core/business-context/types'
import { getSupabaseServiceClient } from './supabase-client'

export class SupabaseUploadStorage implements UploadStoragePort {
  async upload(params: { bucket: string; path: string; content: Buffer; contentType: string }): Promise<ServiceResult<{ storagePath: string }>> {
    const client = getSupabaseServiceClient()
    const { error } = await client.storage
      .from(params.bucket)
      .upload(params.path, params.content, { contentType: params.contentType, upsert: false })
    if (error) {
      return { ok: false, error: { code: 'UPLOAD_FAILED', message: error.message } }
    }
    return { ok: true, data: { storagePath: params.path } }
  }

  async download(params: { bucket: string; path: string }): Promise<ServiceResult<Buffer>> {
    const client = getSupabaseServiceClient()
    const { data, error } = await client.storage.from(params.bucket).download(params.path)
    if (error) {
      return { ok: false, error: { code: 'DOWNLOAD_FAILED', message: error.message } }
    }
    return { ok: true, data: Buffer.from(await data.arrayBuffer()) }
  }

  async delete(params: { bucket: string; path: string }): Promise<ServiceResult<void>> {
    const client = getSupabaseServiceClient()
    const { error } = await client.storage.from(params.bucket).remove([params.path])
    if (error) {
      return { ok: false, error: { code: 'DELETE_FAILED', message: error.message } }
    }
    return { ok: true, data: undefined }
  }

  async getSignedUrl(params: { bucket: string; path: string; expiresIn?: number }): Promise<ServiceResult<string>> {
    const client = getSupabaseServiceClient()
    const { data, error } = await client.storage
      .from(params.bucket)
      .createSignedUrl(params.path, params.expiresIn ?? 3600)
    if (error) {
      return { ok: false, error: { code: 'SIGNING_FAILED', message: error.message } }
    }
    return { ok: true, data: data.signedUrl }
  }
}
