import { Events, VoiceState } from 'discord.js';
import prisma from '../../services/prisma';

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceState, newState: VoiceState) {
    try {
      const userId = newState.member?.user.id;
      const username = newState.member?.user.tag;

      if (!userId || !username) return;

      // Usuário entrou em um canal de voz
      if (!oldState.channelId && newState.channelId) {
        await prisma.voiceActivityLog.create({
          data: {
            guildId: newState.guild.id,
            channelId: newState.channelId,
            userId,
            username,
            joinedAt: new Date(),
            wasMuted: newState.selfMute || newState.serverMute || false,
            wasDeafened: newState.selfDeaf || newState.serverDeaf || false,
            wasStreaming: newState.streaming || false,
            wasVideo: newState.selfVideo || false,
          },
        });
        console.log(`[VoiceActivity] ${username} entrou em canal de voz`);
      }

      // Usuário saiu de um canal de voz
      if (oldState.channelId && !newState.channelId) {
        // Buscar a entrada mais recente sem leftAt para este usuário neste canal
        const activeSession = await prisma.voiceActivityLog.findFirst({
          where: {
            userId,
            channelId: oldState.channelId,
            leftAt: null,
          },
          orderBy: { joinedAt: 'desc' },
        });

        if (activeSession) {
          const leftAt = new Date();
          const durationSec = Math.floor((leftAt.getTime() - activeSession.joinedAt.getTime()) / 1000);

          await prisma.voiceActivityLog.update({
            where: { id: activeSession.id },
            data: {
              leftAt,
              durationSec,
            },
          });
          console.log(`[VoiceActivity] ${username} saiu do canal de voz (${durationSec}s)`);
        }
      }

      // Usuário mudou de canal (saiu de um e entrou em outro)
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Finalizar sessão antiga
        const activeSession = await prisma.voiceActivityLog.findFirst({
          where: {
            userId,
            channelId: oldState.channelId,
            leftAt: null,
          },
          orderBy: { joinedAt: 'desc' },
        });

        if (activeSession) {
          const leftAt = new Date();
          const durationSec = Math.floor((leftAt.getTime() - activeSession.joinedAt.getTime()) / 1000);

          await prisma.voiceActivityLog.update({
            where: { id: activeSession.id },
            data: { leftAt, durationSec },
          });
        }

        // Criar nova sessão
        await prisma.voiceActivityLog.create({
          data: {
            guildId: newState.guild.id,
            channelId: newState.channelId,
            userId,
            username,
            joinedAt: new Date(),
            wasMuted: newState.selfMute || newState.serverMute || false,
            wasDeafened: newState.selfDeaf || newState.serverDeaf || false,
            wasStreaming: newState.streaming || false,
            wasVideo: newState.selfVideo || false,
          },
        });

        console.log(`[VoiceActivity] ${username} mudou de canal de voz`);
      }
    } catch (error) {
      console.error('[voiceStateUpdate] Erro ao processar mudança de estado de voz:', error);
    }
  },
};
