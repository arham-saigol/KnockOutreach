# Knock

Knock is a human-in-the-loop cold-outreach app. A single global daily workflow discovers Product Hunt launches, enriches each surviving company once, evaluates it against every ready project, and creates short evidence-backed drafts. An email is sent only after a user explicitly selects **Send**.

## Architecture

- **Next.js App Router + TypeScript** renders the responsive card queue, onboarding, Settings, and full-screen Play Mode. Radix primitives provide menus, tabs, dialog focus management, and keyboard interaction.
- **Clerk** owns sign-in, sign-out, profile identity, and route protection. Convex receives the Clerk JWT; every public query, mutation, and action derives ownership from `ctx.auth`, never from a client-supplied owner ID.
- **Convex Cloud** owns all application data, immutable crawled-page and Markdown knowledge artifacts in file storage, the durable Workflow component, scheduled functions, integration actions, and the AgentMail HTTP webhook. This repository does not support or document a local Convex backend.
- **Global-first pipeline:** a unique `dailyRuns.day` record coordinates a single Product Hunt run. Deterministic exclusions happen first, ambiguous massive-company checks use structured DeepSeek output, and only the union of coarsely eligible launches is enriched. `launchEnrichments` is unique per launch.
- **Reproducibility:** model name, prompt version, knowledge version, source hashes, reasons, confidence, and versioned Markdown are stored alongside decisions and drafts.
- **Delivery safety:** the `ready → sending` transition, suppression checks, cross-project cooldown checks, draft approval, and send-record insertion occur in one Convex transaction. AgentMail receives both `Idempotency-Key` and `X-Knock-Send-Id`. Network/receipt ambiguity becomes terminal `send_unknown`; it is never retried automatically.
- **Webhook safety:** the Convex HTTP action verifies the Svix HMAC against the exact raw request body, enforces timestamp tolerance, inserts an indexed event ID before applying state, and treats retries as duplicates.

## Data model

The indexed Convex schema includes `projects`, `projectPages`, `knowledgeVersions`, `dailyRuns`, `launches`, `launchEnrichments`, `projectCandidates`, `drafts`, `sends`, `suppressions`, and `webhookEvents`. Operational records use explicit states; sending and dismissing never delete history.

## Required environment variables

### Vercel / local Next.js process

| Variable                            | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key                                     |
| `CLERK_SECRET_KEY`                  | Clerk server key used by route protection             |
| `NEXT_PUBLIC_CONVEX_URL`            | Production or development **Convex Cloud** client URL |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | Set to `/sign-in`                                     |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | Set to `/sign-up`                                     |
| `CONVEX_DEPLOY_KEY`                 | Convex Cloud deploy key for CI/Vercel deployment      |

`NEXT_PUBLIC_KNOCK_DEMO_MODE=1` is only a local, in-memory UI fixture for browser review. Never enable it in production.

### Convex Cloud environment

Set these in the target deployment with `npx convex env set NAME VALUE` or in the Convex dashboard. Do not put them in `.env.local`, Vercel browser variables, or committed files.

| Variable                    | Required    | Purpose                                     |
| --------------------------- | ----------- | ------------------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN`   | yes         | Clerk Frontend API / JWT issuer domain      |
| `PRODUCT_HUNT_ACCESS_TOKEN` | yes         | Product Hunt GraphQL bearer token           |
| `TINYFISH_API_KEY`          | yes         | TinyFish Fetch API key                      |
| `DEEPSEEK_API_KEY`          | yes         | DeepSeek API key                            |
| `DEEPSEEK_MODEL`            | no          | Defaults to `deepseek-v4-flash`             |
| `AGENTMAIL_API_KEY`         | yes         | Shared server-side AgentMail key            |
| `AGENTMAIL_WEBHOOK_SECRET`  | yes         | Endpoint secret beginning with `whsec_`     |
| `AGENTMAIL_INBOX_BINDINGS`  | yes         | JSON map of Clerk subjects to owned inboxes |
| `CONTACT_COOLDOWN_DAYS`     | no          | Default project cooldown; defaults to `90`  |
| `KNOCK_APP_URL`             | recommended | Canonical Vercel application URL            |

The AgentMail API key is intentionally not part of project onboarding or stored in any Convex table. `AGENTMAIL_INBOX_BINDINGS` must be a JSON object such as `{"user_123":["inbox_abc","sender@example.com"]}`; project creation, updates, and sends fail closed unless the authenticated Clerk subject owns the selected inbox.

## Exact service setup

### 1. Clerk

1. Create a Clerk application and enable the desired sign-in methods.
2. In Clerk, activate the Convex integration and copy the issuer / Frontend API domain (for example, `https://example.clerk.accounts.dev`).
3. Set that exact value as `CLERK_JWT_ISSUER_DOMAIN` in Convex Cloud.
4. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to Vercel.
5. Allow the production Vercel domain in Clerk. The app protects `/app`, `/onboarding`, and `/settings`; only the landing and auth routes are public.

