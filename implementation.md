# 🏗️ ShipSure — Implementation Plan

> **Approach:** Multi-agent parallel execution. Each agent owns a vertical slice of the system.  
> **Deadline:** October 18, 2026  
> **Start:** September 27, 2026 (3 full weeks)

---

## ⏭️ Next Session Quick Start (What's Left)
* **Pre-requisite:** Update local Node.js to `>= 20.9.0` (currently v18.17.0) to run the Next.js frontend (`npm run dev`).
* **Phase 2 (Cloud Infra):** Provision Google Cloud resources (Document AI Processor, Vertex AI Search datastore, GCS buckets, Cloud SQL) and update `.env`.
* **Phase 3 (Backend Logic):** The backend files are scaffolded, but we need to write the actual Python logic inside `services/document_ai.py`, `services/vertex_search.py`, `services/gemini.py`, and `services/compliance_engine.py`.
* **Phases 5-7 (Test, Deploy, Submit):** Run end-to-end tests with our pre-built test invoices, deploy both apps to Google Cloud Run, and record the demo video.

---

## Agent Roster

| Agent ID | Role | Responsibility |
|----------|------|----------------|
| 🔬 **KB-Agent** | Knowledge Base Researcher | Finds, downloads, curates, and validates all Indian regulatory PDFs for the RAG corpus |
| ⚙️ **Backend-Agent** | Backend Engineer | Builds FastAPI server, Document AI integration, Gemini reasoning pipeline, PDF generation |
| 🎨 **Frontend-Agent** | Frontend Engineer | Builds Next.js 14 dashboard — TradeAdvisor chat, invoice upload, risk report, form download |
| ☁️ **Infra-Agent** | Cloud Infrastructure Engineer | Provisions Google Cloud services — Vertex AI Search datastore, Cloud Run, Cloud SQL, Cloud Storage |
| 🧪 **QA-Agent** | Quality Assurance & Demo Tester | Creates test invoices, validates end-to-end flows, catches edge cases, and rehearses demo scenarios |

---

## Repository Structure (Target)

