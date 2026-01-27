import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import axios from 'axios';

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember) {
    try {
      // Verificar se houve mudança no timeout
      const oldTimeout = oldMember.communicationDisabledUntil;
      const newTimeout = newMember.communicationDisabledUntil;

      // Se não houve mudança no timeout, ignorar
      if (oldTimeout?.getTime() === newTimeout?.getTime()) {
        return;
      }

      // Timeout foi adicionado ou atualizado
      if (newTimeout && (!oldTimeout || newTimeout > oldTimeout)) {
        console.log(`[GuildMemberUpdate] User ${newMember.user.tag} recebeu timeout até ${newTimeout}`);

        // Buscar informações do audit log para saber quem aplicou o timeout
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberUpdate,
          limit: 5,
        });

        const timeoutLog = auditLogs.entries.find(
          entry =>
            entry.targetId === newMember.id &&
            entry.createdTimestamp > Date.now() - 5000 // Últimos 5 segundos
        );

        const moderator = timeoutLog?.executor;
        const reason = timeoutLog?.reason || 'Sem motivo especificado';

        // Calcular duração em segundos
        const durationMs = newTimeout.getTime() - Date.now();
        const duration = Math.floor(durationMs / 1000);

        // Reportar ao backend
        const backendApiUrl = process.env.BACKEND_API_URL;
        const apiKey = process.env.INTERNAL_API_KEY;

        if (!backendApiUrl || !apiKey) {
          console.warn('[GuildMemberUpdate] Backend API not configured');
          return;
        }

        const timeoutData = {
          guildId: newMember.guild.id,
          userId: newMember.user.id,
          username: newMember.user.tag,
          moderatorId: moderator?.id || null,
          moderatorTag: moderator?.tag || null,
          reason,
          duration,
          expiresAt: newTimeout.toISOString(),
          appliedAt: new Date().toISOString(),
        };

        await axios.post(
          `${backendApiUrl}/api/moderation/internal/timeouts`,
          timeoutData,
          {
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        console.log(`[GuildMemberUpdate] Timeout reportado ao backend: ${newMember.user.tag}`);
      }
    } catch (error) {
      console.error('[GuildMemberUpdate] Erro ao processar timeout:', error);
    }
  },
};