### 2. Convex Cloud

1. Create separate Convex Cloud development and production deployments.
2. Obtain a deploy key for the intended cloud deployment and expose it to the deployment command as `CONVEX_DEPLOY_KEY`.
3. Set every secret in the table above on each relevant cloud deployment.
4. Deploy and regenerate typed bindings with:

   ```bash
   npx convex deploy
   ```

5. Copy the deployment’s `.convex.cloud` client URL to `NEXT_PUBLIC_CONVEX_URL`. The AgentMail webhook uses the corresponding `.convex.site` URL.

The schedule in `convex/crons.ts` starts discovery at **10:15 UTC**, which is **3:15 PM Asia/Karachi**. At that time the workflow fetches the previous, fully completed Product Hunt calendar day in `America/Los_Angeles`. A second daily schedule selects projects whose rolling seven-day knowledge refresh is due.

### 3. Product Hunt

1. Register an API application and obtain a read-capable access token.
2. Set it as `PRODUCT_HUNT_ACCESS_TOKEN` in Convex Cloud.
3. Confirm quota and intended use with Product Hunt before production traffic.

Launch cards attribute Product Hunt. Product Hunt’s published API terms state that the API must not be used commercially without approval; contact Product Hunt before using Knock for a business or commercial workflow.

### 4. TinyFish

1. Create a TinyFish API key with Fetch API access.
2. Set `TINYFISH_API_KEY` in Convex Cloud.
3. Confirm the account’s URL-per-minute limit fits the daily launch volume.

Knock sends up to ten URLs per Fetch request, follows only useful same-domain pages, and stores content hashes. It also records `ETag` and `Last-Modified` from direct HEAD responses when the origin exposes them.

### 5. DeepSeek

1. Create and fund a DeepSeek API account.
2. Set `DEEPSEEK_API_KEY` and optionally `DEEPSEEK_MODEL=deepseek-v4-flash` in Convex Cloud.
3. Confirm JSON Output access for that model.

Every model boundary uses JSON mode plus a Zod schema. Drafts receive additional deterministic checks for word count, banned language, formatting, and evidence URLs.

### 6. AgentMail and webhooks

1. Create the sending inboxes in AgentMail and copy each inbox ID/address into its Knock project.
2. Set the organization API key as `AGENTMAIL_API_KEY` in Convex Cloud, then set `AGENTMAIL_INBOX_BINDINGS` to the server-managed Clerk-subject-to-inbox JSON map.
3. Create one AgentMail webhook pointing to:

   ```text
   https://<your-convex-deployment>.convex.site/agentmail/webhooks
   ```

4. Subscribe to `message.sent`, `message.delivered`, `message.bounced`, `message.complained`, `message.rejected`, and `message.received`.
5. Fetch/copy the webhook signing secret and set it as `AGENTMAIL_WEBHOOK_SECRET` in Convex Cloud.
6. Send AgentMail’s test events and verify the Convex `webhookEvents` table receives one row per event ID.

### 7. Vercel

1. Import the repository into Vercel and add the Next.js variables listed above for Preview and Production as appropriate.
2. Add the production `CONVEX_DEPLOY_KEY` only to the protected production environment.
3. Use `npx convex deploy --cmd 'npm run build'` as the production build command if Vercel should deploy Convex and Next.js together. Otherwise deploy Convex first in CI and keep Vercel’s build command as `npm run build`.
4. Deploy, then add the final Vercel domain to Clerk and set `KNOCK_APP_URL` in Convex Cloud.

## Local frontend development

Use an existing Convex Cloud development deployment. Do not run a local Convex backend.

```bash
npm install
npm run dev
```

For credential-free visual review only:

```powershell
$env:NEXT_PUBLIC_KNOCK_DEMO_MODE='1'
npm run dev
```

## Validation

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

The focused tests cover deterministic and project filtering, stable hashing, evidence-only email extraction, state transitions, owner authorization, duplicate-send prevention, webhook deduplication, and exact-body Svix verification.
