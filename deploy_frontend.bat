@echo off
echo Deploying Frontend to Cloud Run...
cd frontend
gcloud run deploy shipsure-web ^
  --source . ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --project project-90c16a2d-d78d-4d57-a9b ^
  --port 8080
echo Frontend deployment complete!
