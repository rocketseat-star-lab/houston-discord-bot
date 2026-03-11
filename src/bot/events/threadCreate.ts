import { Events, ThreadChannel } from "discord.js";
import { extractThreadContent, combineForEmbedding } from "../../services/reports/utils/textExtractor";
import { findSimilarReports } from "../../services/reports/embeddingService";
import { sendSimilarReportsSuggestion, sendNoSimilarReportsMessage } from "../../services/reports/discordService";
import { summarizeQuery } from "../../services/reports/aiService";

const THREAD_CREATE_DELAY = 2000;
const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;

export default {
  name: Events.ThreadCreate,
  async execute(thread: ThreadChannel) {
    try {
      if (thread.parentId !== REPORT_FORUM_CHANNEL_ID) {
        return;
      }

      console.log(`[ThreadCreate] New thread: ${thread.name} (${thread.id})`);

      await new Promise(resolve => setTimeout(resolve, THREAD_CREATE_DELAY));

      const content = await extractThreadContent(thread);
      const combinedText = combineForEmbedding(content.title, content.description);

      console.log(`[ThreadCreate] Searching similar reports...`);

      const searchText = combinedText;

      const similarReports = await findSimilarReports(searchText, thread.id);

      if (similarReports.length > 0) {
        console.log(`[ThreadCreate] Found ${similarReports.length} similar reports, sending suggestion...`);
        await sendSimilarReportsSuggestion(thread, similarReports);
      } else {
        console.log(`[ThreadCreate] No similar reports found, sending message...`);
        await sendNoSimilarReportsMessage(thread);
      }

    } catch (error) {
      console.error(`[ThreadCreate] Error processing thread ${thread.id}:`, error);
    }
  },
};
