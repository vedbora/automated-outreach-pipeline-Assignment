import { Contact, ResolvedContact } from '../models/contact';

export function dedupeDomains(domains: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const domain of domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function dedupeContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  const result: Contact[] = [];

  for (const contact of contacts) {
    const linkedinKey = contact.linkedinUrl.trim().toLowerCase();
    const personKey = contact.personId?.trim();
    const fallbackKey = `${contact.fullName.trim().toLowerCase()}::${contact.companyDomain.trim().toLowerCase()}`;
    const key = personKey || linkedinKey || fallbackKey;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(contact);
  }

  return result;
}

export function dedupeResolvedContacts(contacts: ResolvedContact[]): ResolvedContact[] {
  const seen = new Set<string>();
  const result: ResolvedContact[] = [];

  for (const contact of contacts) {
    const emailKey = contact.email.trim().toLowerCase();
    const linkedinKey = contact.linkedinUrl.trim().toLowerCase();
    const key = emailKey || linkedinKey;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(contact);
  }

  return result;
}

export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return 'there';
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function formatCompanyName(domain: string): string {
  const label = domain.split('.')[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
