@echo off
echo Deploying Backend to Cloud Run...
pushd "%~dp0"

gcloud run deploy shipsure-api ^
  --source . ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --project project-90c16a2d-d78d-4d57-a9b ^
  --update-env-vars="DEMO_MODE=false,ENABLE_DEMO_RESET=false,GCP_PROJECT_ID=project-90c16a2d-d78d-4d57-a9b,GCP_DOCAI_LOCATION=us,GCP_PROCESSOR_ID=fc89b776c7c7c4ac,GCP_DATASTORE_ID=shipsure-docs_1790522145143"

if errorlevel 1 (
  popd
  exit /b 1
)
popd
echo Backend deployment complete!
