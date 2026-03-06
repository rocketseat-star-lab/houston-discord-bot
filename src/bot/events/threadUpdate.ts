import { Events } from "discord.js";

const CHECKMARK_EMOJI = "✅";

export default {
  name: Events.ThreadUpdate,
  async execute(thread: any) {
    console.log('Oi, im here')
  },
};
