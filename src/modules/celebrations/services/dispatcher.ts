import { CELEBRATIONS_CONFIG } from '../config';
import { BoosterDTO, toolsClient } from './toolsClient';
import { slackClient } from './slackClient';
import { getDatesToCover } from './dateLogic';
import { birthdayMessage, companyAnniversaryMessage, ResolvedBooster } from './celebrationMessage';
import { birthdayImageUrl, companyAnniversaryImageUrl } from './imageUrlBuilder';

interface ResolvedWithAvatar extends ResolvedBooster {
  avatar_url: string;
}

async function resolveSlackIdsAndAvatars(boosters: BoosterDTO[]): Promise<ResolvedWithAvatar[]> {
  const resolved: ResolvedWithAvatar[] = [];

  for (const b of boosters) {
    let slackId = b.slack_user_id;

    if (!slackId) {
      slackId = await slackClient.lookupUserIdByEmail(b.email);
      if (slackId) {
        await toolsClient.updateBoosterSlackId(b.id, slackId);
      } else {
        console.warn(`[celebrations] Booster "${b.full_name}" (${b.email}) sem usuario no Slack.`);
        continue;
      }
    }

    const avatarUrl = await slackClient.getUserImageUrl(slackId);
    if (!avatarUrl) {
      console.warn(`[celebrations] Booster "${b.full_name}" sem avatar no Slack.`);
      continue;
    }

    resolved.push({ ...b, slack_user_id: slackId, avatar_url: avatarUrl });
  }

  return resolved;
}

export interface PreviewedPost {
  kind: 'birthday' | 'anniversary';
  date: string;
  text: string;
  imageUrls: string[];
}

async function dispatchBirthdays(
  date: Date,
  opts: { dryRun: boolean; previews: PreviewedPost[] }
): Promise<{ celebrated: number }> {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const boosters = await toolsClient.findBoosters('birthday', month, day);
  if (boosters.length === 0) return { celebrated: 0 };

  const resolved = await resolveSlackIdsAndAvatars(boosters);
  if (resolved.length === 0) return { celebrated: 0 };

  const text = birthdayMessage(resolved);
  const imageUrls = resolved.map((b) =>
    birthdayImageUrl({
      fullName: b.full_name,
      avatarUrl: b.avatar_url,
      birthdayDate: new Date(b.birthday_date),
    })
  );

  opts.previews.push({
    kind: 'birthday',
    date: date.toISOString().slice(0, 10),
    text,
    imageUrls,
  });

  if (!opts.dryRun) {
    await slackClient.postMessage({
      channel: CELEBRATIONS_CONFIG.slackChannelId,
      text,
      imageUrls,
    });
  }

  return { celebrated: resolved.length };
}

async function dispatchAnniversaries(
  date: Date,
  today: Date,
  opts: { dryRun: boolean; previews: PreviewedPost[] }
): Promise<{ celebrated: number }> {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const boosters = await toolsClient.findBoosters('admission', month, day);
  if (boosters.length === 0) return { celebrated: 0 };

  // Skip year zero (admission today)
  const filtered = boosters.filter((b) => {
    if (!b.admission_date) return false;
    const admYear = new Date(b.admission_date).getUTCFullYear();
    return today.getFullYear() > admYear;
  });
  if (filtered.length === 0) return { celebrated: 0 };

  const resolved = await resolveSlackIdsAndAvatars(filtered);
  if (resolved.length === 0) return { celebrated: 0 };

  // Group by company so each company gets its own message with its own name.
  const byCompany = new Map<string, typeof resolved>();
  for (const b of resolved) {
    const key = b.company || 'ROCKETSEAT';
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(b);
  }

  let total = 0;
  for (const group of byCompany.values()) {
    const text = companyAnniversaryMessage(group, today);
    const imageUrls = group.map((b) =>
      companyAnniversaryImageUrl({
        fullName: b.full_name,
        avatarUrl: b.avatar_url,
        admissionDate: new Date(b.admission_date!),
        today,
      })
    );

    opts.previews.push({
      kind: 'anniversary',
      date: date.toISOString().slice(0, 10),
      text,
      imageUrls,
    });

    if (!opts.dryRun) {
      await slackClient.postMessage({
        channel: CELEBRATIONS_CONFIG.slackChannelId,
        text,
        imageUrls,
      });
    }
    total += group.length;
  }

  return { celebrated: total };
}

export async function dispatchCelebrations(
  now: Date = new Date(),
  options: { dryRun?: boolean } = {}
): Promise<{
  birthdays: number;
  anniversaries: number;
  datesCovered: string[];
  dryRun: boolean;
  previews: PreviewedPost[];
}> {
  const dryRun = options.dryRun ?? CELEBRATIONS_CONFIG.dryRun;
  const previews: PreviewedPost[] = [];

  if (!dryRun && !CELEBRATIONS_CONFIG.slackChannelId) {
    console.warn('[celebrations] SLACK_CELEBRATIONS_CHANNEL_ID nao configurado.');
    return { birthdays: 0, anniversaries: 0, datesCovered: [], dryRun, previews };
  }

  const dates = getDatesToCover(now);
  if (dates.length === 0) {
    console.log('[celebrations] Hoje e dia nao util, nada a fazer.');
    return { birthdays: 0, anniversaries: 0, datesCovered: [], dryRun, previews };
  }

  let birthdaysCount = 0;
  let anniversariesCount = 0;

  for (const date of dates) {
    try {
      const b = await dispatchBirthdays(date, { dryRun, previews });
      birthdaysCount += b.celebrated;
    } catch (err) {
      console.error(`[celebrations] dispatchBirthdays(${date.toISOString()}) error:`, err);
    }
    try {
      const a = await dispatchAnniversaries(date, now, { dryRun, previews });
      anniversariesCount += a.celebrated;
    } catch (err) {
      console.error(`[celebrations] dispatchAnniversaries(${date.toISOString()}) error:`, err);
    }
  }

  return {
    birthdays: birthdaysCount,
    anniversaries: anniversariesCount,
    datesCovered: dates.map((d) => d.toISOString().slice(0, 10)),
    dryRun,
    previews,
  };
}
