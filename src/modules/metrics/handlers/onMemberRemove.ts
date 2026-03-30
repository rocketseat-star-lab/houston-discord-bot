import { GuildMember, PartialGuildMember } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import { markMemberLeft, recordLeaveEvent } from '../services/memberService';

export async function onMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  if (!METRICS_CONFIG.allowedGuildIds.includes(member.guild.id)) return;

  try {
    await markMemberLeft(member.guild.id, member.id);
    await recordLeaveEvent(member.guild.id, member.id);
  } catch (error) {
    console.error(`[metrics] Error processing member remove ${member.id}:`, error);
  }
}
