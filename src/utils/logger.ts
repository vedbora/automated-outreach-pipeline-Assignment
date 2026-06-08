type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_PREFIX: Record<LogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
};

function formatTimestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  const prefix = `[${formatTimestamp()}] [${LEVEL_PREFIX[level]}]`;
  if (meta !== undefined) {
    console.log(`${prefix} ${message}`, meta);
    return;
  }
  console.log(`${prefix} ${message}`);
}

export const logger = {
  info(message: string, meta?: unknown): void {
    write('info', message, meta);
  },

  warn(message: string, meta?: unknown): void {
    write('warn', message, meta);
  },

  error(message: string, meta?: unknown): void {
    write('error', message, meta);
  },

  debug(message: string, meta?: unknown): void {
    write('debug', message, meta);
  },

  section(title: string): void {
    console.log(`\n--- ${title} ---`);
  },

  summary(summary: {
    seedDomain: string;
    companiesFound: number;
    contactsFound: number;
    emailsResolved: number;
    companyDomains?: string[];
    contacts?: Array<{
      fullName: string;
      title: string;
      companyDomain: string;
      email?: string;
    }>;
  }): void {
    console.log('\n---');
    console.log(`Seed Domain: ${summary.seedDomain}`);
    console.log(`Companies Found: ${summary.companiesFound}`);
    console.log(`Contacts Found: ${summary.contactsFound}`);
    console.log(`Emails Resolved: ${summary.emailsResolved}`);

    if (summary.companyDomains && summary.companyDomains.length > 0) {
      console.log('\nLookalike companies:');
      summary.companyDomains.forEach((domain, index) => {
        console.log(`  ${index + 1}. ${domain}`);
      });
    }

    if (summary.contacts && summary.contacts.length > 0) {
      console.log('\nDecision makers with verified emails:');
      summary.contacts.forEach((contact, index) => {
        const emailSuffix = contact.email ? ` <${contact.email}>` : '';
        console.log(
          `  ${index + 1}. ${contact.fullName} — ${contact.title} @ ${contact.companyDomain}${emailSuffix}`,
        );
      });
    }

    console.log('------------------\n');
  },
};
