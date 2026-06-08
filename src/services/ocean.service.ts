import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { Company, OceanSearchResponse, extractOceanDomain } from '../models/company';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { dedupeDomains } from '../utils/dedupe';

export class OceanService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.ocean.io',
      timeout: env.requestTimeoutMs(),
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': env.oceanApiKey(),
      },
    });
  }

  async findLookalikeCompanies(seedDomain: string): Promise<Company[]> {
    const maxCompanies = env.oceanMaxCompanies();
    const pageSize = Math.min(env.oceanPageSize(), maxCompanies);
    const collected: string[] = [];
    let searchAfter: string | undefined;

    logger.info(`Ocean.io: searching lookalike companies for ${seedDomain}`);

    while (collected.length < maxCompanies) {
      const remaining = maxCompanies - collected.length;
      const size = Math.min(pageSize, remaining);

      const response = await withRetry(
        () =>
          this.client.post<OceanSearchResponse>('/v3/search/companies', {
            size,
            searchAfter,
            companiesFilters: {
              lookalikeDomains: [seedDomain],
              excludeDomains: [seedDomain],
              companyMatchingMode: 'precise',
            },
          }),
        {
          maxRetries: env.requestMaxRetries(),
          baseDelayMs: env.requestBaseDelayMs(),
          label: 'Ocean.io search',
        },
      );

      const domains = response.data.companies
        .map((entry) => extractOceanDomain(entry))
        .filter((domain): domain is string => Boolean(domain));

      collected.push(...domains);

      if (response.data.missingDomains && Object.keys(response.data.missingDomains).length > 0) {
        logger.warn('Ocean.io reported missing seed domains', response.data.missingDomains);
      }

      searchAfter = response.data.searchAfter;
      if (!searchAfter || domains.length === 0) {
        break;
      }
    }

    const uniqueDomains = dedupeDomains(collected).slice(0, maxCompanies);
    logger.info(`Ocean.io: found ${uniqueDomains.length} lookalike companies`);

    return uniqueDomains.map((domain) => ({ domain }));
  }
}
