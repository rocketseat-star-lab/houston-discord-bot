import Holidays from 'date-holidays';

const hd = new Holidays('BR');

function isHoliday(date: Date): boolean {
  const result = hd.isHoliday(date) as Array<{ type: string }> | false;
  if (!result || !Array.isArray(result)) return false;
  return result.some((h) => h.type === 'public');
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function isOffDay(date: Date): boolean {
  return isWeekend(date) || isHoliday(date);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Decide o intervalo (from, to) que essa execução deve cobrir.
 * Regra: o cron roda em dias úteis às 08:00 BRT cobrindo os feedbacks
 * gerados nos dias úteis anteriores até o dia útil anterior imediato. Se
 * a sexta foi o último dia útil e tivemos um feriadão até a terça, na
 * terça pegamos sex + sáb + dom + segunda-feriado.
 *
 * Retorna null se hoje é dia não-útil (não deveria postar).
 */
export function getDispatchWindow(now: Date = new Date()): {
  from: Date;
  to: Date;
  label: string;
} | null {
  const today = startOfDay(now);
  if (isOffDay(today)) return null;

  // Vamos voltar dias-úteis encontrando o último dia útil anterior.
  // Depois expandir pra trás enquanto for off-day pra cobrir a sequência.
  let prev = addDays(today, -1);
  // Se hoje é segunda OU teve feriado(s), vamos andando pra trás incluindo
  // todos os off-days até encontrar o último dia útil cuja data já foi
  // coberta. Como o cron roda toda segunda-sexta, o "ultimo já coberto"
  // é o último dia útil que TEM run anterior. Simplificação: incluir do
  // dia útil anterior (inclusive) até o dia anterior (today-1).
  const to = endOfDay(prev);

  // Recua enquanto for off-day (pega weekend + feriados consecutivos antes
  // de today). Para no primeiro dia útil encontrado.
  while (isOffDay(prev)) {
    prev = addDays(prev, -1);
  }
  const from = startOfDay(prev);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const label = from.toDateString() === to.toDateString() ? fmt(from) : `${fmt(from)} a ${fmt(to)}`;

  return { from, to, label };
}

export function formatBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatBRDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatBR(d)} ${hh}:${mm}`;
}