```
AI-Builder-Cup-2026/
├── idea.md
├── design.md
├── implementation.md                ← This file
├── README.md
│
├── knowledge-base/                  ← KB-Agent owns this
│   ├── raw/                         # Original downloaded PDFs
│   │   ├── dgft-scomet-appendix3.pdf
│   │   ├── dgft-ftp-2023.pdf
│   │   ├── india-uae-cepa-rules-of-origin.pdf
│   │   ├── icegate-shipping-bill-format.pdf
│   │   └── itc-hs-classification-schedule.pdf
│   ├── processed/                   # Cleaned text extracts (for validation)
│   │   └── scomet-categories.json
│   ├── deterministic/               # Tier 1 fast-lookup tables
│   │   ├── scomet-keywords.json     # Category → keyword mapping
│   │   ├── common-hs-codes.json     # Top 50 exported items
│   │   └── fta-agreements.json      # India FTA metadata
│   └── README.md                    # KB-Agent documents all sources
│
├── backend/                         ← Backend-Agent owns this
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                      # FastAPI app entrypoint
│   ├── config.py                    # Environment & GCP config
│   ├── routers/
│   │   ├── upload.py                # POST /api/upload
│   │   ├── extraction.py            # GET /api/shipments/{id}/extraction
│   │   ├── compliance.py            # GET /api/shipments/{id}/risk-report
│   │   ├── forms.py                 # POST /api/shipments/{id}/generate-forms
│   │   ├── advisor.py               # POST /api/advisor/chat
│   │   └── company.py               # CRUD /api/company-profile
│   ├── services/
│   │   ├── document_ai.py           # Google Document AI wrapper
│   │   ├── vertex_search.py         # Vertex AI Search query client
│   │   ├── gemini.py                # Gemini 1.5 Pro reasoning client
│   │   ├── compliance_engine.py     # Orchestrator: DocAI → Search → Gemini
│   │   ├── form_generator.py        # PDF generation with reportlab
│   │   └── deterministic.py         # Tier 1 fast JSON lookup
│   ├── models/
│   │   ├── shipment.py              # Pydantic models for shipment data
│   │   ├── company.py               # Pydantic models for company profile
│   │   └── risk_report.py           # Pydantic models for risk output
│   ├── templates/
│   │   ├── shipping_bill.py         # Shipping Bill PDF template layout
│   │   ├── certificate_of_origin.py # CoO PDF template layout
│   │   └── end_user_undertaking.py  # EUU PDF template layout
│   └── tests/
│       ├── test_document_ai.py
│       ├── test_compliance.py
│       └── test_form_gen.py
│
├── frontend/                        ← Frontend-Agent owns this
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout with sidebar nav
│   │   │   ├── page.tsx             # Dashboard home
│   │   │   ├── advisor/
│   │   │   │   └── page.tsx         # TradeAdvisor chat interface
│   │   │   ├── shipments/
│   │   │   │   ├── page.tsx         # Shipment history list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx     # Upload new invoice
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Individual shipment report
│   │   │   └── settings/
│   │   │       └── page.tsx         # Company profile setup
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   └── RecentShipments.tsx
│   │   │   ├── advisor/
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   └── MessageBubble.tsx
│   │   │   ├── shipments/
│   │   │   │   ├── UploadZone.tsx
│   │   │   │   ├── ExtractionCard.tsx
│   │   │   │   ├── RiskScoreBadge.tsx
│   │   │   │   ├── RiskFlagList.tsx
│   │   │   │   └── FormDownloadPanel.tsx
│   │   │   └── settings/
│   │   │       └── CompanyProfileForm.tsx
│   │   └── lib/
│   │       ├── api.ts               # Backend API client
│   │       └── types.ts             # TypeScript interfaces
│   └── public/
│       └── logo.svg
│
├── test-data/                       ← QA-Agent owns this
│   ├── invoices/
│   │   ├── invoice-clean-pass.pdf       # Standard goods → should pass
│   │   ├── invoice-scomet-flag.pdf      # Dual-use item → should flag
│   │   └── invoice-fta-eligible.pdf     # UAE destination → should suggest CoO
│   ├── expected-outputs/
│   │   ├── extraction-clean.json
│   │   ├── risk-report-scomet.json
│   │   └── generated-coo-sample.pdf
│   └── test-plan.md
│
└── infra/                           ← Infra-Agent owns this
    ├── cloudbuild.yaml              # CI/CD pipeline for Cloud Build
    ├── terraform/ (optional)
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── setup-guide.md               # Manual GCP setup instructions
```

---

## Implementation Steps (Ordered by Dependency)

### Phase 0: Project Bootstrap (Day 1 — Sep 27)
> **Status: ✅ Complete** (Workspace, Next.js, FastAPI scaffolds generated)
> **All agents collaborate**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| 0.1 | Initialize Git repo, create folder structure above | Infra-Agent | — | Clean repo with all directories |
| 0.2 | Create Google Cloud Project, enable APIs (Document AI, Vertex AI, Cloud Run, Cloud Storage, Cloud SQL) | Infra-Agent | — | GCP Project ID, service account key |
| 0.3 | Scaffold Next.js 14 app with TypeScript + Tailwind + shadcn/ui | Frontend-Agent | 0.1 | Working `npm run dev` |
| 0.4 | Scaffold FastAPI app with Pydantic, uvicorn, health check endpoint | Backend-Agent | 0.1 | Working `uvicorn main:app` |
| 0.5 | Create `.env.example` with all required GCP config variables | Infra-Agent | 0.2 | Documented environment template |

---

