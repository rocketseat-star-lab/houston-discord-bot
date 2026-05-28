import { CsatFeedback } from './skylabClient';
import { formatBRDateTime } from './dateLogic';
import { isLike, ratingLabel } from './ratingLogic';

/**
 * Campos disponiveis pra montar a mensagem de cada feedback no Slack.
 *
 * O time de educacao controla pelo painel:
 *   - ordem dos campos
 *   - quais ficam visiveis (`enabled`)
 *   - o rotulo exibido (`label`)
 *
 * O comentario do aluno fica fixo no final como blockquote — nao entra
 * nessa lista porque a formatacao dele e diferente (multi-linha, sem
 * rotulo) e o time concordou que faz mais sentido sempre no fim.
 */

export type MessageFieldKey =
  | 'rating'
  | 'date'
  | 'lessonTitle'
  | 'moduleTitle'
  | 'clusterTitle'
  | 'journeyTitle'
  | 'reasons'
  | 'studentName';

export interface MessageField {
  key: MessageFieldKey;
  label: string;
  enabled: boolean;
}

/**
 * Default usado quando a config no Tools nao tem `messageFields` setado
 * (ou tem um array invalido). Reproduz o formato historico do bot.
 */
export const DEFAULT_MESSAGE_FIELDS: MessageField[] = [
  { key: 'rating', label: 'Avaliação', enabled: true },
  { key: 'date', label: 'Data', enabled: true },
  { key: 'lessonTitle', label: 'Aula', enabled: true },
  { key: 'moduleTitle', label: 'Módulo', enabled: true },
  { key: 'clusterTitle', label: 'Cluster', enabled: true },
  { key: 'journeyTitle', label: 'Curso', enabled: true },
  { key: 'reasons', label: 'Motivos', enabled: true },
  { key: 'studentName', label: 'Aluno', enabled: true },
];

const ALLOWED_KEYS: ReadonlySet<MessageFieldKey> = new Set(
  DEFAULT_MESSAGE_FIELDS.map((f) => f.key)
);

/**
 * Faz parse/validacao do JSON vindo da config. Defensivo: ignora chaves
 * desconhecidas (ex: campo removido em uma versao futura) e completa
 * com as keys do default que faltarem, mantendo enabled=false (assim
 * features novas nao aparecem sem o time aprovar explicitamente).
 */
export function normalizeMessageFields(raw: unknown): MessageField[] {
  if (!Array.isArray(raw)) return DEFAULT_MESSAGE_FIELDS;

  const valid: MessageField[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const key = obj.key;
    if (typeof key !== 'string' || !ALLOWED_KEYS.has(key as MessageFieldKey)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = typeof obj.label === 'string' && obj.label.trim()
      ? obj.label.trim()
      : DEFAULT_MESSAGE_FIELDS.find((f) => f.key === key)!.label;
    const enabled = obj.enabled !== false; // default true
    valid.push({ key: key as MessageFieldKey, label, enabled });
  }

  // Completa com defaults pras chaves que faltarem (mas desabilitadas).
  for (const def of DEFAULT_MESSAGE_FIELDS) {
    if (!seen.has(def.key)) {
      valid.push({ ...def, enabled: false });
    }
  }

  return valid;
}

/**
 * Extrai o valor do feedback pra uma key. Retorna null quando o feedback
 * nao tem o dado preenchido — assim o renderer pula a linha em vez de
 * mostrar "*Cluster:* null".
 */
export function getFieldValue(key: MessageFieldKey, feedback: CsatFeedback): string | null {
  switch (key) {
    case 'rating':
      return ratingLabel(isLike(feedback.stars));
    case 'date':
      return formatBRDateTime(feedback.createdAt);
    case 'lessonTitle':
      return feedback.lessonTitle || null;
    case 'moduleTitle':
      return feedback.moduleTitle || null;
    case 'clusterTitle':
      return feedback.clusterTitle || null;
    case 'journeyTitle':
      return feedback.journeyTitle || null;
    case 'reasons':
      return feedback.reasons || null;
    case 'studentName':
      return feedback.studentName || null;
    default:
      return null;
  }
}
