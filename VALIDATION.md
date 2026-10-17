# Verification and operations

## Automated checks

Run from the repository root:

```bash
PYTHONPATH=. backend/venv/bin/python -m pytest backend/tests -q
```

Then run in `frontend/`:

```bash
npm ci
npm run lint
NEXT_PUBLIC_API_URL=http://127.0.0.1:8100 npm run build -- --webpack
CI=1 npm run test:e2e
```

The browser suite requires Chrome. It starts isolated test servers and uses temporary SQLite and object storage. Cloud AI is disabled during these tests. A successful local suite does not prove live cloud permissions or extraction accuracy.

## Release checks

1. Record the currently serving image/revision and traffic configuration.
2. Deploy a candidate with no production traffic and preserve the existing runtime identity and storage settings.
3. Check `/health`, company profile loading, orders, receivables, stock and GST views. `/health` reports application liveness, not a complete dependency or availability assessment.
4. Inspect `/api/assistant/status`. Provider configuration alone does not prove an AI request succeeds. Use an approved synthetic document to verify integrations when necessary.
5. Verify upload, analysis, PDF generation and download. Check saved data and PDF contents after creating a fresh revision.
6. Confirm destructive reset remains disabled, then switch traffic only after checks pass.
7. Inspect logs and verify the public frontend against the released API.

## Data integrity

Compare full order details, customer statements, payments, stock, tasks and GST records during migrations. Version conflicts must fail visibly without silently losing another request's write. Missing objects and cloud service failures must remain distinguishable.

Stored invoice/payment dates must remain unchanged across restarts. Derived ageing and calendar countdowns change with the current date. Compare reconstructed current-date views when validating a backup taken on a previous day.

## Operational requirements

Define availability and latency objectives before promising an SLA. Configure monitoring and alerts for API errors, dependency failures, latency and storage limits. Establish backups, retention and a tested recovery procedure. A revision rollback alone cannot restore database state or reverse later business writes.

The current shared workspace lacks authentication and tenant isolation. Functional tests, concurrency checks and restart persistence do not establish enterprise security, load capacity or regulatory certification.
