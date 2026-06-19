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
    // 1. Restaura do snapshot local PRIMEIRO. A moderacao volta a
    //    funcionar imediatamente apos um deploy/restart, sem depender de
    //    sincronizacao com o Tools. Esse e o fix do "subo algo e a
    //    moderacao para ate eu sincronizar de novo".
    const restored = await moderationRuleCache.loadFromSnapshot();
    console.log(
      restored
        ? '[moderation] Regras restauradas do snapshot local — moderacao ativa'
        : '[moderation] Sem snapshot local; aguardando primeira sincronizacao'
    );

    // 2. Atualiza do Tools em background, SEM bloquear o boot. Se o
    //    snapshot ja restaurou, isto so traz mudancas feitas enquanto o
    //    bot estava fora. Se nao havia snapshot, isto popula (com retries
    //    pro cold start do Vercel). Falha aqui nao derruba a moderacao —
    //    seguimos com o snapshot.
    void moderationRuleCache.fetchAndLoadRules(restored ? 5 : 10);

    // 3. Background sync adaptativo: enquanto o cache estiver vazio,
    //    tenta a cada 30s (recuperacao agressiva); populado, espaca pra
    //    5min de steady state.
    moderationRuleCache.startBackgroundSync(5 * 60 * 1000, 30 * 1000);
  },

  async shutdown() {
    moderationRuleCache.stopBackgroundSync();
  },
};
