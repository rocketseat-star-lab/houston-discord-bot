import { BoosterDTO } from './toolsClient';
import { yearsOnCompany } from './dateLogic';

export interface ResolvedBooster extends BoosterDTO {
  slack_user_id: string;
}

export const COMPANY_DISPLAY_NAMES: Record<string, string> = {
  ROCKETSEAT: 'Rocketseat',
  DIGITAL_HOUSE: 'Digital House',
};

function companyName(code: string): string {
  return COMPANY_DISPLAY_NAMES[code] || code;
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

function joinMentionsEs(boosters: ResolvedBooster[]): string {
  const mentions = boosters.map(mention);
  if (mentions.length === 1) return mentions[0];
  if (mentions.length === 2) return `${mentions[0]} y ${mentions[1]}`;
  return `${mentions.slice(0, -1).join(', ')} y ${mentions[mentions.length - 1]}`;
}

function allSameGender(boosters: ResolvedBooster[], gender: 'MALE' | 'FEMALE'): boolean {
  return boosters.every((b) => b.gender === gender);
}

// =====================================================================
// PT-BR
// =====================================================================

function birthdayMessagePT(boosters: ResolvedBooster[]): string {
  if (boosters.length === 1) {
    const b = boosters[0];
    const article = b.gender === 'FEMALE' ? 'a' : 'o';
    return [
      `Vamos celebrar ${article} aniversariante do dia: ${mention(b)}!`,
      'Que este novo ciclo seja cheio de realizações e alegrias.',
      'Parabéns e feliz aniversário! 💜🚀',
    ].join('\n');
  }
  const article = allSameGender(boosters, 'FEMALE') ? 'as' : 'os';
  return [
    `Vamos celebrar ${article} aniversariantes do dia: ${joinMentions(boosters)}!`,
    'Que este novo ciclo seja cheio de realizações e alegrias.',
    'Parabéns e feliz aniversário! 💜🚀',
  ].join('\n');
}

function anniversaryMessagePT(boosters: ResolvedBooster[], today: Date, companyCode: string): string {
  const name = companyName(companyCode);
  if (boosters.length === 1) {
    const b = boosters[0];
    const years = yearsOnCompany(b.admission_date!, today);
    const articleSubject = b.gender === 'FEMALE' ? 'a' : 'o';
    const articleProf = b.gender === 'FEMALE' ? 'uma' : 'um';
    return [
      `Hoje ${articleSubject} ${mention(b)} completa ${years} ${years === 1 ? 'ano' : 'anos'} de ${name}!`,
      `Parabéns! É uma alegria poder contar com ${articleProf} profissional como você.`,
      '💜',
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
    `Hoje completam tempo de ${name}: ${list}!`,
    'Parabéns! É uma alegria poder contar com profissionais como vocês.',
    '💜',
  ].join('\n');
}

// =====================================================================
// ES (neutro, com "vos" argentino quando aplicável)
// =====================================================================

function birthdayMessageES(boosters: ResolvedBooster[]): string {
  if (boosters.length === 1) {
    const b = boosters[0];
    const article = b.gender === 'FEMALE' ? 'la cumpleañera' : 'al cumpleañero';
    return [
      `¡Vamos a celebrar ${article} del día: ${mention(b)}!`,
      'Que este nuevo ciclo esté lleno de logros y alegrías.',
      '¡Feliz cumpleaños! 💜🚀',
    ].join('\n');
  }
  const article = allSameGender(boosters, 'FEMALE') ? 'a las cumpleañeras' : 'a los cumpleañeros';
  return [
    `¡Vamos a celebrar ${article} del día: ${joinMentionsEs(boosters)}!`,
    'Que este nuevo ciclo esté lleno de logros y alegrías.',
    '¡Feliz cumpleaños! 💜🚀',
  ].join('\n');
}

function anniversaryMessageES(boosters: ResolvedBooster[], today: Date, companyCode: string): string {
  const name = companyName(companyCode);
  if (boosters.length === 1) {
    const b = boosters[0];
    const years = yearsOnCompany(b.admission_date!, today);
    const articleProf = b.gender === 'FEMALE' ? 'una' : 'un';
    return [
      `¡Hoy ${mention(b)} cumple ${years} ${years === 1 ? 'año' : 'años'} en ${name}!`,
      `¡Felicitaciones! Es una alegría contar con ${articleProf} profesional como vos.`,
      '💜',
    ].join('\n');
  }
  const list = boosters
    .map((b) => {
      const years = yearsOnCompany(b.admission_date!, today);
      return `${mention(b)} (${years} ${years === 1 ? 'año' : 'años'})`;
    })
    .join(', ')
    .replace(/, ([^,]+)$/, ' y $1');
  return [
    `¡Hoy cumplen tiempo en ${name}: ${list}!`,
    '¡Felicitaciones! Es una alegría contar con profesionales como ustedes.',
    '💜',
  ].join('\n');
}

// =====================================================================
// Composição final bilíngue
// =====================================================================

function bilingual(emoji: string, pt: string, es: string): string {
  return `${emoji} 🇧🇷 ${pt}\n\n${emoji} 🇦🇷 ${es}`;
}

export function birthdayMessage(boosters: ResolvedBooster[]): string {
  if (boosters.length === 0) return '';
  return bilingual('🎉', birthdayMessagePT(boosters), birthdayMessageES(boosters));
}

export function companyAnniversaryMessage(
  boosters: ResolvedBooster[],
  today: Date = new Date()
): string {
  if (boosters.length === 0) return '';
  // All boosters in a single message should be from the same company
  // (dispatcher groups by company before calling this).
  const companyCode = boosters[0].company;
  return bilingual(
    '🚀',
    anniversaryMessagePT(boosters, today, companyCode),
    anniversaryMessageES(boosters, today, companyCode)
  );
}
