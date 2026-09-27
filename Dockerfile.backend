FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY knowledge-base/ ./knowledge-base/
COPY test-data/ ./test-data/

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8080", "backend.main:app"]
