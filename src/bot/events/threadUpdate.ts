import { Events, ThreadChannel, Collection, Message } from "discord.js";
import { extractThreadContent, combineForEmbedding, combineForEmbeddingSummary } from "../../services/reports/utils/textExtractor";
import { analyzeThreadForSolution, summarizeThread } from "../../services/reports/aiService";
import { createReport, updateReportSolution, reportExists } from "../../services/reports/reportService";
import { createReportEmbedding } from "../../services/reports/embeddingService";
import { confirmDocumentation } from "../../services/reports/discordService";
import { ReportCategory } from "@prisma/client";

const CHECKMARK_EMOJI = "✅";
const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;

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

  return messages.reverse().join("\n");
}

export default {
  name: Events.ThreadUpdate,
  async execute(oldThread: ThreadChannel, newThread: ThreadChannel) {
    try {
      if (newThread.parentId !== REPORT_FORUM_CHANNEL_ID) {
        return;
      }

      const hadCheckmark = oldThread.name.includes(CHECKMARK_EMOJI);
      const hasCheckmark = newThread.name.includes(CHECKMARK_EMOJI);

      if (!hadCheckmark && hasCheckmark) {
        console.log(`[ThreadUpdate] Thread resolved: ${newThread.name} (${newThread.id})`);

        const content = await extractThreadContent(newThread);
        console.log(`[ThreadUpdate] Title: ${content.title}`);

        const allMessages = await fetchAllThreadMessages(newThread);
        console.log(`[ThreadUpdate] Fetched ${allMessages.split("\n").length} messages`);

        const analysis = await analyzeThreadForSolution(allMessages);
        console.log(`[ThreadUpdate] AI Analysis - Category: ${analysis.category}, Problem: ${analysis.problem.substring(0, 50)}...`);

        const exists = await reportExists(newThread.id);
        let report;

        if (exists) {
          report = await updateReportSolution(
            newThread.id,
            analysis.solution,
            analysis.category.toUpperCase() as ReportCategory
          );
          console.log(`[ThreadUpdate] Updated existing report: ${report.id}`);
        } else {
          const starterMessage = await newThread.fetchStarterMessage();
          report = await createReport({
            discordThreadId: newThread.id,
            discordUserId: starterMessage?.author?.id || "unknown",
            title: content.title.replace(CHECKMARK_EMOJI, "").trim(),
            description: content.description,
            solution: analysis.solution,
            category: analysis.category.toUpperCase() as ReportCategory,
            resolvedAt: new Date(),
          });
          console.log(`[ThreadUpdate] Created new report: ${report.id}`);
        }

        let embeddingText: string;
        try {
          const summary = await summarizeThread(allMessages);
          embeddingText = combineForEmbeddingSummary(content.title, summary);
          console.log(`[ThreadUpdate] Generated summary for embedding`);
        } catch (error) {
          console.warn(`[ThreadUpdate] Failed to summarize, using title+description: ${error}`);
          embeddingText = combineForEmbedding(content.title, content.description);
        }

        await createReportEmbedding(report.id, embeddingText);
        console.log(`[ThreadUpdate] Stored embedding for report ${report.id}`);

        await confirmDocumentation(newThread);
        console.log(`[ThreadUpdate] Added checkmark reaction`);
      }
    } catch (error) {
      console.error(`[ThreadUpdate] Error processing thread ${newThread.id}:`, error);
    }
  },
};
