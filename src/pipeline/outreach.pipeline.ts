import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { BrevoService } from '../services/brevo.service';
import { OceanService } from '../services/ocean.service';
import { ProspeoService } from '../services/prospeo.service';
import { PipelineResult } from '../models/contact';
import { logger } from '../utils/logger';

export interface OutreachPipelineOptions {
  seedDomain: string;
  oceanService?: OceanService;
  prospeoService?: ProspeoService;
  brevoService?: BrevoService;
}

export class OutreachPipeline {
  private readonly oceanService: OceanService;
  private readonly prospeoService: ProspeoService;
  private readonly brevoService?: BrevoService;
  private readonly options: OutreachPipelineOptions;

  constructor(options: OutreachPipelineOptions) {
    this.oceanService = options.oceanService ?? new OceanService();
    this.prospeoService = options.prospeoService ?? new ProspeoService();
    this.brevoService = options.brevoService;
    this.options = options;
  }

  async run(): Promise<PipelineResult> {
    const startedAt = Date.now();
    logger.info(`Pipeline started for domain: ${this.options.seedDomain}`);

    const companies = await this.oceanService.findLookalikeCompanies(this.options.seedDomain);
    logger.info('Ocean completed');

    const companyDomains = companies.map((company) => company.domain);
    const prospeoResult = await this.prospeoService.findDecisionMakersWithEmails(companyDomains);
    logger.info('Prospeo completed');

    const { contacts, enrichedContacts } = prospeoResult;

    logger.summary({
      seedDomain: this.options.seedDomain,
      companiesFound: companies.length,
      contactsFound: contacts.length,
      emailsResolved: enrichedContacts.length,
      companyDomains,
      contacts: enrichedContacts.map((contact) => ({
        fullName: contact.fullName,
        title: contact.title,
        companyDomain: contact.companyDomain,
        email: contact.email,
      })),
    });

    let emailsSent = 0;

    if (enrichedContacts.length === 0) {
      logger.warn('No verified emails found — skipping Brevo send step');
    } else {
      const confirmed = await this.confirmSend();
      if (confirmed) {
        const brevoService = this.brevoService ?? new BrevoService();
        emailsSent = await brevoService.sendBatch(enrichedContacts);
        logger.info('Brevo completed');
      } else {
        logger.info('Email sending cancelled by user');
      }
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`Pipeline finished in ${durationMs}ms`, {
      seedDomain: this.options.seedDomain,
      companiesFound: companies.length,
      contactsFound: contacts.length,
      emailsResolved: enrichedContacts.length,
      emailsSent,
      lookalikeCompanies: companyDomains,
    });

    return {
      companiesFound: companies.length,
      contactsFound: contacts.length,
      emailsResolved: enrichedContacts.length,
      emailsSent,
      durationMs,
    };
  }

  private async confirmSend(): Promise<boolean> {
    const rl = readline.createInterface({ input, output });

    try {
      const answer = await rl.question('Proceed with sending emails? (Y/N): ');
      const normalized = answer.trim().toLowerCase();
      return normalized === 'y' || normalized === 'yes';
    } finally {
      rl.close();
    }
  }
}
