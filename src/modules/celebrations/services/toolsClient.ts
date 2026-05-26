const FALLBACK_TOOLS_URL = 'https://rocketseat-tools-backend.vercel.app';

export interface BoosterDTO {
  id: string;
  email: string;
  full_name: string;
  gender: 'MALE' | 'FEMALE';
  company: 'ROCKETSEAT' | 'DIGITAL_HOUSE';
  birthday_date: string;
  admission_date: string | null;
  slack_user_id: string | null;
}

function baseUrl(): string {
  return process.env.BACKEND_API_URL || FALLBACK_TOOLS_URL;
}

function apiKey(): string | undefined {
  return process.env.INTERNAL_API_KEY;
}

export const toolsClient = {
  async findBoosters(field: 'birthday' | 'admission', month: number, day: number): Promise<BoosterDTO[]> {
    const key = apiKey();
    if (!key) {
      console.warn('[celebrations] INTERNAL_API_KEY ausente, retornando lista vazia.');
      return [];
    }
    const url = `${baseUrl()}/api/hr/internal/by-date?field=${field}&month=${month}&day=${day}`;
    const res = await fetch(url, { headers: { 'x-api-key': key } });
    if (!res.ok) {
      console.error(`[celebrations] toolsClient.findBoosters ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { items: BoosterDTO[] };
    return body.items || [];
  },

  async updateBoosterSlackId(id: string, slackUserId: string): Promise<void> {
    const key = apiKey();
    if (!key) return;
    await fetch(`${baseUrl()}/api/hr/internal/boosters/${id}/slack-id`, {
      method: 'PATCH',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slackUserId }),
    }).catch((err) => console.error('[celebrations] updateBoosterSlackId failed:', err));
  },

  /**
   * Persiste no Tools o resultado da resolucao Slack: slackUserId e/ou
   * avatarUrl, com timestamp. Passar `null` em algum campo significa
   * "tentei resolver e nao achei" — diferente de nao passar (que mantem
   * o valor atual). O Tools usa isso pra calcular o status na UI.
   */
  async updateBoosterSlackData(
    id: string,
    data: { slackUserId?: string | null; avatarUrl?: string | null }
  ): Promise<void> {
    const key = apiKey();
    if (!key) return;
    await fetch(`${baseUrl()}/api/hr/internal/boosters/${id}/slack-data`, {
      method: 'PATCH',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, resolvedAt: new Date().toISOString() }),
    }).catch((err) => console.error('[celebrations] updateBoosterSlackData failed:', err));
  },

  /**
   * Lista todos os boosters ativos. Usado pelo refresh de avatares.
   */
  async listActiveBoosters(): Promise<BoosterDTO[]> {
    const key = apiKey();
    if (!key) return [];
    const res = await fetch(`${baseUrl()}/api/hr/internal/boosters/active`, {
      headers: { 'x-api-key': key },
    });
    if (!res.ok) {
      console.error(`[celebrations] toolsClient.listActiveBoosters ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { items: BoosterDTO[] };
    return body.items || [];
  },

  async getCelebrationsConfig(): Promise<{ enabled: boolean; slackChannelId: string | null } | null> {
    const key = apiKey();
    if (!key) return null;
    try {
      const res = await fetch(`${baseUrl()}/api/hr/internal/celebrations/config`, {
        headers: { 'x-api-key': key },
      });
      if (!res.ok) {
        console.error(`[celebrations] getCelebrationsConfig ${res.status}`);
        return null;
      }
      const body = (await res.json()) as { enabled: boolean; slackChannelId: string | null };
      return body;
    } catch (err) {
      console.error('[celebrations] getCelebrationsConfig failed:', err);
      return null;
    }
  },
};
