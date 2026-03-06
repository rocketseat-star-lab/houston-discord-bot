import { Events } from "discord.js";

const THREAD_CREATE_DELAY = 2000;

export default {
  name: Events.ThreadCreate,
  async execute(thread: any) {
    console.log('Oi, im here')
  },
};
