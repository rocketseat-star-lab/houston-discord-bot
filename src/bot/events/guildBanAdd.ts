import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import axios from 'axios';

export default {
  name: Events.GuildBanAdd,
  async execute(ban: GuildBan) {
    try {
      console.log(`[GuildBanAdd] User ${ban.user.tag} foi banido do servidor ${ban.guild.name}`);

      // Buscar informações do audit log para saber quem baniu
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 1,
      });

      const banLog = auditLogs.entries.first();
      const moderator = banLog?.executor;
      const reason = banLog?.reason || ban.reason || 'Sem motivo especificado';

      // Reportar ao backend
      const backendApiUrl = process.env.BACKEND_API_URL;
      const apiKey = process.env.INTERNAL_API_KEY;

      if (!backendApiUrl || !apiKey) {
        console.warn('[GuildBanAdd] Backend API not configured');
        return;
      }

      const banData = {
        guildId: ban.guild.id,
        userId: ban.user.id,
        username: ban.user.tag,
        moderatorId: moderator?.id || null,
        moderatorTag: moderator?.tag || null,
        reason,
        permanent: true,
        bannedAt: new Date().toISOString(),
      };

      await axios.post(
        `${backendApiUrl}/api/moderation/internal/bans`,
        banData,
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log(`[GuildBanAdd] Ban reportado ao backend: ${ban.user.tag}`);
    } catch (error) {
      console.error('[GuildBanAdd] Erro ao processar ban:', error);
    }
  },
};
