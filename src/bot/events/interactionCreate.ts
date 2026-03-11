import { Events, ButtonInteraction, ThreadChannel } from "discord.js";

const CHECKMARK_EMOJI = "✅";
const REPORT_FORUM_CHANNEL_ID = process.env.REPORT_FORUM_CHANNEL_ID;

export default {
  name: Events.InteractionCreate,
  async execute(interaction: ButtonInteraction) {

    if (!interaction.isButton()) {
      return;
    }

    const { customId, message, channel } = interaction;

    if (customId !== "similar_yes" && customId !== "similar_no") {
      return;
    }

    if (channel?.type !== 11) {
      return;
    }

    const thread = channel as ThreadChannel;

    if (thread.parentId !== REPORT_FORUM_CHANNEL_ID) {
      return;
    }

    try {
      if (customId === "similar_yes") {

        const originalEmbed = message.embeds[0];

        const updatedEmbed = {
          ...originalEmbed?.data,
          footer: {
            text: "✅ Ótimo! Marcando como resolvido.",
          },
        };

        await message.edit({
          embeds: [updatedEmbed],
          components: [],
        });

        await interaction.reply({
          content: "Perfeito! Estou marcando este report como resolvido.",
          ephemeral: true,
        });

        const newName = `${CHECKMARK_EMOJI} ${thread.name}`;
        await thread.setName(newName);

      } else if (customId === "similar_no") {

        const originalEmbed = message.embeds[0];
        const updatedEmbed = {
          ...originalEmbed?.data,
          footer: {
            text: "❌ Entendido. Continue descrevendo seu problema e aguarde ajuda da equipe.",
          },
        };

        await message.edit({
          embeds: [updatedEmbed],
          components: [],
        });

        await interaction.reply({
          content: "Entendido. Continue descrevendo seu problema.",
          ephemeral: true,
        });
      }
    } catch (error) {
      try {
        await interaction.reply({
          content: "❌ Ocorreu um erro ao processar sua resposta.",
          ephemeral: true,
        });
      } catch (replyError) {
        console.error(`[Interaction] Failed to send error reply:`, replyError);
      }
    }
  },
};
