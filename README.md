# Automated Outreach Pipeline

Production-ready TypeScript CLI that takes a single company domain and runs a full B2B outreach workflow end-to-end:

```
Domain → Ocean.io → Similar Companies → Prospeo → Decision Makers + LinkedIn + Email → Brevo → Send Emails
```

1. **Ocean.io** — find lookalike companies
2. **Prospeo** — find decision makers, enrich with verified work emails via LinkedIn / person ID
3. **Brevo** — send personalized outreach emails (with confirmation checkpoint)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and add your API keys:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `OCEAN_API_KEY` | Ocean.io API token (`X-Api-Token`) |
| `PROSPEO_API_KEY` | Prospeo API key (`X-KEY`) |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `BREVO_SENDER_EMAIL` | Verified sender email in Brevo |

Optional tuning variables are documented in `.env.example`.

### 3. Run the pipeline

```bash
npx tsx src/index.ts --domain zoho.com
```

After the summary, confirm with `Y` to send emails via Brevo.

## Safety Checkpoint

Before any email is sent, the CLI prints:

```
---
Seed Domain: zoho.com
Companies Found: X
Contacts Found: X
Emails Resolved: X
------------------

Proceed with sending emails? (Y/N)
```

Emails are only sent after explicit confirmation.

## Architecture

```
src/
├── config/
│   └── env.ts
├── services/
│   ├── ocean.service.ts
│   ├── prospeo.service.ts
│   └── brevo.service.ts
├── models/
│   ├── company.ts
│   └── contact.ts
├── utils/
│   ├── logger.ts
│   ├── retry.ts
│   └── dedupe.ts
├── pipeline/
│   └── outreach.pipeline.ts
└── index.ts
```

### Design highlights

- **Clean architecture** — three isolated API services orchestrated by the pipeline
- **Prospeo two-step flow** — search decision makers, then enrich each with verified email
- **Resilience** — exponential backoff, rate-limit handling (`429` + `Retry-After`), partial failure tolerance
- **Deduplication** — domains, contacts, and emails are deduplicated before sending
- **Structured logging** — stage completion, errors, and total processing time

## API Integrations

### Ocean.io

- Endpoint: `POST /v3/search/companies`
- Uses `lookalikeDomains` with cursor pagination via `searchAfter`
- Excludes the seed domain from results

### Prospeo

- **Search:** `POST /search-person` — filters by company website and target job titles (CEO, CTO, Founder, etc.)
- **Enrich:** `POST /enrich-person` — resolves verified work email using `person_id` / `linkedin_url` with `only_verified_email: true`
- Continues if an individual company or contact enrichment fails
- Configurable delay between requests via `PROSPEO_REQUEST_DELAY_MS`

### Brevo

- Endpoint: `POST /v3/smtp/email`
- Sends personalized plain-text emails one-by-one with retry handling
- Logs each successful send with Brevo `messageId`

## Development

Build only:

```bash
npm run build
```

Run directly with tsx (no build step):

```bash
npx tsx src/index.ts --domain zoho.com
```
#Output Images
<img width="1850" height="1667" alt="{232C2A1E-FE70-4BAC-9023-EF5277F65BC4}" src="https://github.com/user-attachments/assets/ce7ed363-f4b6-40e6-a52f-b91b2f659c3c" />
<img width="1813" height="1706" alt="{901A24E9-F380-4F76-A688-A614C6C765FD}" src="https://github.com/user-attachments/assets/898f84f5-5924-4ec5-b40e-74946e867528" />
<img width="1744" height="1697" alt="{F3354636-5900-4ED1-BB45-C5934D944290}" src="https://github.com/user-attachments/assets/90ee2abf-1c84-4f9f-85b3-02b5de837670" />
<img width="1612" height="1595" alt="{4E727CC4-DDC9-4AF9-9E95-D4ED3CDC2A32}" src="https://github.com/user-attachments/assets/ad3344a0-5ebb-4576-be69-8c4608522fad" />




