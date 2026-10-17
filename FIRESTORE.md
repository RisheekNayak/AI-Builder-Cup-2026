# Firestore persistence

The deployed configuration uses Firestore and private Cloud Storage. No Cloud SQL instance is required.

The small single-company demo uses Firestore as authoritative record storage and a private regional Cloud Storage bucket for the company profile, uploads and generated PDFs. Each API request builds a disposable relational projection in memory so existing accounting and dispatch rules remain intact. No records depend on the Cloud Run filesystem in this mode.

## Capacity and concurrency limits

- State occupies 11 table documents plus one version document. A request reads approximately 12 documents; writes update only changed tables and the version. Read-only requests do not save state.
- Each table payload is limited to 500,000 bytes. Exceeding this returns an error without saving the change. This design is for the bounded single-company dataset; larger or multiple-company workloads need record-level storage or a relational database.
- A transaction compares the version before saving. Competing writers receive HTTP 409 and must refresh before trying again. Payments and their related rows cannot silently overwrite another request's changes.
- Firestore errors propagate; the service never falls back to local persistent files. Object storage and Firestore are separate systems, so an unsuccessful upload can leave an unreferenced object.
- Free allowances are usage limits, not billing caps. Existing Gemini, Document AI, Search, builds and network usage may still incur charges. Budget alerts alone do not stop billing. No claim of guaranteed zero cost is made.

## Preservation and activation

1. `infra/export_public_demo.py` takes a read-only backup of the current API-visible records, profile and downloadable generated PDFs. Original upload bytes and unexposed internal metadata cannot be recovered through this API. The current snapshot contains 11 orders, six customer statements and no shipments/PDFs.
2. `infra/prepare_firestore_import.py` rebuilds the relational records and compares all order details, full customer statements, receivables totals, stock, tasks and GST before producing table payloads. Internal timestamps and dispatch-line IDs unavailable through the old API are reconstructed.
3. Provision/check the project's default Native Firestore database and a private Standard bucket in us-central1. Enable uniform bucket access and public access prevention. Avoid optional paid database backup/PITR features for this deployment. Verify eligibility and aggregate account usage against Google's current free allowances.
4. After explicit IAM approval, grant the runtime identity database data access and Storage Object User on that bucket only. No IAM administration or public bucket access is needed. The existing compute identity is shared: the grant applies to every workload using it.
5. Run `infra/import_firestore_demo.py` with approved project credentials and GCS environment settings. It validates the snapshot again, verifies object checksums, creates a raw snapshot backup, imports only into an empty database state and verifies Firestore readback. It never switches traffic.
6. Deploy a candidate with no production traffic. Verify visible data, a durable write after instance recreation, company profile and PDF storage, then recheck the source demo for changes before switching traffic. If source data changed, stop and reconcile; do not discard it.

Environment for the candidate:

```text
SHIPSURE_DATABASE_BACKEND=firestore
SHIPSURE_FIRESTORE_DATABASE=(default)
SHIPSURE_STORAGE_BACKEND=gcs
SHIPSURE_STORAGE_BUCKET=shipsure-data-117561127510
SHIPSURE_STORAGE_PREFIX=shipsure/demo
SHIPSURE_REQUIRE_DURABLE_STORAGE=true
ENABLE_DEMO_RESET=false
```

Use scale-to-zero/request-based Cloud Run billing and bounded maximum instances. Do not set a Cloud SQL connection in this mode. Preserve the pre-migration API backup separately from service revisions; rollback to the old SQLite image cannot restore new Firestore writes automatically.

## Verification

Local tests cover durable session recreation, competing payments, atomic dispatch/invoice state, cloud commit failure, read-only operation, table size limits and create-only import with modified demo data. These tests use an in-memory Firestore contract substitute; actual Firestore transaction behavior and permissions must still be verified against the cloud candidate before cutover.

## Date behaviour after preservation

The old ephemeral demo seeded sample dates relative to its startup date. On a new day, a fresh old-service instance can therefore appear to change every order/invoice/payment date even without business edits. Firestore retains the originally preserved dates. Ageing, overdue days and statutory calendar countdowns continue to use the actual current date. A cross-day verification must rebuild expected views from the preserved tables for today's date, rather than expect yesterday's derived API responses to remain identical. Do not shift stored invoice/payment dates to make a snapshot comparison pass.
