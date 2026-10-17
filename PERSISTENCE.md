# Durable storage release — prepared 17 October 2026

This is the historical, unactivated Cloud SQL proposal. The live free-allowance prototype uses Firestore and private GCS instead; see [FIRESTORE.md](FIRESTORE.md).

Status: implemented and locally tested; **not provisioned or activated in Cloud Run**.

## Design

Business records use SQLAlchemy with PostgreSQL. `SHIPSURE_CLOUD_SQL_INSTANCE`, `SHIPSURE_DB_USER`, and `SHIPSURE_DB_NAME` select the official Cloud SQL Python connector with automatic IAM database authentication and lazy refresh. No database password is stored in the application. The pool allows three connections plus two overflow connections per worker. SQLite remains the local development default.

Company profiles, uploaded invoices, and generated PDFs go through `backend/services/storage.py`. `SHIPSURE_STORAGE_BACKEND=gcs` requires `SHIPSURE_STORAGE_BUCKET`. Keys are private, prefixed with `shipsure/demo` by default. PDF downloads continue through the API; no public bucket URLs are introduced. Bucket IAM does not add end-user authentication to the existing API.

`SHIPSURE_REQUIRE_DURABLE_STORAGE=true` makes startup reject SQLite or local file storage. PostgreSQL initialization uses a transaction advisory lock to serialize initial schema creation and demo seeding. Demo reset is refused for PostgreSQL even if its development flag/token are enabled. This initializes a new database; it is not a schema migration framework for future table changes.

Missing objects return not-found behavior; cloud permission/network failures do not silently become empty profiles or local files. Re-analysis invalidates generated-form metadata so old PDFs cannot be downloaded. Old objects are retained for recovery rather than deleting data before the database transaction commits. Set a reviewed lifecycle/cleanup policy later if required.

## Proposed cloud resources (not created)

- Project: `project-90c16a2d-d78d-4d57-a9b`.
- Region: `us-central1`, alongside the current Cloud Run services.
- Cloud SQL: PostgreSQL 16 Enterprise, zonal `db-f1-micro`, 10 GB SSD, scheduled backups. This is a small demo tier, without high availability or the shared-core SLA. It adds an ongoing bill even when the app is idle.
- Bucket: `shipsure-data-117561127510`, Standard storage in `us-central1`, uniform bucket-level access and enforced public-access prevention. Keep it separate from the policy knowledge-base bucket.
- Runtime identity: the existing `117561127510-compute@developer.gserviceaccount.com`. Add Cloud SQL Client and Cloud SQL Instance User access for the new database, plus Storage Object User access **only on the new bucket**. It is a shared identity; a dedicated runtime account remains a future hardening step.
- SQL authorization: create the IAM database user `117561127510-compute@developer`. An administrator must grant this user ownership/access to the application database/schema; IAM login alone grants no schema privileges. Do not give the runtime PostgreSQL superuser or project administrator access.

Provisional planning allowance: US$25/month for a small Cloud SQL + object-storage demo, **not a quote or hard billing cap**, excluding existing Cloud Run, Gemini, Search, and Document AI costs. Confirm the current regional price/configuration before creating resources. Provisioning and IAM expansion require explicit approval.

References: [Cloud SQL pricing](https://cloud.google.com/sql/pricing), [Cloud SQL IAM database users](https://docs.cloud.google.com/sql/docs/postgres/add-manage-iam-users), [official Python connector](https://github.com/GoogleCloudPlatform/cloud-sql-python-connector).

## Activation and migration gates

1. Approve the ongoing resource cost and exact IAM changes. Enable the Cloud SQL Admin API, provision the private resources, create the IAM database user, and grant its schema privileges through an administrator.
2. Capture and reconcile existing demo records/profile/documents **before replacing the current ephemeral backend**. The application's existing local files cannot be retrieved with a Cloud Run deployment command. Do not claim that simply changing the database URL migrates them. Obtain approval for a clean synthetic-data seed if preserving the old demo is unnecessary.
3. Test PostgreSQL connectivity/schema/seed with the actual IAM runtime identity. Local tests currently verify the connector configuration with mocks and record-reopen behavior with SQLite; they do not establish real PostgreSQL/cloud connectivity.
4. Import the approved profile/uploads/forms into the private bucket. Retain the old revision and export for rollback.
5. Build the backend with the storage changes. Deploy a revision with no public traffic and set:

```text
SHIPSURE_CLOUD_SQL_INSTANCE=project-90c16a2d-d78d-4d57-a9b:us-central1:shipsure-db
SHIPSURE_DB_USER=117561127510-compute@developer
SHIPSURE_DB_NAME=shipsure
SHIPSURE_STORAGE_BACKEND=gcs
SHIPSURE_STORAGE_BUCKET=shipsure-data-117561127510
SHIPSURE_STORAGE_PREFIX=shipsure/demo
SHIPSURE_REQUIRE_DURABLE_STORAGE=true
ENABLE_DEMO_RESET=false
```

6. Verify saving a profile, a task/payment/dispatch, a synthetic upload, and generated PDFs on the candidate revision. Restart/redeploy and confirm those exact records and bytes survive. Check no extra seed rows appeared. Verify local disk/GCS failures fail visibly.
7. Move public traffic only after the persistence checks pass. Keep using synthetic data: authentication and tenant isolation are separate outstanding requirements.

## Local verification

```bash
backend/venv/bin/python -m pip install -r backend/requirements.txt
backend/venv/bin/python -m pytest backend/tests -q
cd frontend
npm run test:e2e
```

Backend tests isolate both their database and document root. Browser tests use a separate backend/database/document root and offline AI. No paid database, bucket, new IAM grant, or live cutover has occurred as part of this implementation.

Persistence validation: **53 backend tests and 10 isolated browser workflows passed**. Cloud SQL connector setup is mocked; live PostgreSQL/GCS restart verification remains an activation gate.


### Cost constraint — 17 October 2026

The user declined paid Cloud SQL provisioning and requested a free-tier hackathon prototype. Do not create the proposed SQL instance or apply its IAM/storage provisioning plan. Preserve existing public demo data during any replacement. The PostgreSQL implementation remains local and unactivated. Reassess persistence against free-tier services; a Firestore migration would require adapting the current relational business logic and must not be represented as a drop-in database-URL change.
