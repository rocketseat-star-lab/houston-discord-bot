import { Client, TextChannel, EmbedBuilder } from 'discord.js';

// Canal de logs fixo
const LOG_CHANNEL_ID = '1460718433133006860';
const LOG_GUILD_ID = '327861810768117763';

type LogLevel = 'info' | 'success' | 'warn' | 'error';

interface LogOptions {
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  level?: LogLevel;
}

const LEVEL_COLORS: Record<LogLevel, number> = {
  info: 0x3498db,    // Azul
  success: 0x2ecc71, // Verde
  warn: 0xf39c12,    // Amarelo
  error: 0xe74c3c,   // Vermelho
};

const LEVEL_EMOJIS: Record<LogLevel, string> = {
  info: 'ℹ️',
  success: '✅',
  warn: '⚠️',
  error: '❌',
};

class DiscordLogger {
  private client: Client | null = null;
  private channel: TextChannel | null = null;
  private ready = false;

  /**
   * Inicializa o logger com o cliente do Discord
   */
  async initialize(client: Client): Promise<void> {
    this.client = client;

    try {
      const channel = await client.channels.fetch(LOG_CHANNEL_ID);

      if (!channel || !channel.isTextBased()) {
        console.error('[DiscordLogger] Canal de logs não encontrado ou não é um canal de texto');
        return;
      }

      this.channel = channel as TextChannel;
      this.ready = true;
      console.log('[DiscordLogger] Inicializado com sucesso');
    } catch (error) {
      console.error('[DiscordLogger] Erro ao inicializar:', error);
    }
  }

  /**
   * Envia um log para o canal do Discord
   */
  async log(options: LogOptions): Promise<void> {
    if (!this.ready || !this.channel) {
      console.warn('[DiscordLogger] Logger não está pronto, log ignorado:', options.title);
      return;
    }

    const level = options.level || 'info';
    const emoji = LEVEL_EMOJIS[level];
    const color = LEVEL_COLORS[level];

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${options.title}`)
      .setColor(color)
      .setTimestamp();

    if (options.description) {
      embed.setDescription(options.description);
    }

    if (options.fields && options.fields.length > 0) {
      embed.addFields(options.fields.map(f => ({
        name: f.name,
        value: f.value.substring(0, 1024), // Discord limit
        inline: f.inline ?? false,
      })));
    }

    try {
      await this.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[DiscordLogger] Erro ao enviar log:', error);
    }
  }

  /**
   * Log de início do bot
   */
  async logStartup(): Promise<void> {
    await this.log({
      title: 'Bot iniciado',
      description: 'Houston foi reiniciado e está operacional.',
      level: 'success',
      fields: [
        { name: 'Ambiente', value: process.env.NODE_ENV || 'development', inline: true },
        { name: 'Horário', value: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), inline: true },
      ],
    });
  }

  /**
   * Log de DM enviada
   */
  async logDmSent(userId: string, preview: string, success: boolean, error?: string): Promise<void> {
    if (success) {
      await this.log({
        title: 'DM enviada',
        level: 'success',
        fields: [
          { name: 'Usuário', value: `<@${userId}>`, inline: true },
          { name: 'Preview', value: preview.substring(0, 200) + (preview.length > 200 ? '...' : ''), inline: false },
        ],
      });
    } else {
      await this.log({
        title: 'Falha ao enviar DM',
        level: 'error',
        fields: [
          { name: 'Usuário', value: `<@${userId}>`, inline: true },
          { name: 'Erro', value: error || 'Erro desconhecido', inline: false },
        ],
      });
    }
  }

  /**
   * Log de thread de fórum criada
   */
  async logForumThreadCreated(
    threadName: string,
    channelId: string,
    threadId: string,
    messageUrl: string
  ): Promise<void> {
    await this.log({
      title: 'Thread de vaga criada',
      level: 'success',
      fields: [
        { name: 'Título', value: threadName, inline: false },
        { name: 'Canal', value: `<#${channelId}>`, inline: true },
        { name: 'Thread', value: `<#${threadId}>`, inline: true },
        { name: 'Link', value: messageUrl, inline: false },
      ],
    });
  }

  /**
   * Log de erro na criação de thread
   */
  async logForumThreadError(
    threadName: string,
    channelId: string,
    error: string,
    discordCode?: number
  ): Promise<void> {
    const fields = [
      { name: 'Título', value: threadName, inline: false },
      { name: 'Canal', value: `<#${channelId}>`, inline: true },
      { name: 'Erro', value: error, inline: false },
    ];

    if (discordCode) {
      fields.push({ name: 'Código Discord', value: discordCode.toString(), inline: true });
    }

    await this.log({
      title: 'Erro ao criar thread de vaga',
      level: 'error',
      fields,
    });
  }

  /**
   * Log de thread fechada
   */
  async logForumThreadClosed(threadId: string, title: string): Promise<void> {
    await this.log({
      title: 'Thread de vaga fechada',
      level: 'info',
      fields: [
        { name: 'Thread', value: `<#${threadId}>`, inline: true },
        { name: 'Título', value: title, inline: false },
      ],
    });
  }

  /**
   * Log genérico de erro
   */
  async logError(context: string, error: any): Promise<void> {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack?.substring(0, 500);

    const fields = [
      { name: 'Contexto', value: context, inline: false },
      { name: 'Mensagem', value: errorMessage, inline: false },
    ];

    if (errorStack) {
      fields.push({ name: 'Stack', value: `\`\`\`${errorStack}\`\`\``, inline: false });
    }

    await this.log({
      title: 'Erro no bot',
      level: 'error',
      fields,
    });
  }
}

// Singleton export
export const discordLogger = new DiscordLogger();
