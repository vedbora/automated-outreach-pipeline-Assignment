import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { OutreachEmailPayload, ResolvedContact } from '../models/contact';
import { extractFirstName, formatCompanyName } from '../utils/dedupe';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

interface BrevoSendResponse {
  messageId?: string;
}

export class BrevoService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.brevo.com/v3',
      timeout: env.requestTimeoutMs(),
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.brevoApiKey(),
      },
    });
  }

  buildEmailPayload(contact: ResolvedContact): OutreachEmailPayload {
    const firstName = contact.firstName || extractFirstName(contact.fullName);
    const company = formatCompanyName(contact.companyDomain);

    return {
      contact,
      subject: `Quick Question About ${company}`,
      body: [
        `Hi ${firstName},`,
        '',
        `I came across ${company} and noticed your role as ${contact.title}.`,
        '',
        'I wanted to briefly introduce our solution and see whether a quick conversation would make sense.',
        '',
        'Best Regards,',
        env.brevoSenderName(),
      ].join('\n'),
    };
  }

  async sendBatch(contacts: ResolvedContact[]): Promise<number> {
    let sentCount = 0;

    for (const contact of contacts) {
      try {
        await this.sendOne(contact);
        sentCount += 1;
      } catch (error) {
        logger.error(`Brevo: failed to send email to ${contact.email}`, error);
      }
    }

    logger.info(`Brevo: successfully sent ${sentCount}/${contacts.length} emails`);
    return sentCount;
  }

  private async sendOne(contact: ResolvedContact): Promise<void> {
    const payload = this.buildEmailPayload(contact);

    const response = await withRetry(
      () =>
        this.client.post<BrevoSendResponse>('/smtp/email', {
          sender: {
            name: env.brevoSenderName(),
            email: env.brevoSenderEmail(),
          },
          to: [
            {
              email: contact.email,
              name: contact.fullName,
            },
          ],
          subject: payload.subject,
          textContent: payload.body,
        }),
      {
        maxRetries: env.requestMaxRetries(),
        baseDelayMs: env.requestBaseDelayMs(),
        label: `Brevo send (${contact.email})`,
      },
    );

    logger.info(`Brevo: email sent to ${contact.email}`, {
      messageId: response.data.messageId,
      subject: payload.subject,
    });
  }
}
