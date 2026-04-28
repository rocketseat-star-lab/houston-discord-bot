const FALLBACK_TOOLS_URL = 'https://rocketseat-tools-backend.vercel.app';

function baseUrl(): string {
  return process.env.BACKEND_API_URL || FALLBACK_TOOLS_URL;
}

function apiKey(): string | undefined {
  return process.env.INTERNAL_API_KEY;
}

export interface ReputationEvent {
  type:
    | 'MESSAGE'
    | 'VOICE_SEGMENT'
    | 'REACTION_GIVEN'
    | 'THREAD_HELPFUL'
    | 'FORUM_SOLUTION'
    | 'HIGH_REACTIONS'
    | 'MODERATION';
  payload: Record<string, unknown>;
}

export const toolsClient = {
  fireEvent(event: ReputationEvent): void {
    const key = apiKey();
    if (!key) return;
    fetch(`${baseUrl()}/api/reputation/internal/events`, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }).catch((err) => {
      console.error('[reputation] forward failed:', err?.message || err);
    });
  },

  async castVote(payload: {
    guildId: string;
    voterDiscordId: string;
    voterUsername?: string | null;
    voterRoleIds?: string[];
    voterAccountAgeDays?: number;
    targetDiscordId: string;
    targetUsername?: string | null;
    type: 'POSITIVE' | 'NEGATIVE';
    reason?: string;
  }): Promise<{ success: boolean; message: string }> {
    const key = apiKey();
    if (!key) return { success: false, message: 'INTERNAL_API_KEY ausente.' };
    try {
      const res = await fetch(`${baseUrl()}/api/reputation/internal/votes`, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };
      return {
        success: !!body.success,
        message: body.message || (res.ok ? 'OK' : `Erro ${res.status}`),
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede' };
    }
  },

  async getMyScore(
    guildId: string,
    discordUserId: string
  ): Promise<{ scoreTotal: number; message?: string | null } | null> {
    const key = apiKey();
    if (!key) return null;
    try {
      const res = await fetch(
        `${baseUrl()}/api/reputation/internal/members/${discordUserId}?guildId=${guildId}`,
        { headers: { 'x-api-key': key } }
      );
      if (!res.ok) return null;
      return (await res.json()) as { scoreTotal: number; message?: string | null };
    } catch (err) {
      console.error('[reputation] getMyScore failed:', err);
      return null;
    }
  },
};
