import { BoosterDTO } from './toolsClient';
import { yearsOnCompany } from './dateLogic';

export interface ResolvedBooster extends BoosterDTO {
  slack_user_id: string;
}

function mention(b: ResolvedBooster): string {
  return `<@${b.slack_user_id}>`;
}

function joinMentions(boosters: ResolvedBooster[]): string {
  const mentions = boosters.map(mention);
  if (mentions.length === 1) return mentions[0];
  if (mentions.length === 2) return `${mentions[0]} e ${mentions[1]}`;
  return `${mentions.slice(0, -1).join(', ')} e ${mentions[mentions.length - 1]}`;
}

function allSameGender(boosters: ResolvedBooster[], gender: 'MALE' | 'FEMALE'): boolean {
  return boosters.every((b) => b.gender === gender);
}

export function birthdayMessage(boosters: ResolvedBooster[]): string {
  if (boosters.length === 0) return '';

  if (boosters.length === 1) {
    const b = boosters[0];
    const article = b.gender === 'FEMALE' ? 'a' : 'o';
    return [
      `🎉 Vamos celebrar ${article} aniversariante do dia: ${mention(b)}!`,
      'Que este novo ciclo seja cheio de realizações e alegrias.',
      'Parabéns e feliz aniversário! 💜🚀',
    ].join('\n');
  }

  const article = allSameGender(boosters, 'FEMALE') ? 'as' : 'os';
  return [
    `🎉 Vamos celebrar ${article} aniversariantes do dia: ${joinMentions(boosters)}!`,
    'Que este novo ciclo seja cheio de realizações e alegrias.',
    'Parabéns e feliz aniversário! 💜🚀',
  ].join('\n');
}

export function companyAnniversaryMessage(boosters: ResolvedBooster[], today: Date = new Date()): string {
  if (boosters.length === 0) return '';

  if (boosters.length === 1) {
    const b = boosters[0];
    const years = yearsOnCompany(b.admission_date!, today);
    const articleSubject = b.gender === 'FEMALE' ? 'a' : 'o';
    const articleProf = b.gender === 'FEMALE' ? 'uma' : 'um';
    return [
      `🚀 Hoje ${articleSubject} ${mention(b)} completa ${years} ${years === 1 ? 'ano' : 'anos'} de Rocketseat!`,
      `Parabéns! É uma alegria poder contar com ${articleProf} profissional como você.`,
      '#JuntosNoPróximoNível 💜',
    ].join('\n');
  }

  const list = boosters
    .map((b) => {
      const years = yearsOnCompany(b.admission_date!, today);
      return `${mention(b)} (${years} ${years === 1 ? 'ano' : 'anos'})`;
    })
    .join(', ')
    .replace(/, ([^,]+)$/, ' e $1');

  return [
    `🚀 Hoje completam tempo de Rocketseat: ${list}!`,
    'Parabéns! É uma alegria poder contar com profissionais como vocês.',
    '#JuntosNoPróximoNível 💜',
  ].join('\n');
}
