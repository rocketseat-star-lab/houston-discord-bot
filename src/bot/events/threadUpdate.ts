import { Events, ThreadChannel } from "discord.js";
import { extractThreadContent, combineForEmbedding } from "../../services/reports/utils/textExtractor";

const CHECKMARK_EMOJI = "✅";
const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;

export default {
  name: Events.ThreadUpdate,
  async execute(oldThread: ThreadChannel, newThread: ThreadChannel) {
    try {
      if (newThread.parentId !== REPORT_FORUM_CHANNEL_ID) {
        return;
      }

      const hadCheckmark = oldThread.name.includes(CHECKMARK_EMOJI);
      const hasCheckmark = newThread.name.includes(CHECKMARK_EMOJI);

      console.log(`[ThreadUpdate] Thread updated: ${newThread.name} (${newThread.id})`);

      if (!hadCheckmark && hasCheckmark) {
        console.log(`[ThreadUpdate] Thread marked as resolved! Extracting content...`);

        const content = await extractThreadContent(newThread);
        const combinedText = combineForEmbedding(content.title, content.description);
      }
    } catch (error) {
      console.error(`[ThreadUpdate] Error processing thread ${newThread.id}:`, error);
    }
  },
};
