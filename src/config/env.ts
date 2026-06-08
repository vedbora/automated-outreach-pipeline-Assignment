import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return parsed;
}

function parseNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative integer`);
  }

  return parsed;
}

export const env = {
  oceanApiKey: () => requireEnv('OCEAN_API_KEY'),
  prospeoApiKey: () => requireEnv('PROSPEO_API_KEY'),
  brevoApiKey: () => requireEnv('BREVO_API_KEY'),
  brevoSenderEmail: () => requireEnv('BREVO_SENDER_EMAIL'),
  brevoSenderName: () => optionalEnv('BREVO_SENDER_NAME', 'Vedant Bora'),

  oceanMaxCompanies: () => parsePositiveInt('OCEAN_MAX_COMPANIES', 50),
  oceanPageSize: () => parsePositiveInt('OCEAN_PAGE_SIZE', 50),
  prospeoMaxPagesPerCompany: () => parsePositiveInt('PROSPEO_MAX_PAGES_PER_COMPANY', 5),
  prospeoRequestDelayMs: () => parseNonNegativeInt('PROSPEO_REQUEST_DELAY_MS', 500),

  requestMaxRetries: () => parsePositiveInt('REQUEST_MAX_RETRIES', 3),
  requestBaseDelayMs: () => parsePositiveInt('REQUEST_BASE_DELAY_MS', 1000),
  requestTimeoutMs: () => parsePositiveInt('REQUEST_TIMEOUT_MS', 30000),
};

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}