### Phase 1: Knowledge Base Curation (Days 2–4 — Sep 28–30)
> **Status: ✅ Complete** (All deterministic JSON lookups, test invoices, and README instructions created)
> **KB-Agent works independently. This is the foundation — everything depends on it.**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| 1.1 | Download **DGFT SCOMET Appendix 3** (latest notification) from `dgft.gov.in` | KB-Agent | — | `knowledge-base/raw/dgft-scomet-appendix3.pdf` |
| 1.2 | Download **ITC(HS) Classification Schedule** (Chapters 84–90: Machinery, Electronics, Instruments) | KB-Agent | — | `knowledge-base/raw/itc-hs-classification-schedule.pdf` |
| 1.3 | Download **India–UAE CEPA Rules of Origin** operational guidelines from `commerce.gov.in` | KB-Agent | — | `knowledge-base/raw/india-uae-cepa-rules-of-origin.pdf` |
| 1.4 | Download **ICEGATE Shipping Bill Message Format** specification from `icegate.gov.in` | KB-Agent | — | `knowledge-base/raw/icegate-shipping-bill-format.pdf` |
| 1.5 | Download **DGFT Foreign Trade Policy (FTP 2023)** Handbook of Procedures (relevant chapters on export documentation) | KB-Agent | — | `knowledge-base/raw/dgft-ftp-2023.pdf` |
| 1.6 | Extract and curate a **deterministic JSON lookup** of the top 50 commonly exported Indian manufactured goods with their ITC-HS codes and SCOMET status | KB-Agent | 1.1, 1.2 | `knowledge-base/deterministic/common-hs-codes.json` |
| 1.7 | Extract **SCOMET keyword tags** per category (Category 0–8) for fast Tier 1 screening | KB-Agent | 1.1 | `knowledge-base/deterministic/scomet-keywords.json` |
| 1.8 | Create **FTA metadata JSON** listing active Indian FTAs with partner countries and key duty concession rates | KB-Agent | 1.3 | `knowledge-base/deterministic/fta-agreements.json` |
| 1.9 | Write `knowledge-base/README.md` documenting every source URL, download date, and notification number | KB-Agent | 1.1–1.8 | Provenance documentation |

---

### Phase 2: Cloud Infrastructure Setup (Days 2–5 — Sep 28–Oct 1)
> **Infra-Agent works in parallel with KB-Agent**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| 2.1 | Create **Cloud Storage bucket** (`gs://shipsure-docs`) with folders: `uploads/`, `generated/`, `compliance-corpus/` | Infra-Agent | 0.2 | GCS bucket ready |
| 2.2 | Upload all KB-Agent PDFs to `gs://shipsure-docs/compliance-corpus/` | Infra-Agent | 1.1–1.5, 2.1 | PDFs in GCS |
| 2.3 | Create **Vertex AI Search Datastore** (Unstructured Documents), point to compliance-corpus GCS path, trigger ingestion | Infra-Agent | 2.2 | Datastore ID, indexing complete |
| 2.4 | Create **Document AI Invoice Parser** processor in the GCP console | Infra-Agent | 0.2 | Processor ID |
| 2.5 | Provision **Cloud SQL (PostgreSQL 15)** instance with database `shipsure_db` | Infra-Agent | 0.2 | Connection string |
| 2.6 | Create database tables: `companies`, `shipments`, `extracted_data`, `risk_reports`, `generated_forms` | Infra-Agent | 2.5 | Schema ready |
| 2.7 | Test Vertex AI Search with a sample query: *"Is HS code 8501 classified under SCOMET?"* — verify citations are returned | Infra-Agent | 2.3 | Validated search results with page citations |
| 2.8 | Document all resource IDs, connection strings, and config in `infra/setup-guide.md` | Infra-Agent | 2.1–2.7 | Complete setup guide |

---

