# ShipSure

ShipSure is an operations and export-compliance workspace for manufacturers. It connects customer orders, dispatches, receivables and export invoice checks with an assistant that links answers to business records.

## Features

- Company onboarding and profile settings.
- English and Hinglish questions about orders, payments and shipments.
- Orders, partial dispatches, linked invoices, payment allocation and customer statements.
- Tasks, stock preview and GST preview.
- Invoice upload, editable extraction, FTA eligibility and SCOMET screening.
- Compliance explanations with retrieved policy context when available.
- Draft Shipping Bill and Certificate of Origin PDFs, shipment history and downloads.

Generated documents require human review. The application does not file on government portals. End User Undertaking generation is not supported. Stock and GST views are previews.

## Architecture

The Next.js frontend and FastAPI backend run on Cloud Run. Gemini on Vertex AI supports explanations and document understanding, with Document AI and Vertex AI Search integrations. Deterministic rules support business calculations and screening.

Firestore stores the deployed single-company dataset. Each request uses a disposable SQLAlchemy projection, and versioned transactions reject conflicting writes. Private Cloud Storage holds the company profile, uploads and generated PDFs. SQLite and local files support development.

See [storage](PERSISTENCE.md), [Firestore design](FIRESTORE.md), and [verification and operations](VALIDATION.md).

## Local development

Use Python 3.11 or newer and Node.js 22.

From the repository root:

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
python -m uvicorn backend.main:app --reload --port 8000
```

For local use without cloud calls, set `DEMO_MODE=true` and `ASSISTANT_MODE=offline` in `.env`. Sample JSON invoices and deterministic business workflows work offline. Real PDF/image extraction and AI answers require configured cloud services and credentials.

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000. The frontend defaults to http://localhost:8000 for the API. Set `NEXT_PUBLIC_API_URL` before building to use another API URL.

## Cloud configuration

Use Application Default Credentials locally and a runtime service identity on Cloud Run. Do not commit service-account keys or environment secrets.

For cloud integrations, configure `GCP_PROJECT_ID`, `GCP_PROCESSOR_ID`, `GCP_DOCAI_LOCATION`, `GCP_DATASTORE_ID`, `GEMINI_MODEL_NAME` and `GEMINI_LOCATION`. Use `DEMO_MODE=false` and `ASSISTANT_MODE=auto`. Restrict `CORS_ORIGINS` to the frontend origins you intend to serve.

The deployed storage mode requires `SHIPSURE_DATABASE_BACKEND=firestore`, `SHIPSURE_STORAGE_BACKEND=gcs`, a configured bucket and `SHIPSURE_REQUIRE_DURABLE_STORAGE=true`. Import existing records before starting an empty Firestore deployment. Keep `ENABLE_DEMO_RESET=false` outside isolated development tests.

The root Dockerfile builds the API. `frontend/Dockerfile` requires `NEXT_PUBLIC_API_URL` as a build argument. Deployment scripts under `infra/` contain environment-specific settings and must be reviewed before use. Deploy and verify a candidate before switching production traffic.

## Verification

```bash
PYTHONPATH=. backend/venv/bin/python -m pytest backend/tests -q
cd frontend
npm run lint
NEXT_PUBLIC_API_URL=http://127.0.0.1:8100 npm run build -- --webpack
CI=1 npm run test:e2e
```

GitHub Actions runs backend tests, lint, a production build and browser tests on pushes and pull requests.

Browser tests use Chrome, a disposable SQLite database and isolated API/frontend servers. They intercept API requests to prevent writes to the live service. See [VALIDATION.md](VALIDATION.md) for operational checks and recovery considerations.

## Deployment limits

The current application uses shared single-company state and does not implement user authentication or tenant isolation. The Firestore adapter bounds each table payload to 500,000 bytes. It is not a general enterprise ERP or an independently certified compliance service.

Enterprise deployment requires authentication, authorization and tenant isolation, an appropriate storage model, tested backup recovery, monitoring and an agreed availability target. Passing functional tests does not guarantee continuous availability. Free cloud allowances are usage thresholds, not billing caps; AI, storage, builds and network usage may incur charges.

## Repository

- `backend/`: API, business rules, storage adapters and tests.
- `frontend/`: web workspace and browser tests.
- `knowledge-base/`: local policy and screening data.
- `test-data/`: synthetic invoices and purchase orders.
- `infra/`: deployment, preservation and migration utilities.
- `output/presentations/`: submission presentation.
