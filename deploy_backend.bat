@echo off
echo Deploying Backend to Cloud Run...

copy Dockerfile.backend Dockerfile

gcloud run deploy shipsure-api ^
  --source . ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --project project-90c16a2d-d78d-4d57-a9b ^
  --set-env-vars="DEMO_MODE=false,GCP_PROJECT_ID=project-90c16a2d-d78d-4d57-a9b,GCP_LOCATION=us,GCP_PROCESSOR_ID=fc89b776c7c7c4ac,GCP_DATASTORE_ID=shipsure-docs_1790522145143"

del Dockerfile
echo Backend deployment complete!
