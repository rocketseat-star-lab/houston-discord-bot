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

async function dispatchBirthdays(date: Date): Promise<{ celebrated: number }> {
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

  await slackClient.postMessage({
    channel: CELEBRATIONS_CONFIG.slackChannelId,
    text,
    imageUrls,
  });

  return { celebrated: resolved.length };
}

async function dispatchAnniversaries(date: Date, today: Date): Promise<{ celebrated: number }> {
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

  const text = companyAnniversaryMessage(resolved, today);
  const imageUrls = resolved.map((b) =>
    companyAnniversaryImageUrl({
      fullName: b.full_name,
      avatarUrl: b.avatar_url,
      admissionDate: new Date(b.admission_date!),
      today,
    })
  );

  await slackClient.postMessage({
    channel: CELEBRATIONS_CONFIG.slackChannelId,
    text,
    imageUrls,
  });

  return { celebrated: resolved.length };
}

export async function dispatchCelebrations(now: Date = new Date()): Promise<{
  birthdays: number;
  anniversaries: number;
  datesCovered: string[];
}> {
  if (!CELEBRATIONS_CONFIG.slackChannelId) {
    console.warn('[celebrations] SLACK_CELEBRATIONS_CHANNEL_ID nao configurado.');
    return { birthdays: 0, anniversaries: 0, datesCovered: [] };
  }

  const dates = getDatesToCover(now);
  if (dates.length === 0) {
    console.log('[celebrations] Hoje e dia nao util, nada a fazer.');
    return { birthdays: 0, anniversaries: 0, datesCovered: [] };
  }

  let birthdaysCount = 0;
  let anniversariesCount = 0;

  for (const date of dates) {
    try {
      const b = await dispatchBirthdays(date);
      birthdaysCount += b.celebrated;
    } catch (err) {
      console.error(`[celebrations] dispatchBirthdays(${date.toISOString()}) error:`, err);
    }
    try {
      const a = await dispatchAnniversaries(date, now);
      anniversariesCount += a.celebrated;
    } catch (err) {
      console.error(`[celebrations] dispatchAnniversaries(${date.toISOString()}) error:`, err);
    }
  }

  return {
    birthdays: birthdaysCount,
    anniversaries: anniversariesCount,
    datesCovered: dates.map((d) => d.toISOString().slice(0, 10)),
  };
}
