import { Events, ThreadChannel } from "discord.js";
import { extractThreadContent, combineForEmbedding } from "../../services/reports/utils/textExtractor";
import { findSimilarReports } from "../../services/reports/embeddingService";

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

      console.log(`[ThreadCreate] Searching similar reports for: ${combinedText.substring(0, 100)}...`);

      const similarReports = await findSimilarReports(combinedText, thread.id);

      if (similarReports.length > 0) {
        console.log(`[ThreadCreate] Found ${similarReports.length} similar reports:`);
        similarReports.forEach((report, i) => {
          console.log(`  ${i + 1}. ${report.title} (${(report.similarity * 100).toFixed(1)}% similar)`);
        });
      } else {
        console.log(`[ThreadCreate] No similar reports found`);
      }

    } catch (error) {
      console.error(`[ThreadCreate] Error processing thread ${thread.id}:`, error);
    }
  },
};