### Phase 3: Backend Core Services (Days 4–10 — Sep 30–Oct 6)
> **Status: 🟡 In Progress** (All service/router/model files scaffolded. Awaiting logic implementation)
> **Backend-Agent builds the AI pipeline. This is the heart of ShipSure.**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| **3.1** | **`services/document_ai.py`** — Build Document AI wrapper: accepts PDF bytes → calls Google Document AI Invoice Parser → returns structured `ExtractedData` Pydantic model (seller, buyer, items, HS codes, values) | Backend-Agent | 2.4 | Working extraction from sample invoice |
| **3.2** | **`services/deterministic.py`** — Build Tier 1 fast lookup: loads `scomet-keywords.json` and `common-hs-codes.json` → instant keyword match for known SCOMET items | Backend-Agent | 1.6, 1.7 | Fast pre-screening results |
| **3.3** | **`services/vertex_search.py`** — Build Vertex AI Search client: accepts a query string → searches the compliance datastore → returns top-k chunks with page citations | Backend-Agent | 2.3, 2.7 | Retrieved policy passages with citations |
| **3.4** | **`services/gemini.py`** — Build Gemini 1.5 Pro client with two modes: | Backend-Agent | 0.2 | |
| | — **Compliance Mode:** Accepts extracted data + retrieved policy chunks → returns structured `RiskReport` JSON (risk score, flags, citations, required forms) | | | Structured risk assessment |
| | — **Advisor Mode:** Accepts user question → uses Vertex AI Search grounding + Google Search grounding → returns conversational answer with citations | | | Grounded chat response |
| **3.5** | **`services/compliance_engine.py`** — Build the **orchestrator**: chains `document_ai.py` → `deterministic.py` → `vertex_search.py` → `gemini.py` into a single pipeline that takes a PDF and returns a complete `RiskReport` | Backend-Agent | 3.1–3.4 | End-to-end pipeline working |
| **3.6** | **`services/form_generator.py`** — Build PDF generator using `reportlab`: | Backend-Agent | 1.4 | |
| | — Accepts `CompanyProfile` + `ExtractedData` + `RiskReport` | | | |
| | — Renders **Shipping Bill Checklist PDF** (IEC, AD Code, port codes, item details, RoDTEP flags) | | | Generated PDF file |
| | — Renders **Certificate of Origin PDF** (exporter/consignee, HS codes, origin criteria, signatory block) | | | Generated PDF file |
| | — Renders **End-User Undertaking PDF** (if SCOMET flagged) | | | Generated PDF file |
| **3.7** | **`routers/company.py`** — CRUD endpoints for Company Master Profile (IEC, GSTIN, PAN, AD Code, signatory) stored in Cloud SQL | Backend-Agent | 2.5, 2.6 | Working profile save/load |
| **3.8** | **`routers/upload.py`** — Upload endpoint: receives PDF → stores in GCS → creates `shipment` record in DB → triggers extraction | Backend-Agent | 2.1, 3.1 | Upload flow working |
| **3.9** | **`routers/compliance.py`** — Triggers the compliance engine for a shipment, stores `RiskReport` in DB | Backend-Agent | 3.5 | Risk report endpoint |
| **3.10** | **`routers/forms.py`** — Triggers form generation, stores generated PDFs in GCS, returns download URLs | Backend-Agent | 3.6, 3.7 | Form download endpoint |
| **3.11** | **`routers/advisor.py`** — TradeAdvisor chat endpoint: receives user message → Gemini Advisor Mode → returns grounded response | Backend-Agent | 3.4 | Chat endpoint working |

---

### Phase 4: Frontend Build (Days 6–14 — Oct 2–Oct 10)
> **Status: ✅ Complete** (All Next.js pages, layouts, API clients, and types generated)
> **Frontend-Agent starts once backend health check and basic API contracts are defined.**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| **4.1** | **`lib/api.ts` + `lib/types.ts`** — Define TypeScript interfaces matching backend Pydantic models and API client functions | Frontend-Agent | 3.7, 3.8 (API contracts) | Type-safe API layer |
| **4.2** | **Layout** — Build root layout with responsive sidebar navigation (Dashboard, TradeAdvisor, Shipments, Settings) + header with ShipSure logo | Frontend-Agent | 0.3 | App shell |
| **4.3** | **Settings Page** — Company Profile form (IEC, GSTIN, PAN, AD Code, Factory Address, Signatory) with save/load from backend | Frontend-Agent | 3.7, 4.1 | Working profile page |
| **4.4** | **Upload Page** — Drag-and-drop zone with progress stepper (Uploading → Extracting → Analyzing → Done), redirects to report page | Frontend-Agent | 3.8, 4.1 | Upload flow |
| **4.5** | **Report Page** — Three-card layout: | Frontend-Agent | 3.9, 3.10, 4.1 | |
| | — **Extraction Card:** Clean table of parsed invoice fields | | | |
| | — **Risk Assessment Card:** Color-coded badge (🟢🟡🔴), expandable flag list with policy citations | | | |
| | — **Forms Panel:** "Generate Required Forms" button → list of generated PDFs with download links | | | |
| **4.6** | **TradeAdvisor Page** — Full-screen chat interface with message bubbles, markdown rendering for policy citations, and suggested starter questions | Frontend-Agent | 3.11, 4.1 | Working chat UI |
| **4.7** | **Dashboard Page** — Summary stat cards (Total Shipments, Flagged, Forms Generated, Duty Saved) + recent shipments table with risk badges | Frontend-Agent | 4.5 | Dashboard |
| **4.8** | **Shipment History Page** — Filterable, searchable table of all past shipments with click-through to report | Frontend-Agent | 4.5, 4.7 | History view |

