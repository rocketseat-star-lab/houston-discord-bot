import { CELEBRATIONS_CONFIG } from '../config';
import { dayOfDate, monthAbbrOfDate, formatBR, yearsOnCompany } from './dateLogic';

export type Company = 'ROCKETSEAT' | 'DIGITAL_HOUSE';

export function birthdayImageUrl(opts: {
  fullName: string;
  avatarUrl: string;
  birthdayDate: Date;
  company: Company;
}): string {
  const url = new URL('/api/images/birthday', CELEBRATIONS_CONFIG.imageGeneratorUrl);
  url.searchParams.set('name', opts.fullName);
  url.searchParams.set('avatar_url', opts.avatarUrl);
  url.searchParams.set('day', dayOfDate(opts.birthdayDate));
  url.searchParams.set('month', monthAbbrOfDate(opts.birthdayDate));
  url.searchParams.set('company', opts.company);
  return url.toString();
}

export function companyAnniversaryImageUrl(opts: {
  fullName: string;
  avatarUrl: string;
  admissionDate: Date;
  today?: Date;
  company: Company;
}): string {
  const url = new URL('/api/images/company-anniversary', CELEBRATIONS_CONFIG.imageGeneratorUrl);
  url.searchParams.set('name', opts.fullName);
  url.searchParams.set('avatar_url', opts.avatarUrl);
  url.searchParams.set('date', formatBR(opts.admissionDate));
  url.searchParams.set(
    'years',
    String(yearsOnCompany(opts.admissionDate, opts.today || new Date()))
  );
  url.searchParams.set('company', opts.company);
  return url.toString();
}
