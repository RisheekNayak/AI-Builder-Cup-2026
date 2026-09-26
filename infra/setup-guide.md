# Infrastructure Setup Guide

## Google Cloud Platform Setup

1. **Create Project**: Create a new GCP project or use an existing one.
2. **Enable APIs**:
   - Document AI API
   - Vertex AI API
   - Discovery Engine API
   - Cloud Storage API

3. **Service Account**: Create a service account with the following roles:
   - Document AI User
   - Vertex AI User
   - Discovery Engine Editor
   - Storage Object Admin

4. **Document AI**:
   - Go to Document AI console
   - Create a Custom Extractor or use pre-trained processors (Invoice, etc.)
   - Note the Processor ID

5. **Vertex AI Search**:
   - Create a new Data Store in Discovery Engine
   - Upload Indian export regulations (DGFT guidelines, Customs acts) to the Data Store
   - Create a Search App and link the Data Store
   - Note the Data Store ID

6. **Environment Variables**:
   - Copy `.env.example` to `.env` and fill in the values.
