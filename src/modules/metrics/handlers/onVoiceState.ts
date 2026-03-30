import { VoiceState } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import { startVoiceSession, endVoiceSession, moveVoiceChannel, recordVoiceEvent } from '../services/voiceService';

export async function onVoiceState(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guildId = newState.guild.id;
  if (!METRICS_CONFIG.allowedGuildIds.includes(guildId)) return;

  const userId = newState.id;
  const sessionId = newState.sessionId || `fallback-${userId}-${Date.now()}`;

  try {
    const joined = !oldState.channelId && newState.channelId;
    const left = oldState.channelId && !newState.channelId;
    const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    if (joined) {
      await recordVoiceEvent({
        guildId,
        userId,
        channelId: newState.channelId!,
        channelName: newState.channel?.name ?? null,
        sessionId,
        eventType: 'joined_voice_channel',
      });
      await startVoiceSession(guildId, userId, sessionId, newState.channelId!);
      return;
    }

    if (left) {
      const leaveSessionId = oldState.sessionId || sessionId;
      await recordVoiceEvent({
        guildId,
        userId,
        channelId: oldState.channelId!,
        channelName: oldState.channel?.name ?? null,
        sessionId: leaveSessionId,
        eventType: 'left_voice_channel',
      });
      await endVoiceSession(guildId, userId, leaveSessionId);
      return;
    }

    if (moved) {
      await recordVoiceEvent({
        guildId,
        userId,
        channelId: newState.channelId!,
        channelName: newState.channel?.name ?? null,
        sessionId,
        eventType: 'moved_voice_channel',
      });
      await moveVoiceChannel(guildId, userId, sessionId, newState.channelId!);
      return;
    }

    // In-channel state changes (same channel)
    await detectStateChanges(oldState, newState, guildId, userId, sessionId);
  } catch (error) {
    console.error(`[metrics] Error processing voice state for ${userId}:`, error);
  }
}

async function detectStateChanges(
  oldState: VoiceState,
  newState: VoiceState,
  guildId: string,
  userId: string,
  sessionId: string | null
): Promise<void> {
  const channelId = newState.channelId!;

  const changes: Array<{ old: boolean; new: boolean; on: string; off: string }> = [
    { old: oldState.serverMute ?? false, new: newState.serverMute ?? false, on: 'server_muted', off: 'server_unmuted' },
    { old: oldState.selfMute ?? false, new: newState.selfMute ?? false, on: 'self_muted', off: 'self_unmuted' },
    { old: oldState.serverDeaf ?? false, new: newState.serverDeaf ?? false, on: 'server_deafened', off: 'server_undeafened' },
    { old: oldState.selfDeaf ?? false, new: newState.selfDeaf ?? false, on: 'self_deafened', off: 'self_undeafened' },
    { old: oldState.streaming ?? false, new: newState.streaming ?? false, on: 'started_streaming', off: 'stopped_streaming' },
    { old: oldState.selfVideo ?? false, new: newState.selfVideo ?? false, on: 'started_video', off: 'stopped_video' },
  ];

  for (const change of changes) {
    if (change.old === change.new) continue;

    const eventType = change.new ? change.on : change.off;
    await recordVoiceEvent({ guildId, userId, channelId, sessionId, eventType });
  }
}
