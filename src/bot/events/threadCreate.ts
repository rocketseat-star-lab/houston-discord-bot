import { Events, ThreadChannel } from "discord.js";
import { extractThreadContent, combineForEmbedding } from "../../services/reports/utils/textExtractor";

const THREAD_CREATE_DELAY = 2000;
const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;

export default {
  name: Events.ThreadCreate,
  async execute(thread: ThreadChannel) {
    try {
      if (thread.parentId !== REPORT_FORUM_CHANNEL_ID) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, THREAD_CREATE_DELAY));

      const content = await extractThreadContent(thread);
      const combinedText = combineForEmbedding(content.title, content.description);

    } catch (error) {
      console.error(`[ThreadCreate] Error processing thread ${thread.id}:`, error);
    }
  },
};
