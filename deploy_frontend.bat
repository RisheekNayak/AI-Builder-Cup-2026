@echo off
setlocal
if "%~1"=="" (
  echo Usage: deploy_frontend.bat https://BACKEND_URL REGION-docker.pkg.dev/PROJECT/REPOSITORY/shipsure-web:TAG
  exit /b 1
)
if "%~2"=="" (
  echo Supply a tagged image path in an existing Artifact Registry repository.
  exit /b 1
)
pushd "%~dp0frontend"
gcloud builds submit . --config cloudbuild.yaml --project project-90c16a2d-d78d-4d57-a9b --substitutions="_API_URL=%~1,_IMAGE=%~2"
if errorlevel 1 (
  popd
  exit /b 1
)
gcloud run deploy shipsure-web ^
  --image "%~2" ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --project project-90c16a2d-d78d-4d57-a9b ^
  --port 8080
if errorlevel 1 (
  popd
  exit /b 1
)
popd
echo Frontend deployment complete!
