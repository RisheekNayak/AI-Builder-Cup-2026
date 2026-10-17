# ShipSure — Deployment and Live Integration Validation

Run these steps from an authenticated developer machine with `gcloud` access. **No live Google Cloud verification was possible from the uploaded ZIP alone.** Never paste secrets or service account keys into chat, logs or screenshots.

## 1. Identify actual deployed services

```bash
gcloud auth list
gcloud config set project YOUR_PROJECT_ID
gcloud run services list --region us-central1 --format='table(metadata.name,status.url,status.latestReadyRevisionName)'
gcloud run services describe shipsure-api --region us-central1 --format=json > api-service.json
gcloud run services describe shipsure-web --region us-central1 --format=json > web-service.json
```

Inspect `api-service.json` locally for image, service account, env **variable names** (not values), latest revision, traffic and readiness. Treat these JSON files as sensitive if they include environment secrets; do not commit them. Check service logs:

```bash
gcloud run services logs read shipsure-api --region us-central1 --limit 100
```

Confirm public `https://...` frontend loads and backend `/health` responds. Confirm frontend network requests reach the actual backend rather than `localhost:8000`.

## 2. Prove which Gemini backend is used

The code selects **Developer API whenever `GEMINI_API_KEY` or `GOOGLE_API_KEY` exists**. Only with neither key present does it use Vertex AI (`vertexai=True`). Check Cloud Run environment/secret bindings and revision configuration. If using Vertex AI, the service identity needs appropriate Vertex AI permissions and Vertex AI API enabled. Check `ASSISTANT_MODE` is not `offline`.

Run a *real* chat question in the deployed UI; capture request ID, HTTP result, meaningful answer and backend logs. `GET /api/assistant/status` reports local cooldown status but is not an end-to-end probe. Verify that the response is not a deterministic offline fallback. Add structured provider/route logs before final judging if needed, without logging prompts containing private data or any credentials.

## 3. Prove Document AI

Ensure `DEMO_MODE=false`, `GCP_PROJECT_ID`, `GCP_PROCESSOR_ID`, `GCP_DOCAI_LOCATION` match an existing processor and Cloud Run service identity has permission. Upload a **new synthetic PDF** through the UI and inspect the extraction result and backend logs. The code can fall back to Gemini, so a successful extraction alone does not prove Document AI ran. Confirm Document AI invocation via Cloud Logging or service metrics. Use a sample with known expected fields and compare field accuracy.

## 4. Prove Vertex AI Search

Ensure `DEMO_MODE=false`, `GCP_PROJECT_ID` and `GCP_DATASTORE_ID` are correct, the datastore contains indexed documents and the service identity has search permissions. Ask a question uniquely answered by a document in the datastore and verify the expected citation/snippet. **The code silently falls back to local JSON on Search failure**, so success of the chat UI is not proof. Confirm a successful Discovery Engine search via logging or cloud metrics. If needed, temporarily make fallback explicit and return `retrieval_source: vertex_search|local` in non-public diagnostic output.

## 5. Browser-level end-to-end checks

```bash
cd frontend
npm ci
npx playwright install chromium
npx playwright test
```

Run locally first, then against deployed URLs after adjusting test configuration. Verify: onboarding persists across refresh; dashboard loads; orders/receivables/stock render; assistant can answer grounded questions; payment/dispatch confirmation changes records; invoice upload produces a risk report; PDF downloads open; no browser console errors or failed network requests. Repeat after deploying a new Cloud Run revision to expose persistence failures.

## 6. Reset endpoint security

With `ENABLE_DEMO_RESET=false` (recommended for public deployment), `POST /api/demo/reset` must return 404. With explicit enablement but no/wrong `X-Demo-Reset-Token`, it must return 403. Only an authorized server-side request should ever use the reset token. **Warning:** reset is destructive and the current implementation recreates the SQLite database; do not enable it with a shared persistent SQL database without redesigning reset logic.

## 7. Persistence decision

