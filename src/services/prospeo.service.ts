import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '../config/env';
import {
  Contact,
  ProspeoEnrichResponse,
  ProspeoPipelineResult,
  ProspeoSearchResponse,
  ProspeoSearchResult,
  ResolvedContact,
  TARGET_JOB_TITLES,
} from '../models/contact';
import { dedupeContacts, dedupeResolvedContacts } from '../utils/dedupe';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ProspeoService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.prospeo.io',
      timeout: env.requestTimeoutMs(),
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': env.prospeoApiKey(),
      },
    });
  }

  async findDecisionMakersWithEmails(companyDomains: string[]): Promise<ProspeoPipelineResult> {
    const searchedContacts: Contact[] = [];
    const enrichedContacts: ResolvedContact[] = [];

    for (const companyDomain of companyDomains) {
      try {
        const companyContacts = await this.findDecisionMakersForCompany(companyDomain);
        searchedContacts.push(...companyContacts);

        let enrichedForCompany = 0;
        for (const contact of companyContacts) {
          const enriched = await this.enrichContact(contact);
          if (enriched) {
            enrichedContacts.push(enriched);
            enrichedForCompany += 1;
          }

          await sleep(env.prospeoRequestDelayMs());
        }

        logger.info(
          `Prospeo: found ${companyContacts.length} contacts, ${enrichedForCompany} with verified email at ${companyDomain}`,
        );
      } catch (error) {
        logger.error(`Prospeo: failed for ${companyDomain}`, error);
      }
    }

    const contacts = dedupeContacts(searchedContacts);
    const enriched = dedupeResolvedContacts(enrichedContacts);

    logger.info(
      `Prospeo: total ${contacts.length} decision makers, ${enriched.length} with verified emails`,
    );

    return { contacts, enrichedContacts: enriched };
  }

  private async findDecisionMakersForCompany(companyDomain: string): Promise<Contact[]> {
    const contacts: Contact[] = [];
    const maxPages = env.prospeoMaxPagesPerCompany();

    for (let page = 1; page <= maxPages; page += 1) {
      let response: ProspeoSearchResponse;

      try {
        response = await withRetry(
          () => this.searchPeople(companyDomain, page),
          {
            maxRetries: env.requestMaxRetries(),
            baseDelayMs: env.requestBaseDelayMs(),
            label: `Prospeo search (${companyDomain}, page ${page})`,
          },
        );
      } catch (error) {
        const prospeoError = this.parseProspeoError(error);
        if (prospeoError?.error_code === 'NO_RESULTS') {
          logger.debug(`Prospeo: no decision makers found at ${companyDomain}`);
          break;
        }

        logger.error(
          `Prospeo search failed for ${companyDomain} page ${page}`,
          prospeoError ?? error,
        );
        break;
      }

      if (response.error) {
        if (response.error_code === 'NO_RESULTS') {
          break;
        }

        logger.warn(`Prospeo error for ${companyDomain}`, {
          errorCode: response.error_code,
          filterError: response.filter_error,
        });
        break;
      }

      const pageContacts = (response.results ?? [])
        .map((result) => this.mapSearchResultToContact(result, companyDomain))
        .filter((contact): contact is Contact => contact !== null);

      contacts.push(...pageContacts);

      const totalPages = response.pagination?.total_page ?? page;
      if (page >= totalPages) {
        break;
      }

      await sleep(env.prospeoRequestDelayMs());
    }

    return contacts;
  }

  private async enrichContact(contact: Contact): Promise<ResolvedContact | null> {
    if (!contact.personId && !contact.linkedinUrl) {
      logger.debug('Skipping enrich — missing person_id and linkedin_url', contact);
      return null;
    }

    try {
      const response = await withRetry(
        () => this.enrichPerson(contact),
        {
          maxRetries: env.requestMaxRetries(),
          baseDelayMs: env.requestBaseDelayMs(),
          label: `Prospeo enrich (${contact.fullName})`,
        },
      );

      if (response.error) {
        if (response.error_code === 'NO_MATCH') {
          logger.debug(`Prospeo: no verified email for ${contact.fullName}`);
          return null;
        }

        logger.warn(`Prospeo enrich error for ${contact.fullName}`, {
          errorCode: response.error_code,
        });
        return null;
      }

      const email = this.extractVerifiedEmail(response);
      if (!email) {
        logger.debug(`Prospeo: verified email unavailable for ${contact.fullName}`);
        return null;
      }

      const person = response.person;
      return {
        ...contact,
        fullName: person?.full_name?.trim() || contact.fullName,
        firstName: person?.first_name?.trim() || contact.firstName,
        title: person?.current_job_title?.trim() || contact.title,
        linkedinUrl: person?.linkedin_url?.trim() || contact.linkedinUrl,
        email,
      };
    } catch (error) {
      const prospeoError = this.parseEnrichError(error);
      if (prospeoError?.error_code === 'NO_MATCH') {
        logger.debug(`Prospeo: no verified email for ${contact.fullName}`);
        return null;
      }

      logger.error(`Prospeo enrich failed for ${contact.fullName}`, prospeoError ?? error);
      return null;
    }
  }

  private async enrichPerson(contact: Contact): Promise<ProspeoEnrichResponse> {
    const data: Record<string, string> = {};

    if (contact.personId) {
      data.person_id = contact.personId;
    }
    if (contact.linkedinUrl) {
      data.linkedin_url = contact.linkedinUrl;
    }
    if (contact.fullName) {
      data.full_name = contact.fullName;
    }
    if (contact.companyDomain) {
      data.company_website = contact.companyDomain;
    }

    try {
      const { data: response } = await this.client.post<ProspeoEnrichResponse>('/enrich-person', {
        only_verified_email: true,
        data,
      });

      return response;
    } catch (error) {
      const prospeoError = this.parseEnrichError(error);
      if (prospeoError) {
        return prospeoError;
      }
      throw error;
    }
  }

  private extractVerifiedEmail(response: ProspeoEnrichResponse): string | null {
    const emailDetails = response.person?.email;
    const email = emailDetails?.email?.trim().toLowerCase();

    if (
      !email ||
      !email.includes('@') ||
      emailDetails?.status !== 'VERIFIED' ||
      emailDetails?.revealed !== true
    ) {
      return null;
    }

    return email;
  }

  private async searchPeople(companyDomain: string, page: number): Promise<ProspeoSearchResponse> {
    try {
      const { data } = await this.client.post<ProspeoSearchResponse>('/search-person', {
        page,
        filters: {
          company: {
            websites: {
              include: [companyDomain],
            },
          },
          person_job_title: {
            include: [...TARGET_JOB_TITLES],
            match_mode: 'CONTAINS',
          },
          max_person_per_company: 3,
        },
      });

      return data;
    } catch (error) {
      const prospeoError = this.parseProspeoError(error);
      if (prospeoError) {
        return prospeoError;
      }
      throw error;
    }
  }

  private mapSearchResultToContact(
    result: ProspeoSearchResult,
    fallbackDomain: string,
  ): Contact | null {
    const person = result.person;
    const fullName = person.full_name?.trim();
    const linkedinUrl = person.linkedin_url?.trim();
    const title = person.current_job_title?.trim() || person.headline?.trim() || 'Decision Maker';
    const companyDomain =
      result.company?.domain?.trim().toLowerCase() ||
      result.company?.website
        ?.trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '') ||
      fallbackDomain;

    if (!fullName || !linkedinUrl) {
      logger.debug('Skipping Prospeo contact with missing data', {
        fullName,
        linkedinUrl,
        companyDomain,
      });
      return null;
    }

    return {
      personId: person.person_id?.trim() || undefined,
      fullName,
      firstName: person.first_name?.trim() || undefined,
      title,
      linkedinUrl,
      companyDomain,
    };
  }

  private parseProspeoError(error: unknown): ProspeoSearchResponse | null {
    const axiosError = error as AxiosError<ProspeoSearchResponse>;
    if (!axiosError.response?.data?.error_code) {
      return null;
    }

    return axiosError.response.data;
  }

  private parseEnrichError(error: unknown): ProspeoEnrichResponse | null {
    const axiosError = error as AxiosError<ProspeoEnrichResponse>;
    if (!axiosError.response?.data?.error_code) {
      return null;
    }

    return axiosError.response.data;
  }
}
