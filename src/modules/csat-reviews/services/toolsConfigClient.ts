const FALLBACK_TOOLS_URL = 'https://rocketseat-tools-backend.vercel.app';

function baseUrl(): string {
  return process.env.BACKEND_API_URL || FALLBACK_TOOLS_URL;
}

function apiKey(): string | undefined {
  return process.env.INTERNAL_API_KEY;
}

export interface CsatReviewsRemoteConfig {
  enabled: boolean;
  slackChannelId: string | null;
  // JSON cru — o consumidor passa por `normalizeMessageFields` antes
  // de usar. Mantido como `unknown` aqui pra nao acoplar o cliente HTTP
  // com a forma do MessageField.
  messageFields: unknown;
}

export async function getCsatReviewsConfig(): Promise<CsatReviewsRemoteConfig | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(`${baseUrl()}/api/csat-reviews/internal/config`, {
      headers: { 'x-api-key': key },
    });
    if (!res.ok) {
      console.error(`[csat-reviews] toolsConfigClient ${res.status}`);
      return null;
    }
    return (await res.json()) as CsatReviewsRemoteConfig;
  } catch (err) {
    console.error('[csat-reviews] toolsConfigClient error:', err);
    return null;
  }
}
