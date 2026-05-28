import { CsatFeedback } from './skylabClient';
import { formatBRDateTime } from './dateLogic';
import { isLike, ratingLabel } from './ratingLogic';

/**
 * Formata um único feedback como mensagem do Slack (mrkdwn).
 *
 * Exemplo de saída:
 *
 *   *Avaliação:* :+1: Curtiu
 *   *Data:* 19/05/2026 14:30
 *   *Aula:* React Hooks Avançado
 *   *Módulo:* Modulo XYZ
 *   *Cluster:* Frontend
 *   *Motivos:* Conteúdo bem estruturado
 *   *Aluno:* João da Silva
 *
 *   > Comentário do aluno aqui
 */
export function formatFeedbackMessage(feedback: CsatFeedback): string {
  const lines: string[] = [];
  lines.push(`*Avaliação:* ${ratingLabel(isLike(feedback.stars))}`);
  lines.push(`*Data:* ${formatBRDateTime(feedback.createdAt)}`);
  lines.push(`*Aula:* ${feedback.lessonTitle}`);
  if (feedback.moduleTitle) lines.push(`*Módulo:* ${feedback.moduleTitle}`);
  if (feedback.clusterTitle) lines.push(`*Cluster:* ${feedback.clusterTitle}`);
  if (feedback.journeyTitle) lines.push(`*Curso:* ${feedback.journeyTitle}`);
  if (feedback.reasons) lines.push(`*Motivos:* ${feedback.reasons}`);
  lines.push(`*Aluno:* ${feedback.studentName}`);
  lines.push('');
  const quoted = feedback.comment
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  lines.push(quoted);
  return lines.join('\n');
}
