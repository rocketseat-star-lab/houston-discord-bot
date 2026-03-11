import { ThreadChannel, ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } from "discord.js";
import { SimilarReport } from "./embeddingService";

const CHECKMARK_EMOJI = "✅";

export async function sendSimilarReportsSuggestion(
  thread: ThreadChannel,
  reports: SimilarReport[]
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🤖 Reports similares encontrados")
    .setDescription("Encontrei reports que podem ajudar com seu problema:")
    .setColor(0x5865F2);

  // Limit to top 3 reports to avoid Discord embed field character limit (1024 chars)
  const topReports = reports.slice(0, 3);

  let reportsText = "";
  topReports.forEach((report, index) => {
    const status = report.solution ? "✅ Resolvido" : "⏳ Em aberto";
    const similarity = Math.round(report.similarity * 100);
    const link = `https://discord.com/channels/${thread.guildId}/${report.discordThreadId}`;

    reportsText += `${index + 1}. **${report.title}** (${similarity}% similar)\n`;
    reportsText += `   ${status} - [Ver thread](${link})\n\n`;
  });

  embed.addFields({
    name: "Reports encontrados",
    value: reportsText || "Nenhum report similar encontrado",
  });

  embed.setFooter({
    text: "Algum desses reports resolve seu problema?",
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("similar_yes")
      .setLabel("Sim, resolveu!")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("similar_no")
      .setLabel("Não, ainda preciso de ajuda")
      .setStyle(ButtonStyle.Danger)
  );

  await thread.send({
    embeds: [embed],
    components: [row],
  });
}

export async function sendNoSimilarReportsMessage(thread: ThreadChannel): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🤖 Nenhum report similar encontrado")
    .setDescription(
      "Não encontrei reports similares para seu problema.\n\n" +
        "Continue descrevendo seu relatório com detalhes para que a equipe possa ajudar melhor!"
    )
    .setColor(0xFFA500)
    .setFooter({
      text: "💡 Dica: Quanto mais informações você fornecer, mais rápida será a resolução.",
    });

  await thread.send({ embeds: [embed] });
}

export async function confirmDocumentation(thread: ThreadChannel): Promise<void> {
  const starterMessage = await thread.fetchStarterMessage();
  if (starterMessage) {
    await starterMessage.react(CHECKMARK_EMOJI);
  }
}
