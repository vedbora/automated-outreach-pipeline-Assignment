export interface Contact {
  personId?: string;
  fullName: string;
  title: string;
  linkedinUrl: string;
  companyDomain: string;
  firstName?: string;
}

export interface ResolvedContact extends Contact {
  email: string;
}

export interface OutreachEmailPayload {
  contact: ResolvedContact;
  subject: string;
  body: string;
}

export interface ProspeoPipelineResult {
  contacts: Contact[];
  enrichedContacts: ResolvedContact[];
}

export interface PipelineSummary {
  companiesFound: number;
  contactsFound: number;
  emailsResolved: number;
}

export interface PipelineResult extends PipelineSummary {
  durationMs: number;
  emailsSent: number;
}

export const TARGET_JOB_TITLES = [
  'CEO',
  'CTO',
  'Founder',
  'Co-Founder',
  'VP Engineering',
  'VP Technology',
  'Director Engineering',
  'Head of Engineering',
  'Head of Technology',
] as const;

export interface ProspeoEmailDetails {
  status?: string | null;
  revealed?: boolean | null;
  email?: string | null;
}

export interface ProspeoPerson {
  person_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  linkedin_url?: string | null;
  current_job_title?: string | null;
  headline?: string | null;
  email?: ProspeoEmailDetails | null;
}

export interface ProspeoCompany {
  website?: string | null;
  name?: string | null;
  domain?: string | null;
}

export interface ProspeoSearchResult {
  person: ProspeoPerson;
  company?: ProspeoCompany | null;
}

export interface ProspeoSearchResponse {
  error: boolean;
  free?: boolean;
  error_code?: string;
  filter_error?: string;
  results?: ProspeoSearchResult[];
  pagination?: {
    current_page: number;
    per_page: number;
    total_page: number;
    total_count: number;
  };
}

export interface ProspeoEnrichResponse {
  error: boolean;
  error_code?: string;
  free_enrichment?: boolean;
  person?: ProspeoPerson | null;
  company?: ProspeoCompany | null;
}
