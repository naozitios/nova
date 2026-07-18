import { Container } from '@/di/container';
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter'
import { decodeMetaOAuthState, hashMetaOAuthNonce } from '@/core/meta-data/oauth-state'
import { config } from '@/infrastructure/config'

const repo = Container.getMetaRepository()
const adapter = new MetaOAuthAdapter()

function validateReturnPath(returnPath: string): boolean {
  if (!returnPath || returnPath.startsWith('//')) return false
  if (returnPath.startsWith('http://') || returnPath.startsWith('https://')) return false
  if (!returnPath.startsWith('/')) return false
  return true
}

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

  const storedState = consumeResult.data
  if (storedState.workspaceId !== decoded.workspaceId || storedState.createdBy !== decoded.userId) {
    return errorRedirect('state_mismatch')
  }
  const safeReturnPath = validateReturnPath(decoded.returnPath) ? decoded.returnPath : '/settings'

  let tokenResult: { accessToken: string; expiresIn?: number; grantedScopes?: string[] }
  try {
    tokenResult = await adapter.exchangeCode(code)
  } catch {
    return errorRedirect('token_exchange_failed')
  }

  let metaUserId: string
  try {
    const metaUser = await adapter.fetchMetaUser(tokenResult.accessToken)
    metaUserId = metaUser.id
  } catch {
    return errorRedirect('meta_user_fetch_failed')
  }

  const tokenVault = Container.getMetaTokenVault()
  const encryptedAccessToken = tokenVault.encrypt(tokenResult.accessToken)
  let grantedScopes: string[]
  if (tokenResult.grantedScopes && tokenResult.grantedScopes.length > 0) {
    grantedScopes = tokenResult.grantedScopes
  } else {
    try {
      const permissions = await adapter.fetchMetaPermissions(tokenResult.accessToken)
      grantedScopes = permissions.filter(p => p.permission && p.status === 'granted').map(p => p.permission)
      if (grantedScopes.length === 0) {
        return errorRedirect('no_permissions_granted')
      }
    } catch {
      return errorRedirect('permissions_fetch_failed')
    }
  }

  const tokenExpiresAt = tokenResult.expiresIn
    ? new Date(Date.now() + tokenResult.expiresIn * 1000)
    : null

  const upsertResult = await repo.upsertConnection({
    workspaceId: decoded.workspaceId,
    connectedBy: decoded.userId,
    metaUserId: metaUserId,
    encryptedAccessToken,
    grantedScopes,
    tokenExpiresAt,
  })

  if (!upsertResult.ok) {
    return errorRedirect('connection_failed')
  }

  return NextResponse.redirect(new URL(safeReturnPath, url.origin), { status: 303 })
}
