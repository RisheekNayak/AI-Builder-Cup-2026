#!/usr/bin/env bash
# Run only after explicit approval: this expands the runtime service account's IAM permissions.
set -euo pipefail
PROJECT=project-90c16a2d-d78d-4d57-a9b
ROLE=shipsureRuntimeCaller
MEMBER=serviceAccount:117561127510-compute@developer.gserviceaccount.com
# Deliberately excludes storage access, deployment, IAM administration and resource creation.
gcloud iam roles create "$ROLE" --project="$PROJECT" \
  --title='ShipSure Runtime AI Caller' \
  --description='Invoke Gemini and online Document AI processing for ShipSure' \
  --permissions=aiplatform.endpoints.predict,documentai.processors.processOnline,serviceusage.services.use \
  --stage=GA
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="$MEMBER" --role="projects/$PROJECT/roles/$ROLE" --condition=None
