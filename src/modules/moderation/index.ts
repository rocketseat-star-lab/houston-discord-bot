import { Message, TextChannel, NewsChannel, GuildBan, GuildMember, AuditLogEvent, Events } from 'discord.js';
import axios from 'axios';
import prisma from '../../services/prisma';
import { moderationService } from '../../services/moderationService';
import { moderationRuleCache } from '../../services/moderationRuleCache';
import type { FeatureModule } from '../../core/module';

// Import existing API routes
import moderationRoutes from '../../api/routes/moderation.routes';

async function onMessage(message: Message): Promise<void> {
  if (!(message.channel instanceof TextChannel || message.channel instanceof NewsChannel) || !message.guild) return;
  if (message.author.bot || message.system) return;

  try {
    await moderationService.evaluateMessage(message);
  } catch (error) {
    console.error('[moderation] Error in moderation evaluation:', error);
  }
}

async function onBanAdd(ban: GuildBan): Promise<void> {
  try {
    console.log(`[moderation] User ${ban.user.tag} foi banido do servidor ${ban.guild.name}`);

    const auditLogs = await ban.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 1,
    });

    const banLog = auditLogs.entries.first();
    const moderator = banLog?.executor;
    const reason = banLog?.reason || ban.reason || 'Sem motivo especificado';

    const backendApiUrl = process.env.BACKEND_API_URL;
    const apiKey = process.env.INTERNAL_API_KEY;

    if (!backendApiUrl || !apiKey) {
      console.warn('[moderation] Backend API not configured');
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

    await prisma.moderationBan.create({
      data: {
        guildId: ban.guild.id,
        userId: ban.user.id,
        username: ban.user.tag,
        moderatorId: moderator?.id || null,
        moderatorTag: moderator?.tag || null,
        reason,
        permanent: true,
        bannedAt: new Date(),
      },
    });

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

    console.log(`[moderation] Ban reportado ao backend: ${ban.user.tag}`);
  } catch (error) {
    console.error('[moderation] Erro ao processar ban:', error);
  }
}

async function onMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  try {
    const oldTimeout = oldMember.communicationDisabledUntil;
    const newTimeout = newMember.communicationDisabledUntil;

    if (oldTimeout?.getTime() === newTimeout?.getTime()) return;

    if (newTimeout && (!oldTimeout || newTimeout > oldTimeout)) {
      console.log(`[moderation] User ${newMember.user.tag} recebeu timeout até ${newTimeout}`);

      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 5,
      });

      const timeoutLog = auditLogs.entries.find(
        entry =>
          entry.targetId === newMember.id &&
          entry.createdTimestamp > Date.now() - 5000
      );

      const moderator = timeoutLog?.executor;
      const reason = timeoutLog?.reason || 'Sem motivo especificado';

      const durationMs = newTimeout.getTime() - Date.now();
      const duration = Math.floor(durationMs / 1000);

      const backendApiUrl = process.env.BACKEND_API_URL;
      const apiKey = process.env.INTERNAL_API_KEY;

      if (!backendApiUrl || !apiKey) {
        console.warn('[moderation] Backend API not configured');
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

      await prisma.moderationTimeout.create({
        data: {
          guildId: newMember.guild.id,
          userId: newMember.user.id,
          username: newMember.user.tag,
          moderatorId: moderator?.id || null,
          moderatorTag: moderator?.tag || null,
          reason,
          duration,
          expiresAt: newTimeout,
          appliedAt: new Date(),
        },
      });

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

      console.log(`[moderation] Timeout reportado ao backend: ${newMember.user.tag}`);
    }
  } catch (error) {
    console.error('[moderation] Erro ao processar timeout:', error);
  }
}

export const moderationModule: FeatureModule = {
  name: 'moderation',
  description: 'Auto-moderation rules engine, ban/timeout tracking',
  handlers: {
    messageCreate: onMessage,
    guildBanAdd: onBanAdd,
    guildMemberUpdate: onMemberUpdate,
  },
  routes: moderationRoutes,
  async initialize() {
    console.log('[moderation] Loading moderation rules from backend...');
    await moderationRuleCache.fetchAndLoadRules(5, 3000);
    console.log('[moderation] Moderation rules loading completed');
  },
};
