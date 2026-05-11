import { CELEBRATIONS_CONFIG } from '../config';
import { dayOfDate, monthAbbrOfDate, formatBR, yearsOnCompany } from './dateLogic';

export function birthdayImageUrl(opts: {
  fullName: string;
  avatarUrl: string;
  birthdayDate: Date;
}): string {
  const url = new URL('/api/images/birthday', CELEBRATIONS_CONFIG.imageGeneratorUrl);
  url.searchParams.set('name', opts.fullName);
  url.searchParams.set('avatar_url', opts.avatarUrl);
  url.searchParams.set('day', dayOfDate(opts.birthdayDate));
  url.searchParams.set('month', monthAbbrOfDate(opts.birthdayDate));
  return url.toString();
}

export function companyAnniversaryImageUrl(opts: {
  fullName: string;
  avatarUrl: string;
  admissionDate: Date;
  today?: Date;
}): string {
  const url = new URL('/api/images/company-anniversary', CELEBRATIONS_CONFIG.imageGeneratorUrl);
  url.searchParams.set('name', opts.fullName);
  url.searchParams.set('avatar_url', opts.avatarUrl);
  url.searchParams.set('date', formatBR(opts.admissionDate));
  url.searchParams.set(
    'years',
    String(yearsOnCompany(opts.admissionDate, opts.today || new Date()))
  );
  return url.toString();
}