---

### Phase 5: Integration & End-to-End Testing (Days 12–16 — Oct 8–Oct 13)
> **QA-Agent takes the lead. All agents support bug fixes.**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| **5.1** | Create **3 realistic test invoices** as PDFs: | QA-Agent | — | `test-data/invoices/` |
| | — **Invoice A (Clean Pass):** Standard auto parts to UAE, correct HS codes, no SCOMET items | | | |
| | — **Invoice B (SCOMET Flag):** CNC controllers / precision bearings that trigger SCOMET Category 2 or 5 | | | |
| | — **Invoice C (FTA Eligible):** Textiles to UAE qualifying for India–UAE CEPA duty concession | | | |
| **5.2** | Define **expected outputs** for each test invoice (expected risk score, expected flags, expected forms to generate) | QA-Agent | 5.1 | `test-data/expected-outputs/` |
| **5.3** | **End-to-end test — Invoice A:** Upload → verify extraction accuracy → verify "Low Risk" score → verify Shipping Bill PDF generated with correct fields | QA-Agent | 3.5, 4.5 | ✅ or 🐛 bug list |
| **5.4** | **End-to-end test — Invoice B:** Upload → verify SCOMET flag with correct category citation → verify End-User Undertaking PDF generated | QA-Agent | 3.5, 4.5 | ✅ or 🐛 bug list |
| **5.5** | **End-to-end test — Invoice C:** Upload → verify FTA eligibility detection → verify Certificate of Origin PDF generated with correct origin criteria | QA-Agent | 3.5, 4.5 | ✅ or 🐛 bug list |
| **5.6** | **TradeAdvisor test:** Ask 5 sample questions and verify grounded, cited responses: | QA-Agent | 3.11, 4.6 | ✅ or 🐛 bug list |
| | — *"What are the tariffs for exporting auto parts to the USA?"* | | | |
| | — *"Is HS code 8456 (EDM machines) under SCOMET?"* | | | |
| | — *"What documents do I need to export chemicals to Japan?"* | | | |
| | — *"Can I claim duty benefits under India-UAE CEPA for steel pipes?"* | | | |
| | — *"What is the current anti-dumping duty on Indian steel in the EU?"* | | | |
| **5.7** | **Edge case testing:** Empty PDF upload, non-invoice PDF, missing HS codes on invoice, unknown destination country | QA-Agent | 3.5 | Error handling validated |
| **5.8** | **Performance test:** Measure end-to-end latency from upload to risk report. Target: < 30 seconds | QA-Agent | 3.5 | Latency benchmark |
| **5.9** | Write `test-data/test-plan.md` documenting all test cases and results | QA-Agent | 5.3–5.8 | Test plan document |

---

