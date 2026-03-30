import { GuildMember } from 'discord.js';
import { METRICS_CONFIG } from '../config';
import { ensureMemberExists, recordJoinEvent } from '../services/memberService';

export async function onMemberAdd(member: GuildMember): Promise<void> {
  if (!METRICS_CONFIG.allowedGuildIds.includes(member.guild.id)) return;

  try {
    await ensureMemberExists(
      member.guild.id,
      member.user.id,
      member.user.username,
      member.user.discriminator || null,
      member.user.bot,
      member.joinedAt || new Date(),
      member.nickname
    );
    await recordJoinEvent(member.guild.id, member.user.id);
  } catch (error) {
    console.error(`[metrics] Error processing member add ${member.user.id}:`, error);
  }
}
