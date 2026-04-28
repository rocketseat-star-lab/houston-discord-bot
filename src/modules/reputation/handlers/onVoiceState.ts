import { VoiceState } from 'discord.js';
import { REPUTATION_CONFIG } from '../config';
import { toolsClient } from '../services/toolsClient';

// In-memory map of join times per user. Reset on bot restart.
const joinTimes = new Map<string, number>();

export async function onVoiceState(oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId || guildId !== REPUTATION_CONFIG.activeGuildId) return;

    const userId = newState.id;
    const wasInVoice = !!oldState.channelId;
    const isInVoice = !!newState.channelId;

    if (!wasInVoice && isInVoice) {
      joinTimes.set(userId, Date.now());
      return;
    }

    if (wasInVoice && !isInVoice) {
      const joined = joinTimes.get(userId);
      joinTimes.delete(userId);
      if (!joined) return;
      const minutes = Math.floor((Date.now() - joined) / 60000);
      if (minutes >= 10) {
        toolsClient.fireEvent({
          type: 'VOICE_SEGMENT',
          payload: {
            guildId,
            discordUserId: userId,
            minutesInVoice: minutes,
          },
        });
      }
    }
  } catch (err) {
    console.error('[reputation] onVoiceState error:', err);
  }
}
