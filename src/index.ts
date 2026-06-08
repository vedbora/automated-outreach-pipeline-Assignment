import { Command } from 'commander';
import { normalizeDomain } from './config/env';
import { OutreachPipeline } from './pipeline/outreach.pipeline';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('automated-outreach-pipeline')
    .description('End-to-end automated B2B outreach pipeline')
    .requiredOption('--domain <domain>', 'Seed company domain (e.g. zoho.com)')
    .parse(process.argv);

  const options = program.opts<{ domain: string }>();
  const seedDomain = normalizeDomain(options.domain);

  if (!seedDomain || !seedDomain.includes('.')) {
    throw new Error('Please provide a valid company domain, e.g. zoho.com');
  }

  const pipeline = new OutreachPipeline({ seedDomain });
  await pipeline.run();
}

main().catch((error: unknown) => {
  logger.error('Pipeline failed', error);
  process.exitCode = 1;
});
