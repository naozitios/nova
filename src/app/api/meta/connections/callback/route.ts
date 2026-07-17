import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { Container } from '@/di/container'
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter'

// ─── State parsing ──────────────────────────────────────────────────────────

interface ParsedState {
  stateId: string
  nonce: string
  workspaceId: string
  returnPath: string
}

function parseState(raw: string): ParsedState | null {
  // Try JSON/base64 first
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'))
    if (decoded.stateId && decoded.nonce && decoded.workspaceId) {
      return {
        stateId: decoded.stateId,
        nonce: decoded.nonce,
        workspaceId: decoded.workspaceId,
        returnPath: decoded.returnPath ?? '/settings',
      }
    }
  } catch {
    // not base64 JSON — try colon-separated
  }

  // Colon-separated: stateId:nonce:workspaceId:returnPath
  const parts = raw.split(':')
  if (parts.length >= 3) {
    return {
      stateId: parts[0],
      nonce: parts[1],
      workspaceId: parts[2],
      returnPath: parts[3] || '/settings',
    }
  }

  return null
}

// ─── GET /api/meta/connections/callback ─────────────────────────────────────

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

  // ── Parse signed state ──────────────────────────────────────────────────
  const parsed = parseState(rawState)
  if (!parsed) {
    return errorRedirect('invalid_state')
  }

  const { stateId, nonce, workspaceId, returnPath } = parsed

  // ── Verify signed state nonce hash ──────────────────────────────────────
  const nonceHash = createHash('sha256').update(nonce).digest('hex')

  const repo = Container.getMetaConnectionRepository()
  const stateResult = await repo.getOAuthState(workspaceId, stateId)

  if (!stateResult.ok || !stateResult.data) {
    return errorRedirect('state_not_found')
  }

  const stateRecord = stateResult.data

  // Verify the nonce hash matches what was stored at state creation
  if (stateRecord.stateNonceHash !== nonceHash) {
    return errorRedirect('nonce_mismatch')
  }

  // ── Reject replayed states ──────────────────────────────────────────────
  if (stateRecord.consumedAt) {
    return errorRedirect('OAUTH_CALLBACK_REPLAYED')
  }

  // ── Record provider code hash before token exchange ─────────────────────
  const codeHash = createHash('sha256').update(code).digest('hex')

  const existingCodeHash = await repo.getProviderCodeHash(stateId)
  if (!existingCodeHash.ok) {
    return errorRedirect('code_hash_lookup_failed')
  }

  if (existingCodeHash.data) {
    // Provider code already seen — reject
    return errorRedirect('CODE_REPLAYED')
  }

  const createHashResult = await repo.createProviderCodeHash({
    oauthStateId: stateId,
    providerCodeHash: codeHash,
  })
  if (!createHashResult.ok) {
    // Race: another request created it first — treat as replay
    return errorRedirect('CODE_REPLAYED')
  }

  // ── Consume the OAuth state exactly once ────────────────────────────────
  const consumeResult = await repo.consumeOAuthState(workspaceId, stateId, codeHash)
  if (!consumeResult.ok) {
    return errorRedirect('OAUTH_CALLBACK_REPLAYED')
  }

  // ── Exchange code for access token via OAuth adapter ────────────────────
  const adapter = Container.getMetaOAuthAdapter()
  let tokenResult: { accessToken: string; adAccountId?: string }
  try {
    tokenResult = await adapter.exchangeCode(code)
  } catch {
    return errorRedirect('token_exchange_failed')
  }

  // ── Create or update connection ──────────────────────────────────────────
  const activeConn = await repo.getActiveConnection(workspaceId)

  if (activeConn.ok && activeConn.data) {
    // Update existing connection
    await repo.updateConnectionStatus(workspaceId, activeConn.data.id, 'connected', {
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // long-lived token
      selectedAdAccountId: tokenResult.adAccountId ?? null,
    })
  } else {
    // Create new connection — token is stored server-side only, never returned
    await repo.createConnection({
      workspaceId,
      connectedBy: stateRecord.createdBy,
      metaUserId: '',
      encryptedAccessToken: tokenResult.accessToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      selectedAdAccountId: tokenResult.adAccountId ?? null,
      accountMetadata: {},
      status: 'connected',
    })
  }

  // ── Redirect back to the caller ─────────────────────────────────────────
  return NextResponse.redirect(new URL(returnPath, url.origin), { status: 303 })
}
