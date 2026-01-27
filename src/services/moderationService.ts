import { Message, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { moderationRuleCache, CachedRule } from './moderationRuleCache';
import axios from 'axios';

/**
 * Interface para rastrear mensagens recentes por usuário
 */
interface UserMessage {
  content: string;
  timestamp: number;
  messageId: string;
}

/**
 * Serviço principal de moderação
 * Avalia mensagens contra regras e executa ações
 */
export class ModerationService {
  private backendApiUrl: string;
  private backendApiKey: string;
  private reportErrors: Array<{ timestamp: string; error: string; details: any }> = [];
  private reportSuccessCount = 0;
  private reportFailureCount = 0;
  private readonly MAX_ERRORS = 20;

  // Cache de mensagens recentes para detecção de spam
  private userMessagesCache: Map<string, UserMessage[]> = new Map();

  constructor() {
    // TODO: Remover hardcoded URL quando variável de ambiente for configurada em produção
    this.backendApiUrl = process.env.BACKEND_API_URL || 'https://rocketseat-tools-backend.vercel.app';
    this.backendApiKey = process.env.INTERNAL_API_KEY || '';
  }

  /**
   * Retorna estatísticas de comunicação com o backend
   */
  getDebugInfo() {
    return {
      backendApiUrl: this.backendApiUrl,
      hasApiKey: !!this.backendApiKey,
      apiKeyLength: this.backendApiKey.length,
      reportSuccessCount: this.reportSuccessCount,
      reportFailureCount: this.reportFailureCount,
      lastErrors: this.reportErrors,
    };
  }

  /**
   * Avalia uma mensagem contra todas as regras de moderação ativas
   */
  async evaluateMessage(message: Message): Promise<void> {
    try {
      // Pega todas as regras ativas do cache
      const rules = moderationRuleCache.getAllRules();

      if (rules.length === 0) {
        return; // Sem regras para avaliar
      }

      // Avalia cada regra em ordem de prioridade
      for (const rule of rules) {
        try {
          await this.evaluateRule(message, rule);
        } catch (error) {
          console.error(`[ModerationService] Error evaluating rule ${rule.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[ModerationService] Error in evaluateMessage:', error);
    }
  }

  /**
   * Avalia uma mensagem contra uma regra específica
   */
  private async evaluateRule(message: Message, rule: CachedRule): Promise<void> {
    // Verifica se o usuário tem role de isenção
    if (await this.hasExemptRole(message.member, rule.exemptRoleIds)) {
      return;
    }

    // Verifica se o canal está isento
    if (this.isExemptChannel(message.channel.id, rule.exemptChannelIds)) {
      return;
    }

    // Avalia o trigger da regra
    const triggered = await this.evaluateTrigger(message, rule);

    if (triggered) {
      console.log(`[ModerationService] Rule "${rule.name}" (${rule.id}) triggered by ${message.author.tag}`);

      // Executa todas as ações da regra em ordem
      await this.executeActions(message, rule);
    }
  }

  /**
   * Verifica se o usuário tem alguma role de isenção
   */
  private async hasExemptRole(member: GuildMember | null, exemptRoleIds: string[]): Promise<boolean> {
    if (!member || exemptRoleIds.length === 0) {
      return false;
    }

    return exemptRoleIds.some(roleId => member.roles.cache.has(roleId));
  }

  /**
   * Verifica se o canal está isento
   */
  private isExemptChannel(channelId: string, exemptChannelIds: string[]): boolean {
    return exemptChannelIds.includes(channelId);
  }

  /**
   * Avalia o trigger de uma regra contra a mensagem
   */
  private async evaluateTrigger(message: Message, rule: CachedRule): Promise<boolean> {
    const { triggerType, triggerConfig } = rule;

    switch (triggerType) {
      case 'MESSAGE_ATTACHMENTS_COUNT':
        return this.evaluateAttachmentsTrigger(message, triggerConfig);

      case 'MESSAGE_MENTIONS_COUNT':
        return this.evaluateMentionsTrigger(message, triggerConfig);

      case 'MESSAGE_SPAM':
        return await this.evaluateSpamTrigger(message, triggerConfig);

      case 'MESSAGE_CAPS_EXCESSIVE':
        return this.evaluateCapsTrigger(message, triggerConfig);

      case 'MESSAGE_LINKS_SPAM':
        return this.evaluateLinksTrigger(message, triggerConfig);

      case 'MESSAGE_EMOJI_SPAM':
        return this.evaluateEmojiTrigger(message, triggerConfig);

      case 'CUSTOM_KEYWORD':
        return this.evaluateKeywordTrigger(message, triggerConfig);

      default:
        console.warn(`[ModerationService] Unknown trigger type: ${triggerType}`);
        return false;
    }
  }

  /**
   * Avalia trigger de anexos
   */
  private evaluateAttachmentsTrigger(message: Message, config: Record<string, any>): boolean {
    const maxAttachments = config.maxAttachments || 3;
    return message.attachments.size > maxAttachments;
  }

  /**
   * Avalia trigger de menções
   */
  private evaluateMentionsTrigger(message: Message, config: Record<string, any>): boolean {
    const maxMentions = config.maxMentions || 5;
    return message.mentions.users.size > maxMentions;
  }

  /**
   * Avalia trigger de spam
   * Detecta quando um usuário envia muitas mensagens em um curto período
   */
  private async evaluateSpamTrigger(message: Message, config: Record<string, any>): Promise<boolean> {
    const timeWindow = (config.timeWindow || 5) * 1000; // Converte para milissegundos
    const minMessages = config.minMessages || 5;
    const userId = message.author.id;
    const now = Date.now();

    // Obtém ou inicializa cache de mensagens do usuário
    if (!this.userMessagesCache.has(userId)) {
      this.userMessagesCache.set(userId, []);
    }

    const userMessages = this.userMessagesCache.get(userId)!;

    // Remove mensagens antigas (fora da janela de tempo)
    const recentMessages = userMessages.filter(msg => now - msg.timestamp <= timeWindow);

    // Adiciona a mensagem atual
    recentMessages.push({
      content: message.content,
      timestamp: now,
      messageId: message.id,
    });

    // Atualiza o cache
    this.userMessagesCache.set(userId, recentMessages);

    // Limpa o cache periodicamente (remove usuários inativos)
    if (Math.random() < 0.01) { // 1% de chance
      this.cleanupMessageCache();
    }

    // Verifica se ultrapassou o limite
    return recentMessages.length >= minMessages;
  }

  /**
   * Limpa mensagens antigas do cache
   */
  private cleanupMessageCache(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minuto

    for (const [userId, messages] of this.userMessagesCache.entries()) {
      const recentMessages = messages.filter(msg => now - msg.timestamp <= maxAge);
      if (recentMessages.length === 0) {
        this.userMessagesCache.delete(userId);
      } else {
        this.userMessagesCache.set(userId, recentMessages);
      }
    }
  }

  /**
   * Avalia trigger de CAPS excessivo
   */
  private evaluateCapsTrigger(message: Message, config: Record<string, any>): boolean {
    const maxPercentage = config.maxPercentage || 70;
    const content = message.content;

    if (content.length < 10) {
      return false; // Ignora mensagens muito curtas
    }

    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) {
      return false;
    }

    const upperCase = content.replace(/[^A-Z]/g, '');
    const percentage = (upperCase.length / letters.length) * 100;

    return percentage >= maxPercentage;
  }

  /**
   * Avalia trigger de links
   */
  private evaluateLinksTrigger(message: Message, config: Record<string, any>): boolean {
    const maxLinks = config.maxLinks || 3;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = message.content.match(urlRegex);
    return matches ? matches.length > maxLinks : false;
  }

  /**
   * Avalia trigger de emojis
   */
  private evaluateEmojiTrigger(message: Message, config: Record<string, any>): boolean {
    const maxEmojis = config.maxEmojis || 10;
    const emojiRegex = /<a?:\w+:\d+>|[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const matches = message.content.match(emojiRegex);
    return matches ? matches.length > maxEmojis : false;
  }

  /**
   * Avalia trigger de palavras-chave
   */
  private evaluateKeywordTrigger(message: Message, config: Record<string, any>): boolean {
    const keywords = config.keywords || [];
    const caseSensitive = config.caseSensitive || false;
    const content = caseSensitive ? message.content : message.content.toLowerCase();

    return keywords.some((keyword: string) => {
      const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
      return content.includes(searchKeyword);
    });
  }

  /**
   * Executa todas as ações de uma regra
   */
  private async executeActions(message: Message, rule: CachedRule): Promise<void> {
    const results = [];

    // Ordena ações por ordem configurada
    let sortedActions = [...rule.actions].sort((a, b) => a.order - b.order);

    // Ordenação automática: garante que mensagens sejam enviadas antes de ações destrutivas
    sortedActions = this.reorderActionsForSafety(sortedActions);

    for (const action of sortedActions) {
      try {
        const result = await this.executeAction(message, action.actionType, action.actionConfig);
        results.push({
          actionType: action.actionType,
          success: result.success,
          error: result.error,
          config: action.actionConfig,
        });
      } catch (error) {
        console.error(`[ModerationService] Error executing action ${action.actionType}:`, error);
        results.push({
          actionType: action.actionType,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          config: action.actionConfig,
        });
      }
    }

    // Reporta ao backend
    console.log(`[ModerationService] Reporting ${results.length} action results to backend for rule: ${rule.id}`);
    await this.reportToBackend(message, rule, results);
  }

  /**
   * Reordena ações para garantir segurança na execução
   * Garante que DMs sejam enviadas antes de BAN/KICK (que removem o usuário do servidor)
   */
  private reorderActionsForSafety(actions: any[]): any[] {
    const messagingActions = ['SEND_DM', 'SEND_LOG_MESSAGE'];
    const destructiveActions = ['BAN', 'KICK'];

    // Separa as ações em grupos
    const messaging = actions.filter(a => messagingActions.includes(a.actionType));
    const destructive = actions.filter(a => destructiveActions.includes(a.actionType));
    const other = actions.filter(a =>
      !messagingActions.includes(a.actionType) &&
      !destructiveActions.includes(a.actionType)
    );

    // Retorna na ordem: messaging → other → destructive
    return [...messaging, ...other, ...destructive];
  }

  /**
   * Executa uma ação específica
   */
  private async executeAction(
    message: Message,
    actionType: string,
    actionConfig: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (actionType) {
        case 'DELETE_MESSAGE':
          await message.delete();
          return { success: true };

        case 'TIMEOUT':
          if (message.member) {
            const durationInSeconds = actionConfig.duration || 300; // 5 minutos padrão em segundos
            const durationInMs = durationInSeconds * 1000; // Converte para milissegundos
            const reason = actionConfig.reason || 'Violação de regra de moderação';

            // Envia DM antes de aplicar timeout, se configurado
            if (actionConfig.dmMessage) {
              try {
                await message.author.send(actionConfig.dmMessage);
              } catch (error) {
                console.warn('[ModerationService] Could not send DM before timeout (user may have DMs disabled)');
              }
            }

            await message.member.timeout(durationInMs, reason);
            return { success: true };
          }
          return { success: false, error: 'Member not found' };

        case 'BAN':
          if (message.member) {
            const reason = actionConfig.reason || 'Violação de regra de moderação';

            // Envia DM antes de banir, se configurado
            if (actionConfig.dmMessage) {
              try {
                await message.author.send(actionConfig.dmMessage);
              } catch (error) {
                console.warn('[ModerationService] Could not send DM before ban (user may have DMs disabled)');
              }
            }

            await message.member.ban({ reason });
            return { success: true };
          }
          return { success: false, error: 'Member not found' };

        case 'KICK':
          if (message.member) {
            const reason = actionConfig.reason || 'Violação de regra de moderação';
            await message.member.kick(reason);
            return { success: true };
          }
          return { success: false, error: 'Member not found' };

        case 'SEND_DM':
          try {
            const dmMessage = actionConfig.message || 'Você violou uma regra de moderação.';
            await message.author.send(dmMessage);
            return { success: true };
          } catch (error) {
            return { success: false, error: 'Could not send DM (user may have DMs disabled)' };
          }

        case 'SEND_LOG_MESSAGE':
          try {
            if (!actionConfig.channelId) {
              return { success: false, error: 'Channel ID not configured' };
            }

            const logChannel = await message.guild?.channels.fetch(actionConfig.channelId);

            if (!logChannel || !(logChannel instanceof TextChannel)) {
              return { success: false, error: 'Log channel not found or not a text channel' };
            }

            // Cria embed com informações da violação
            const embed = new EmbedBuilder()
              .setColor(0xFF0000) // Vermelho
              .setTitle('🚨 Regra de Moderação Acionada')
              .setDescription(`Usuário violou uma regra de moderação automática`)
              .addFields(
                { name: 'Usuário', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
              )
              .setTimestamp();

            // Adiciona conteúdo da mensagem se existir
            if (message.content) {
              embed.addFields({
                name: 'Mensagem',
                value: message.content.length > 1024
                  ? message.content.substring(0, 1021) + '...'
                  : message.content,
              });
            }

            // Adiciona anexos se existirem
            if (message.attachments.size > 0) {
              embed.addFields({
                name: 'Anexos',
                value: Array.from(message.attachments.values())
                  .map(att => `[${att.name}](${att.url})`)
                  .join('\n'),
              });
            }

            await logChannel.send({ embeds: [embed] });
            return { success: true };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to send log message',
            };
          }

        case 'ADD_ROLE':
          if (message.member && actionConfig.roleId) {
            await message.member.roles.add(actionConfig.roleId);
            return { success: true };
          }
          return { success: false, error: 'Member or roleId not found' };

        case 'REMOVE_ROLE':
          if (message.member && actionConfig.roleId) {
            await message.member.roles.remove(actionConfig.roleId);
            return { success: true };
          }
          return { success: false, error: 'Member or roleId not found' };

        case 'LOG_ONLY':
          // Apenas registra no backend, sem ação no Discord
          return { success: true };

        default:
          console.warn(`[ModerationService] Unknown action type: ${actionType}`);
          return { success: false, error: 'Unknown action type' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reporta a execução da regra ao backend
   */
  private async reportToBackend(
    message: Message,
    rule: CachedRule,
    actionResults: Array<{ actionType: string; success: boolean; error?: string; config?: Record<string, any> }>
  ): Promise<void> {
    try {
      const logData = {
        ruleId: rule.id,
        guildId: message.guild?.id || '',
        targetUserId: message.author.id,
        targetUserTag: message.author.tag,
        channelId: message.channel.id,
        messageId: message.id,
        messageContent: message.content,
        messageAttachments: Array.from(message.attachments.values()).map(att => ({
          url: att.url,
          name: att.name,
          contentType: att.contentType,
        })),
        actionResults,
        triggeredAt: new Date().toISOString(),
      };

      console.log(`[ModerationService] Sending log to backend:`, {
        url: `${this.backendApiUrl}/api/moderation/internal/logs`,
        ruleId: logData.ruleId,
        guildId: logData.guildId,
        actionCount: logData.actionResults.length,
      });

      await axios.post(
        `${this.backendApiUrl}/api/moderation/internal/logs`,
        logData,
        {
          headers: {
            'x-api-key': this.backendApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      this.reportSuccessCount++;
      console.log(`[ModerationService] Reported rule execution to backend: ${rule.id}`);
    } catch (error: any) {
      this.reportFailureCount++;

      const errorDetails = {
        timestamp: new Date().toISOString(),
        error: error.message,
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          url: `${this.backendApiUrl}/api/moderation/internal/logs`,
        },
      };

      // Adiciona erro à lista (máximo 20)
      this.reportErrors.unshift(errorDetails);
      if (this.reportErrors.length > this.MAX_ERRORS) {
        this.reportErrors.pop();
      }

      console.error('[ModerationService] Failed to report to backend:', errorDetails);
    }
  }
}

// Singleton
export const moderationService = new ModerationService();