Cloud Run's writable filesystem is ephemeral, not a database. For a shared, durable prototype use Cloud SQL PostgreSQL for SQLAlchemy data and Cloud Storage for uploads, generated PDFs and company profiles. The current code is **not yet wired to GCS** for these files. Cloud SQL needs the appropriate PostgreSQL driver, connection URL, IAM/networking, migrations and connection pooling. A cheaper temporary alternative is a clearly labeled resettable demo with a single instance, but even one instance is not durable and must not be represented as persistent.

## 8. Release gate

- [ ] Live backend and frontend Cloud Run URLs respond from a clean browser
- [ ] Frontend uses correct backend URL; CORS is restricted to frontend origin
- [ ] Cloud Run logs show no startup/import errors
- [ ] Actual Gemini provider verified via environment and successful live request
- [ ] Document AI invocation independently confirmed (or clearly labeled demo fallback)
- [ ] Vertex AI Search invocation independently confirmed (or clearly labeled local retrieval)
- [ ] Browser E2E tests and manual critical path pass
- [ ] Public reset disabled; no secrets in repository or browser bundle
- [ ] Restart/redeploy persistence behavior explicitly documented
- [ ] All submitted links remain accessible without developer credentials


## Branch validation record — 16 October 2026

The supplied audited ZIP was compared directly with this checkout. Product source matches except for reset protection and the readiness fixes now being made. Generated uploads/forms, Python bytecode, and test caches were deliberately excluded from comparison/import. The supplied README overview was appended to `README.md`, preserving earlier work.

### Deployment changes prepared locally

The backend deployment script now uses the existing root Dockerfile without overwriting/deleting it, disables demo reset, uses `GCP_DOCAI_LOCATION`, and stops on deployment failure. Configuration updates preserve other existing environment variables. Inspect and configure CORS, service identity, and credentials before deploying.

The frontend now has a Cloud Build config passing `NEXT_PUBLIC_API_URL` as a Docker build argument. Its Dockerfile rejects an empty value. The Windows script requires both a backend URL and a tagged Artifact Registry image path. On macOS/Linux the equivalent commands are:

```bash
# Replace every placeholder with verified project resources.
gcloud builds submit frontend --config=frontend/cloudbuild.yaml \
  --project=YOUR_PROJECT_ID \
  --substitutions=_API_URL=https://YOUR_BACKEND,_IMAGE=REGION-docker.pkg.dev/YOUR_PROJECT_ID/REPOSITORY/shipsure-web:TAG
gcloud run deploy shipsure-web \
  --image=REGION-docker.pkg.dev/YOUR_PROJECT_ID/REPOSITORY/shipsure-web:TAG \
  --project=YOUR_PROJECT_ID --region=us-central1 --port=8080
```

The Artifact Registry repository must already exist and build/deploy identities need permission. These commands do not grant public access; verify the existing service's access separately. No cloud build, deployment, permission change, or storage provisioning was performed during local verification.

Build ignore files exclude local environments, secrets, dependencies, databases, uploads, and generated forms.

### Integration evidence improvements

Successful Gemini requests log the selected provider, model, and elapsed milliseconds without prompt contents. `/api/assistant/status` additionally reports configured provider and mode; availability still means the local gate permits a request, not that credentials have been verified. Search logs distinguish `vertex_search` and `local` results. Invoice extraction logs successful Document AI and Gemini calls. A Document AI call succeeding is separate from its extracted fields being sufficient for the workflow.

Fixed Search result parsing: the installed SDK has no top-level `SearchResult.relevance_score`. Results now preserve service ordering with reciprocal-rank scores, avoiding an exception that previously forced local fallback. A regression test uses a real SDK response object with a mocked network client. These remain local tests, not proof of a live cloud call.

### Cloud access blocker

Opening the supplied project's Cloud Run console reached Google sign-in in the in-app browser. The Google Cloud CLI was not found on PATH. Deployed URLs, revisions, IAM, environment bindings, logs, persistence, and successful live Gemini/Document AI/Search calls remain unverified until an authenticated console or CLI is available. Never paste secret values into chat.


### Validation results — 16 October 2026