### Phase 6: Deployment (Days 15–17 — Oct 11–Oct 14)
> **Infra-Agent leads. Backend-Agent and Frontend-Agent support.**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| 6.1 | Write **`backend/Dockerfile`** (Python 3.11, FastAPI, gunicorn) | Backend-Agent | Phase 3 | Backend container |
| 6.2 | Write **`frontend/Dockerfile`** (Node 20, Next.js standalone build) | Frontend-Agent | Phase 4 | Frontend container |
| 6.3 | Create **`infra/cloudbuild.yaml`** for CI/CD: build both containers → push to Artifact Registry → deploy to Cloud Run | Infra-Agent | 6.1, 6.2 | Automated deployment pipeline |
| 6.4 | Deploy backend to **Cloud Run** (service: `shipsure-api`) | Infra-Agent | 6.3 | Live backend URL |
| 6.5 | Deploy frontend to **Cloud Run** (service: `shipsure-web`) | Infra-Agent | 6.3 | Live frontend URL |
| 6.6 | Configure **custom domain** (optional: `shipsure.app` or similar) | Infra-Agent | 6.4, 6.5 | Public URL |
| 6.7 | Run full **QA regression** on deployed production URL | QA-Agent | 6.4, 6.5 | Production validated |

---

### Phase 7: Submission Deliverables (Days 17–21 — Oct 14–Oct 18)
> **All agents contribute**

| Step | Task | Agent | Depends On | Output |
|------|------|-------|------------|--------|
| 7.1 | Record **3-minute demo video** showcasing: (1) TradeAdvisor tariff query, (2) Invoice upload with SCOMET flag, (3) 1-click form generation with zero-blank fields | QA-Agent | Phase 6 | `demo-video.mp4` |
| 7.2 | Write **Solution Deck** (Google Slides / PDF): Problem → Solution → Architecture → Demo Screenshots → Impact → Roadmap | All Agents | Phase 6 | `solution-deck.pdf` |
| 7.3 | Finalize **README.md** with: project description, screenshots, tech stack, setup instructions, live demo link | All Agents | Phase 6 | Repository README |
| 7.4 | Ensure GitHub repo is **public** | Infra-Agent | 7.3 | Public repository |
| 7.5 | **Submit on Hack2skill** — deployed link, video, GitHub URL, solution deck | All Agents | 7.1–7.4 | ✅ Submission complete |

---

## Dependency Graph (Critical Path)

```
Phase 0 (Day 1)
    │
    ├──▶ Phase 1: KB-Agent (Days 2-4) ──────────┐
    │                                            │
    ├──▶ Phase 2: Infra-Agent (Days 2-5) ◀───────┤
    │         │                                  │
    │         ▼                                  ▼
    │    Phase 3: Backend-Agent (Days 4-10) ◀── KB outputs + Infra IDs
    │         │
    │         ▼
    ├──▶ Phase 4: Frontend-Agent (Days 6-14) ◀── API contracts from Phase 3
    │         │
    │         ▼
    │    Phase 5: QA-Agent (Days 12-16) ◀── Backend + Frontend ready
    │         │
    │         ▼
    │    Phase 6: Infra-Agent (Days 15-17) ◀── Dockerfiles from Backend + Frontend
    │         │
    │         ▼
    └──▶ Phase 7: All Agents (Days 17-21) ◀── Deployed app
```

**Critical Path:** `KB Curation (Phase 1)` → `Vertex AI Search Setup (Phase 2)` → `Compliance Engine (Phase 3)` → `Integration Testing (Phase 5)` → `Deployment (Phase 6)`

> [!CAUTION]
> If **Phase 1 (KB curation)** or **Phase 2 (Vertex AI Search ingestion)** slips, the entire pipeline is blocked. These must be completed by **Day 5 (Oct 1)** at the latest.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Document AI fails on Indian invoice formats | Fallback: Use Gemini 1.5 Pro Vision to extract invoice data directly from the image/PDF |
| Vertex AI Search returns poor results | Fallback: Tier 1 deterministic JSON lookup covers the demo scenarios. Tier 3 Google Search grounding covers open-ended queries |
| PDF generation looks unprofessional | Use well-designed HTML templates rendered to PDF via `weasyprint` as an alternative to `reportlab` |
| Cloud SQL adds unnecessary complexity for MVP | Fallback: Use a simple JSON file store or SQLite locally, migrate to Cloud SQL only for production deploy |
| Demo invoice doesn't trigger expected flags | QA-Agent pre-validates all 3 test invoices against the compliance engine before demo recording |
