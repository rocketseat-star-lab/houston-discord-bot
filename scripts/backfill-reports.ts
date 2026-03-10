import { Client, GatewayIntentBits, ThreadChannel, ChannelType, Channel } from "discord.js";
import { config } from "dotenv";
import { extractThreadContent, combineForEmbedding, combineForEmbeddingSummary } from "../src/services/reports/utils/textExtractor";
import { analyzeThreadForSolution, summarizeThread } from "../src/services/reports/aiService";
import { createReport, reportExists } from "../src/services/reports/reportService";
import { createReportEmbedding } from "../src/services/reports/embeddingService";
import { ReportCategory } from "@prisma/client";

config();

const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;
const CHECKMARK_EMOJI = "✅";
const DELAY_BETWEEN_THREADS = 2000; // 2 seconds
const MONTHS_TO_BACKFILL = 6;

async function fetchAllThreadMessages(thread: ThreadChannel): Promise<string> {
  const messages: string[] = [];
  let lastId: string | undefined;

  while (true) {
    const fetched = await thread.messages.fetch({
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

async function processThread(thread: ThreadChannel): Promise<boolean> {
  try {
    // Check if already exists
    const exists = await reportExists(thread.id);
    if (exists) {
      console.log(`  ⏭️  Skipping (already exists): "${thread.name}"`);
      return false;
    }

    console.log(`  📄 Processing: "${thread.name}"`);

    // Extract content
    const content = await extractThreadContent(thread);

    // Fetch all messages
    const allMessages = await fetchAllThreadMessages(thread);
    if (!allMessages.trim()) {
      console.log(`  ⚠️  No messages found, skipping`);
      return false;
    }

    // Analyze with AI
    console.log(`  🤖 Analyzing with GPT-4...`);
    const analysis = await analyzeThreadForSolution(allMessages);

    // Get starter message author
    const starterMessage = await thread.fetchStarterMessage();
    const userId = starterMessage?.author?.id || "unknown";

    // Create report
    const report = await createReport({
      discordThreadId: thread.id,
      discordUserId: userId,
      title: content.title.replace(CHECKMARK_EMOJI, "").trim(),
      description: content.description,
      solution: analysis.solution,
      category: analysis.category.toUpperCase() as ReportCategory,
      resolvedAt: thread.archiveTimestamp ? new Date(thread.archiveTimestamp) : new Date(),
    });

    console.log(`  💾 Report created: ID=${report.id}, Category=${report.category}`);

    // Generate summary and embedding
    let embeddingText: string;
    try {
      console.log(`  🤖 Generating summary...`);
      const summary = await summarizeThread(allMessages);
      embeddingText = combineForEmbeddingSummary(content.title, summary);
    } catch (error) {
      console.log(`  ⚠️  Summary failed, using title+description`);
      embeddingText = combineForEmbedding(content.title, content.description);
    }

    console.log(`  🔢 Creating embedding...`);
    await createReportEmbedding(report.id, embeddingText);

    console.log(`  ✅ Successfully processed: "${thread.name}"`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error processing thread "${thread.name}":`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting report backfill...\n");

  // Initialize Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
  console.log("✅ Bot logged in\n");

  // Get forum channel
  const forumChannel = await client.channels.fetch(REPORT_FORUM_CHANNEL_ID!) as any;

  if (!forumChannel) {
    throw new Error(`Channel ${REPORT_FORUM_CHANNEL_ID} is not a forum channel`);
  }

  console.log(`📋 Forum channel: ${forumChannel.name}\n`);

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - MONTHS_TO_BACKFILL);
  console.log(`📅 Processing threads from: ${cutoffDate.toISOString()}\n`);

  // Fetch active threads
  const activeThreads = await forumChannel.threads.fetchActive();
  console.log(`🔍 Found ${activeThreads.threads.size} active threads`);

  // Fetch archived threads (paginated)
  const archivedThreads: ThreadChannel[] = [];
  let hasMore = true;
  let before: string | undefined;

  while (hasMore) {
    const archived = await forumChannel.threads.fetchArchived({ limit: 100, before });
    archivedThreads.push(...archived.threads.values());

    if (archived.threads.size < 100 || !archived.hasMore) {
      hasMore = false;
    } else {
      before = archived.threads.last()?.id;
    }
  }

  console.log(`🔍 Found ${archivedThreads.length} archived threads`);

  // Combine all threads
  const allThreads = [
    ...activeThreads.threads.values(),
    ...archivedThreads,
  ];

  // Filter: resolved (✅) and within date range
  const resolvedThreads = allThreads.filter((thread) => {
    const hasCheckmark = thread.name.includes(CHECKMARK_EMOJI);
    const createdAt = thread.createdAt || new Date();
    const withinRange = createdAt >= cutoffDate;
    return hasCheckmark && withinRange;
  });

  console.log(`✅ Found ${resolvedThreads.length} resolved threads to process\n`);

  if (resolvedThreads.length === 0) {
    console.log("No threads to process. Exiting.");
    await client.destroy();
    return;
  }

  // Process each thread
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < resolvedThreads.length; i++) {
    const thread = resolvedThreads[i];
    console.log(`\n[${i + 1}/${resolvedThreads.length}] Thread: "${thread.name}"`);

    const success = await processThread(thread);
    if (success) {
      processed++;
    } else if (await reportExists(thread.id)) {
      skipped++;
    } else {
      errors++;
    }

    // Rate limiting delay
    if (i < resolvedThreads.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_THREADS));
    }
  }

  console.log(`\n\n📊 Backfill Summary:`);
  console.log(`   Total resolved threads found: ${resolvedThreads.length}`);
  console.log(`   Successfully processed: ${processed}`);
  console.log(`   Skipped (already exist): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n✅ Backfill complete!`);

  await client.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