- Backend: **37 tests passed**, including reset authorization, Search SDK response parsing, Gemini provider selection, and success-log privacy checks.
- Browser: **10 Playwright workflows passed** against a real isolated backend with offline AI, a temporary SQLite database, and mocked company profile requests. Test-only reset requires its test token; backend and browser dates are fixed together for deterministic date validation.
- Frontend lint: passed.
- Production build: passed using `next build --webpack`. Default Turbopack hit an internal worker-port permission restriction in this local environment; a first sandboxed build also could not download the Google font. The application compiled and type-checked successfully through webpack. Docker/Cloud Build execution remains unverified.
- `git diff --check`: passed.
- Public cloud integration tests: pending authenticated Google Cloud access.


### Live Cloud Run inspection — 16 October 2026

Authenticated console access succeeded. Both services are marked healthy in `us-central1`; their overview last-update timestamps are 27 September 2026. Public endpoints discovered from service details:

- Frontend: https://shipsure-web-117561127510.us-central1.run.app
- Backend: https://shipsure-api-117561127510.us-central1.run.app

Backend `/health` returned HTTP 200 with `demo_mode=false`. Frontend returned HTTP 200 and rendered the older shipment-compliance dashboard, without the current business workspace. `/api/assistant/status` returned HTTP 404. The public deployment therefore does not represent the current local branch.

A synthetic policy question to `/api/advisor/chat` returned HTTP 503 after approximately 20 seconds. Cloud Run logs independently show the matching 503 request, a Gunicorn `WORKER TIMEOUT`, worker termination and service restart around that request. This establishes a deployed worker failure; it does not establish whether Gemini credentials, Document AI or Search permissions are valid. No successful live AI/extraction/search invocation has been verified.

The API container configuration lists `DEMO_MODE`, `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_PROCESSOR_ID`, and `GCP_DATASTORE_ID`, with no API-key variable or secret binding visible in that panel. This is consistent with IAM-based cloud configuration but is not proof of the SDK/provider used by the older deployed image. No Cloud SQL connection or mounted volume was listed in the API container configuration.

No cloud configuration, permissions, or deployed image was changed during this inspection. Next release work must deploy the reviewed branch and verify cloud calls and worker responsiveness before marking the application ready.


### Reviewed deployment started — 16 October 2026

Moved synchronous Vertex Search and Document AI work to worker threads so cloud RPCs do not block the async server event loop. Search has a 15-second RPC deadline without automatic retries; Document AI has a 30-second deadline; Gemini requests have a 45-second async deadline and use existing fallback handling. A regression test verifies that slow Search leaves the event loop responsive. All 38 backend tests pass.

Prepared `infra/deploy-reviewed.sh` and uploaded a filtered source archive to authenticated Google Cloud Shell (SHA256 `8040014f5fee12c72c34c036308bd3e2a60fe86212049d31818c6c79efbc532e`). The archive contains current working-tree changes, including uncommitted readiness fixes; it is not represented as a committed Git release. Rollback revisions observed before deployment: API `shipsure-api-00010-llp`, web `shipsure-web-00002-f89`. The deployment retains existing IAM/service identities, disables reset, sets the frontend CORS origin, and limits the backend to one instance while it still uses local demo storage. A single instance does not make storage durable.


### Reviewed release — deployment results

Both services were built and deployed from the reviewed working tree. The public frontend is https://shipsure-web-117561127510.us-central1.run.app and the API is https://shipsure-api-117561127510.us-central1.run.app. Current revisions after the approved IAM fix are **API `shipsure-api-00012-drj`** and **web `shipsure-web-00003-47g`**, each serving 100% of traffic. Backend build: `5e1014b4-8399-4789-b7ed-6fe00ac1a31e`; frontend build: `d5955d10-c3a2-417e-86e5-111f65996907`. Frontend image digest: `sha256:1057cc434827d70634e2615c713765b929effb41b4c6131b15e472d412f713ee`.

Live calls initially exposed explicit IAM denials, rather than missing local credentials. With the user's explicit approval, created project custom role `shipsureRuntimeCaller` and bound it to the existing runtime identity `117561127510-compute@developer.gserviceaccount.com`. Its only permissions are `aiplatform.endpoints.predict`, `documentai.processors.processOnline`, and `serviceusage.services.use`. No storage, deployment, or IAM administration permission was added. `infra/grant-runtime-ai-access.sh` records the approved one-time setup; it is not part of the automatic deployment script. The runtime identity is shared with other workloads that use this service account.

