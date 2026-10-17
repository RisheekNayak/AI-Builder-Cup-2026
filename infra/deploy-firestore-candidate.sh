#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT=project-90c16a2d-d78d-4d57-a9b
REGION=us-central1
# Requires the approved IAM grants and a successful preserved-demo import first.
# This command deliberately leaves existing production traffic on its current revision.
gcloud run deploy shipsure-api --source=. --project="$PROJECT" --region="$REGION" \
  --no-traffic --tag=firestore-review --port=8080 --timeout=180 \
  --min-instances=0 --max-instances=1 --cpu-throttling --concurrency=8 \
  --update-env-vars='^|^SHIPSURE_DATABASE_BACKEND=firestore|SHIPSURE_FIRESTORE_DATABASE=(default)|SHIPSURE_STORAGE_BACKEND=gcs|SHIPSURE_STORAGE_BUCKET=shipsure-data-117561127510|SHIPSURE_STORAGE_PREFIX=shipsure/demo|SHIPSURE_REQUIRE_DURABLE_STORAGE=true|ENABLE_DEMO_RESET=false' \
  --quiet
gcloud run services describe shipsure-api --project="$PROJECT" --region="$REGION" --format='yaml(status.latestReadyRevisionName,status.traffic)'
