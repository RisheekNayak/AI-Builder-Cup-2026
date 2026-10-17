# ShipSure web workspace

Next.js, React and TypeScript frontend for company setup, conversational assistance, orders, receivables and export invoice review.

## Development

```bash
npm ci
npm run dev
```

The default API is `http://localhost:8000`. Set `NEXT_PUBLIC_API_URL` in `.env.local` before building to use a different API. Public environment variables are compiled into browser assets.

## Checks

```bash
npm run lint
NEXT_PUBLIC_API_URL=http://127.0.0.1:8100 npm run build -- --webpack
CI=1 npm run test:e2e
```

Browser tests require Chrome and backend dependencies installed in `backend/venv`. Their API and file storage are isolated from the live application.

For cloud configuration, storage and deployment limits, see the [project README](../README.md) and [verification guide](../VALIDATION.md).