Verified live:

- Public frontend renders the new operations workspace and calls the deployed API. Browser chat returned an AI answer about late orders and opened the correct order panel. No browser console errors were captured during this check.
- Assistant Gemini provider is **Vertex AI**. A real tool-calling response returned `mode=ai`, the correct ₹10,54,340 past-45-day total and ledger/customer citations. Successful `provider=vertex_ai` Gemini requests are independently recorded in Cloud Logging. The first measured tool workflow took about 33 seconds including startup; this is not a steady-state latency benchmark.
- Vertex AI Search logged `policy_search provider=vertex_search outcome=success results=1` and returned a datastore source. This verifies the cloud query path, not the completeness of policy snippets or regulatory coverage.
- A newly generated synthetic PDF completed invoice analysis (`status=complete`, risk report `mode=ai`). Extracted invoice `SS-VALIDATION-001`, buyer `Example Import Test LLC`, USD 1,000 total, and 100 brake pads at USD 10 with HS 87083000 matched the synthetic input. Cloud logs show a successful Document AI RPC, followed by Gemini extraction. **The final extracted fields in this test came through the Gemini fallback; Document AI-only extraction quality remains unverified.**
- Shipping Bill and Certificate of Origin drafts generated successfully. Certificate download returned HTTP 200 and a valid one-page PDF.
- Public demo reset returns 404.
- Health returned HTTP 200 in about 0.54 seconds while extraction and browser AI requests were in progress. An earlier 10-second health probe during initial rollout timed out; the later concurrent check succeeded.
- All 38 local backend tests passed; earlier validation also passed 10 isolated browser tests, frontend lint, and production build. The cloud frontend built successfully with its default Turbopack build.

Remaining limits: structured data, profiles, uploads, and PDFs still use ephemeral local storage, despite the backend's single-instance cap. This release is a synthetic-data demo without authentication/tenant isolation. Persistent cloud storage, a fresh multi-user security review, and broader real-document accuracy/latency validation are not completed by this deployment. Cloud Build also reports that its service account lacks Logs Writer; builds succeeded and their terminal output was available, but that additional IAM role was not granted.


## Durable storage implementation — 17 October 2026

Added PostgreSQL/Cloud SQL IAM connection support and a private GCS/local object-storage adapter for profiles, invoices, and PDFs. Durable mode refuses local fallback, database pools are bounded, initial PostgreSQL seeding is serialized, and demo reset cannot drop PostgreSQL tables. Cloud storage outages return recoverable errors instead of silently resetting onboarding. Downloads remain behind the existing API.

The current public deployment still uses ephemeral storage. No paid database/bucket or additional IAM access has been created. See [PERSISTENCE.md](PERSISTENCE.md) for the concrete proposed resources, cost allowance, database-privilege setup, preservation/cutover gates, and test limitations. PostgreSQL connectivity is not yet live-verified.

Persistence validation: **53 backend tests and 10 isolated browser workflows passed**. Cloud SQL connector setup is mocked; live PostgreSQL/GCS restart verification remains an activation gate.


### Cost constraint — 17 October 2026

The user declined paid Cloud SQL provisioning and requested a free-tier hackathon prototype. Do not create the proposed SQL instance or apply its IAM/storage provisioning plan. Preserve existing public demo data during any replacement. The PostgreSQL implementation remains local and unactivated. Reassess persistence against free-tier services; a Firestore migration would require adapting the current relational business logic and must not be represented as a drop-in database-URL change.

### 2026-10-17 — Firestore preparation (local only)

Added transaction-versioned Firestore state, disposable query projections, bounded table payloads, explicit conflict/capacity responses and a create-only preservation import. Current public backup reconstructs and matches all order details, customer statements, receivables totals, stock, tasks and GST. Import tests include a newly recorded payment/task and reject existing destination records or differing profile objects. Actual Google Firestore permissions/transactions and restart persistence remain candidate-release checks; no production cutover has occurred. See FIRESTORE.md.

