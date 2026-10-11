# Build from the repository root: docker build -f backend/Dockerfile .
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY knowledge-base ./knowledge-base
COPY test-data/invoices ./test-data/invoices

EXPOSE 8000

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "backend.main:app"]
