# Storage

## Deployed configuration

Business records use Firestore. Company profiles, original uploads and generated PDFs use a private Cloud Storage bucket. The application serves downloads through the API. Cloud storage errors propagate instead of silently switching to local files or empty records.

See [FIRESTORE.md](FIRESTORE.md) for the versioned state adapter and its capacity/concurrency limits.

## Development and alternative database support

Local development uses SQLite and local object storage. The repository also contains PostgreSQL URL and Cloud SQL IAM connector support. These paths do not imply that a Cloud SQL instance is provisioned or that PostgreSQL has passed live integration validation.

`SHIPSURE_REQUIRE_DURABLE_STORAGE=true` rejects local storage combinations at startup. Keep destructive demo reset disabled on deployed environments.

## Preservation and recovery

The export/import utilities preserve API-visible business records and downloadable documents. An API export cannot recover original uploads or internal metadata that the old API never exposed. Preserve original backups separately from application revisions and verify imports before switching traffic.

A service revision rollback does not roll back the database or object storage. Account for writes made after a release before any storage migration or rollback. Test recovery in a separate environment before relying on it for an availability commitment.