Firestore activation in progress after explicit IAM approval: enabled the API, created Standard Native `(default)` in `us-central1` (`freeTier: true`, PITR disabled), and private Standard bucket `shipsure-data-117561127510` (uniform access, public access prevention enforced). Granted the approved runtime identity `roles/datastore.user` in the project and `roles/storage.objectUser` on this bucket only. Imported/read back 11 tables with preserved snapshot SHA256 `cd8258b44be576ca68ce8ca1cb2e24156fe58bd7a7bbf254e4165542ca1fec29`. Re-export of the original API matched every snapshot section. Candidate build `6b5b69aa-2020-4e0d-b41c-f6edbc51062b` is being deployed with no production traffic; cutover validation remains pending.

Candidate `shipsure-api-00013-hej` passed exact API comparison against the preserved profile, masters, order list/details, full customer statements, receivables totals, stock, GST, tasks and shipments. A real Firestore stale-version transaction was rejected and all records remained unchanged. Through the candidate API, created a clearly labelled synthetic persistence task, analysed the `fta-eligible` sample, generated/downloaded a PDF, then created fresh revision `shipsure-api-00014-rov` without traffic. The task, complete shipment and identical PDF checksum survived revision recreation; original business totals/profile remained unchanged. The synthetic task was marked done rather than deleted. Final source comparison and production traffic switch are in progress.

On the next-day resume, the strict final source comparison correctly stopped cutover: the old SQLite demo had reseeded. Field comparison found 159 date/timestamp differences consistent with a one-day relative-seed shift, plus five GST calendar countdown changes; IDs, amounts, quantities, customer/profile details and other stored fields were unchanged. Both API snapshots were retained. The Firestore candidate keeps the original preserved dates; it must be checked with current-date views reconstructed from the original table payloads, not by shifting historical invoice/payment dates.

Production activation completed: `shipsure-api-00014-rov` serves 100% traffic; `shipsure-web-00004-wpp` serves 100% with scale-to-zero and a one-instance revision maximum. Reconstructed expected current-date views from the original imported tables and matched all candidate orders/details, receivables/statements, stock, GST, masters and company profile. Original tasks remained intact; the synthetic persistence task is done. The complete synthetic shipment `5d4f37a5-4497-4332-b966-98d3489a4af3` and its PDF remained available after overnight cold start. Retained the reseeded pre-cutover snapshot at `gs://shipsure-data-117561127510/shipsure/demo/backups/precutover-reseed-20261017/snapshot.json`. Post-cutover public API checks passed for health, profile, total outstanding, 11-order count, shipment status, identical PDF checksum and reset 404. Assistant provider status: available=true, provider=vertex_ai, model=gemini-2.5-flash, mode=auto, last_error=null. No Cloud SQL resource was created.

Live browser verification completed through the public frontend: Orders displays preserved historical dates with today's ageing (WML-88213: 12 Oct, five days late), mobile navigation opens Shipment History, and the persisted checked invoice opens with Shipping Bill and Certificate of Origin download links. Final Cloud Run configuration confirms request-based CPU throttling, maxScale=1 and no minimum-instance reservation for both services. Proof captured at `/tmp/shipsure-firestore-live.png`.

### 2026-10-17 — Submission handoff recheck

Re-ran all 61 backend tests successfully. ESLint passed, and Next.js 16.3.6 completed its Webpack production build with TypeScript and all 13 static pages. The default local Turbopack compiler could not bind its helper port under this host's permissions. Initial browser run exposed a hardcoded mock host that missed a build configured for 127.0.0.1:8100. Updated interception to cover all `/api/` requests and route them to the isolated backend; explicitly forced SQLite in Playwright's backend environment. All 10 browser workflows then passed in 9.4 seconds. This is a test-harness change and does not change the live app. Git diff whitespace checks passed, no tracked secrets/generated databases were found, and the limited credential-pattern scan found no private key/API-key/token patterns in the source candidates. This scan is not a complete security audit.
