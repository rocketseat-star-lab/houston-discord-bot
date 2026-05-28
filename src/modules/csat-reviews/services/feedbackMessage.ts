import { CsatFeedback } from './skylabClient';
import {
  DEFAULT_MESSAGE_FIELDS,
  MessageField,
  getFieldValue,
} from './messageFields';

/**
 * Formata um único feedback como mensagem do Slack (mrkdwn).
 *
 * A ordem, visibilidade e rotulo de cada linha sao controlados pelo
 * `fields` (configuravel pelo painel `/education/csat-reviews` do
 * Tools). Quando nao passado, usa o `DEFAULT_MESSAGE_FIELDS`.
 *
 * Exemplo de saída (config default):
 *
 *   *Avaliação:* :+1: Curtiu
 *   *Data:* 19/05/2026 14:30
 *   *Aula:* React Hooks Avançado
 *   *Módulo:* Modulo XYZ
 *   *Cluster:* Frontend
 *   *Curso:* X
 *   *Motivos:* Conteúdo bem estruturado
 *   *Aluno:* João da Silva
 *
 *   > Comentário do aluno aqui
 */
export function formatFeedbackMessage(
  feedback: CsatFeedback,
  fields: MessageField[] = DEFAULT_MESSAGE_FIELDS,
): string {
  const lines: string[] = [];

  for (const field of fields) {
    if (!field.enabled) continue;
    const value = getFieldValue(field.key, feedback);
    if (!value) continue; // pula campos sem valor (ex: cluster null)
    lines.push(`*${field.label}:* ${value}`);
  }

  // Comentario do aluno: sempre no final como blockquote, fora da config.
  lines.push('');
  const quoted = feedback.comment
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  lines.push(quoted);

  return lines.join('\n');
}
