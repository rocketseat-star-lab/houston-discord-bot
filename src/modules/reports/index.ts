import { ThreadChannel, ButtonInteraction, Collection, Message, Events } from 'discord.js';
import { extractThreadContent, combineForEmbedding, combineForEmbeddingSummary } from '../../services/reports/utils/textExtractor';
import { findSimilarReports, createReportEmbedding } from '../../services/reports/embeddingService';
import { sendSimilarReportsSuggestion, sendNoSimilarReportsMessage, confirmDocumentation } from '../../services/reports/discordService';
import { summarizeQuery, analyzeThreadForSolution, summarizeThread } from '../../services/reports/aiService';
import { createReport, updateReportSolution, reportExists } from '../../services/reports/reportService';
import { ReportCategory } from '@prisma/client';
import type { FeatureModule } from '../../core/module';

// Import existing API routes
import forumRoutes from '../../api/routes/forum.routes';

const THREAD_CREATE_DELAY = 2000;
const CHECKMARK_EMOJI = '✅';
const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;

async function onThreadCreate(thread: ThreadChannel): Promise<void> {
  try {
    if (thread.parentId !== REPORT_FORUM_CHANNEL_ID) return;

    console.log(`[reports] New thread: ${thread.name} (${thread.id})`);

    await new Promise(resolve => setTimeout(resolve, THREAD_CREATE_DELAY));

    const content = await extractThreadContent(thread);
    const combinedText = combineForEmbedding(content.title, content.description);

    const similarReports = await findSimilarReports(combinedText, thread.id);

    if (similarReports.length > 0) {
      console.log(`[reports] Found ${similarReports.length} similar reports`);
      await sendSimilarReportsSuggestion(thread, similarReports);
    } else {
      console.log(`[reports] No similar reports found`);
      await sendNoSimilarReportsMessage(thread);
    }
  } catch (error) {
    console.error(`[reports] Error processing thread ${thread.id}:`, error);
  }
}

async function fetchAllThreadMessages(thread: ThreadChannel): Promise<string> {
  const messages: string[] = [];
  let lastId: string | undefined;

  while (true) {
    const fetched: Collection<string, Message<true>> = await thread.messages.fetch({
      limit: 100,
      before: lastId,
    });

    if (fetched.size === 0) break;

    for (const [, message] of fetched) {
      if (!message.system && message.content) {
        messages.push(`${message.author.username}: ${message.content}`);
      }
    }

    lastId = fetched.last()?.id;
    if (!lastId || fetched.size < 100) break;
  }

  return messages.reverse().join('\n');
}

async function onThreadUpdate(oldThread: ThreadChannel, newThread: ThreadChannel): Promise<void> {
  try {
    if (newThread.parentId !== REPORT_FORUM_CHANNEL_ID) return;

    const hadCheckmark = oldThread.name.includes(CHECKMARK_EMOJI);
    const hasCheckmark = newThread.name.includes(CHECKMARK_EMOJI);

    if (!hadCheckmark && hasCheckmark) {
      console.log(`[reports] Thread resolved: ${newThread.name} (${newThread.id})`);

      const content = await extractThreadContent(newThread);
      const allMessages = await fetchAllThreadMessages(newThread);
      const analysis = await analyzeThreadForSolution(allMessages);

      console.log(`[reports] AI Analysis - Category: ${analysis.category}`);

      const exists = await reportExists(newThread.id);
      let report;

      if (exists) {
        report = await updateReportSolution(
          newThread.id,
          analysis.solution,
          analysis.category.toUpperCase() as ReportCategory
        );
      } else {
        const starterMessage = await newThread.fetchStarterMessage();
        report = await createReport({
          discordThreadId: newThread.id,
          discordUserId: starterMessage?.author?.id || 'unknown',
          title: content.title.replace(CHECKMARK_EMOJI, '').trim(),
          description: content.description,
          solution: analysis.solution,
          category: analysis.category.toUpperCase() as ReportCategory,
          resolvedAt: new Date(),
        });
      }

      let embeddingText: string;
      try {
        const summary = await summarizeThread(allMessages);
        embeddingText = combineForEmbeddingSummary(content.title, summary);
      } catch (error) {
        console.warn(`[reports] Failed to summarize, using title+description`);
        embeddingText = combineForEmbedding(content.title, content.description);
      }

      await createReportEmbedding(report.id, embeddingText);
      await confirmDocumentation(newThread);
    }
  } catch (error) {
    console.error(`[reports] Error processing thread ${newThread.id}:`, error);
  }
}

async function onInteraction(interaction: any): Promise<void> {
  if (!interaction.isButton()) return;

  const { customId, message, channel } = interaction;

  if (customId !== 'similar_yes' && customId !== 'similar_no') return;
  if (channel?.type !== 11) return;

  const thread = channel as ThreadChannel;
  if (thread.parentId !== REPORT_FORUM_CHANNEL_ID) return;

  try {
    if (customId === 'similar_yes') {
      const originalEmbed = message.embeds[0];
      const updatedEmbed = {
        ...originalEmbed?.data,
        footer: { text: '✅ Ótimo! Marcando como resolvido.' },
      };

      await message.edit({ embeds: [updatedEmbed], components: [] });
      await interaction.reply({ content: 'Perfeito! Estou marcando este report como resolvido.', ephemeral: true });

      const newName = `${CHECKMARK_EMOJI} ${thread.name}`;
      await thread.setName(newName);
    } else if (customId === 'similar_no') {
      const originalEmbed = message.embeds[0];
      const updatedEmbed = {
        ...originalEmbed?.data,
        footer: { text: '❌ Entendido. Continue descrevendo seu problema e aguarde ajuda da equipe.' },
      };

      await message.edit({ embeds: [updatedEmbed], components: [] });
      await interaction.reply({ content: 'Entendido. Continue descrevendo seu problema.', ephemeral: true });
    }
  } catch (error) {
    try {
      await interaction.reply({ content: '❌ Ocorreu um erro ao processar sua resposta.', ephemeral: true });
    } catch (replyError) {
      console.error(`[reports] Failed to send error reply:`, replyError);
    }
  }
}

export const reportsModule: FeatureModule = {
  name: 'forum-threads',
  description: 'Bug report RAG system with similarity search and auto-documentation',
  handlers: {
    threadCreate: onThreadCreate,
    threadUpdate: onThreadUpdate,
    interactionCreate: onInteraction,
  },
  routes: forumRoutes,
};
