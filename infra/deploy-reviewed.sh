#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT=project-90c16a2d-d78d-4d57-a9b
REGION=us-central1
API_URL=https://shipsure-api-117561127510.us-central1.run.app
WEB_URL=https://shipsure-web-117561127510.us-central1.run.app
IMAGE=us-central1-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/shipsure-web:reviewed-20261016
# Record rollback identities without exporting environment variable values.
gcloud run services describe shipsure-api --project="$PROJECT" --region="$REGION" --format='value(status.latestReadyRevisionName)'
gcloud run services describe shipsure-web --project="$PROJECT" --region="$REGION" --format='value(status.latestReadyRevisionName)'
# Preserve the existing service identity, access policy and cloud resource IDs.
gcloud run deploy shipsure-api --source=. --project="$PROJECT" --region="$REGION" --port=8080 --timeout=180 --max-instances=1 --update-env-vars="^|^ENABLE_DEMO_RESET=false|ASSISTANT_MODE=auto|GCP_DOCAI_LOCATION=us|CORS_ORIGINS=$WEB_URL|GEMINI_MODEL_NAME=gemini-2.5-flash" --quiet
curl --fail --max-time 30 "$API_URL/health"
curl --fail --max-time 30 "$API_URL/api/assistant/status"
gcloud builds submit frontend --config=frontend/cloudbuild.yaml --project="$PROJECT" --substitutions="_API_URL=$API_URL,_IMAGE=$IMAGE" --quiet
gcloud run deploy shipsure-web --image="$IMAGE" --project="$PROJECT" --region="$REGION" --port=8080 --quiet
curl --fail --max-time 60 --output /dev/null --write-out 'Frontend HTTP %{http_code}\n' "$WEB_URL"
printf '\nReviewed deployment completed. Run live integration checks before declaring readiness.\n'
