export interface Company {
  domain: string;
  name?: string;
}

export interface OceanCompanyResponse {
  domain?: string;
  name?: string;
  company?: {
    domain?: string;
    name?: string;
  };
}

export interface OceanSearchResponse {
  companies: OceanCompanyResponse[];
  searchAfter?: string;
  missingDomains?: Record<string, string>;
}

export function extractOceanDomain(entry: OceanCompanyResponse): string | null {
  const domain = entry.company?.domain ?? entry.domain;
  const normalized = domain?.trim().toLowerCase();
  return normalized || null;
}

export function extractOceanName(entry: OceanCompanyResponse): string | undefined {
  return entry.company?.name ?? entry.name;
}
