const FALLBACK_TOOLS_URL = 'https://rocketseat-tools-backend.vercel.app';

function baseUrl(): string {
  return process.env.BACKEND_API_URL || FALLBACK_TOOLS_URL;
}

function apiKey(): string | undefined {
  return process.env.INTERNAL_API_KEY;
}

export async function getCsatReviewsConfig(): Promise<{
  enabled: boolean;
  slackChannelId: string | null;
} | null> {
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
    return (await res.json()) as { enabled: boolean; slackChannelId: string | null };
  } catch (err) {
    console.error('[csat-reviews] toolsConfigClient error:', err);
    return null;
  }
}
