import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter'
import { MetaTokenVault } from '@/infrastructure/meta/token-vault'
import { decodeMetaOAuthState, hashMetaOAuthNonce } from '@/core/meta-data/oauth-state'
import { config } from '@/infrastructure/config'

const repo = new SupabaseMetaRepository()
const adapter = new MetaOAuthAdapter()

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const rawState = url.searchParams.get('state')

  const errorRedirect = (msg: string) =>
    NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, url.origin),
      { status: 303 },
    )

  if (!code || !rawState) {
    return errorRedirect('missing_params')
  }

  const decoded = decodeMetaOAuthState(rawState)
  if (!decoded) {
    return errorRedirect('invalid_state')
  }

  const { stateId, nonce, userId, returnPath } = decoded
  const nonceHash = hashMetaOAuthNonce(nonce)
  const providerCodeHash = createHash('sha256').update(code).digest('hex')

  const consumeResult = await repo.consumeOAuthState({
    stateId,
    nonceHash,
    providerCodeHash,
    now: new Date(),
  })

  if (!consumeResult.ok) {
    return errorRedirect(consumeResult.error.code)
  }

  let tokenResult: { accessToken: string; expiresIn?: number }
  try {
    tokenResult = await adapter.exchangeCode(code)
  } catch {
    return errorRedirect('token_exchange_failed')
  }
  const tokenVault = new MetaTokenVault()
  const encryptedAccessToken = tokenVault.encrypt(tokenResult.accessToken)
  const grantedScopes = config.meta.scopes

  const tokenExpiresAt = tokenResult.expiresIn
    ? new Date(Date.now() + tokenResult.expiresIn * 1000)
    : null

  const upsertResult = await repo.upsertConnection({
    workspaceId: decoded.workspaceId,
    connectedBy: decoded.userId,
    metaUserId: userId,
    encryptedAccessToken,
    grantedScopes,
    tokenExpiresAt,
  })

  if (!upsertResult.ok) {
    return errorRedirect('connection_failed')
  }

  return NextResponse.redirect(new URL(returnPath, url.origin), { status: 303 })
}
