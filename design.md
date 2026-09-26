# 🏭 ShipSure — System Design & Feature Specification

## 1. Executive Summary & Problem Context
* **Event:** AI Builder Cup 2026 (JAPAC)
* **Track:** Manufacturing: Intelligent Operations & Industrial Efficiency
* **Solution:** **ShipSure** — Intelligent Supply Chain & Export Operations Copilot
* **Focus Corridor:** Indian Manufacturing Exporters (SMEs) exporting to JAPAC, Middle East (UAE), and Global markets (USA/EU).

Manufacturers can produce high-quality goods with high factory efficiency, but their supply chains often stall at international borders. In India, exporters lose days navigating DGFT SCOMET (dual-use) rules, 8-digit ITC(HS) classifications, and complex ICEGATE customs filings. ShipSure solves both **pre-shipment tariff planning** and **operational shipment compliance automation**.

---

## 2. Comprehensive Feature Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SHIPSURE PLATFORM                               │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ 1. PROACTIVE: Trade Advisor Bot      │ 2. OPERATIONAL: Document Copilot      │
│ (Planning & Market Intelligence)     │ (Execution & Autonomous Compliance)   │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ • Real-time tariff & duty estimation │ • Company Master Profile & Merging    │
│ • Destination compliance checklist   │ • Document AI invoice extraction      │
│ • Live search + policy RAG grounding │ • SCOMET dual-use risk scoring        │
│ • FTA duty concession discovery      │ • 100% Zero-Blank Form Auto-Filling   │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

### 🌟 Feature 1: TradeAdvisor (Pre-Shipment Intelligence RAG Bot)
* **Natural Language Market Planning:** Exporters ask open-ended questions (e.g., *"I'm exporting centrifugal pumps to the USA, what are the tariffs as of today and what certifications do I need?"*).
* **Dual-Grounding Intelligence:**
  * Uses **Vertex AI Search** for dense trade agreements, tariff schedules (US HTS, EU TARIC, India ITC-HS), and SCOMET lists.
  * Uses **Gemini Google Search Grounding** for live, real-time tariff updates, anti-dumping duties, and breaking trade notices.
* **Instant Regulatory Checklist:** Delivers a clear breakdown of general duties, special tariffs, mandatory certifications (e.g., EPA/CE/BIS), and export control checks.

### 🏢 Feature 2: Company Master Profile & Entity Merging Engine
* **One-Time Onboarding Profile:** Exporters store their permanent statutory manufacturing details in ShipSure:
  * **IEC (Importer Exporter Code)** & **PAN**
  * **GSTIN** & Registered Factory / Dispatch Address
  * **Bank AD Code (Authorized Dealer Code):** Mandatory 14-digit bank branch code for RBI e-BRC tracking
  * **Factory Stuffing & Seal Permission details**
  * **Authorized Signatory Name & Designation**
* **The Merging Engine:** Combines static company master data + dynamic extracted invoice data to produce **100% complete, zero-blank regulatory forms** ready for direct submission.

### 📄 Feature 3: Intelligent Document Intake (Document AI)
* **Automated Parsing:** Ingests Indian Tax Invoices, Packing Lists, or Purchase Orders (PDF / high-res scans).
* **Transaction Extraction:**
  * **Consignee Details:** Buyer Name, Destination Port (Jebel Ali, Singapore, Rotterdam, etc.), Delivery Terms (FOB, CIF, CFR).
  * **Line Items:** Descriptions, declared 8-digit HS codes, quantities, unit weights, and invoice values.

### 🛡️ Feature 4: SCOMET Dual-Use & Sanctions Auditor
* **Dual-Use Detection:** RAG query over DGFT SCOMET Appendix 3 schedules (Categories 0 through 8: special materials, electronics, aerospace, defense).
* **Sanctions Screening:** Checks foreign buyer names and destination entities against international and national restricted lists.
* **Risk Tiers:** Outputs 🟢 *Free/Open Export*, 🟡 *Restricted / SCOMET License Required*, or 🔴 *Prohibited*.

### 🔍 Feature 5: 8-Digit ITC(HS) Code Verifier & Recommender
* **Misclassification Detection:** Flags when an invoice uses generic 4/6-digit codes or incorrect classifications that trigger ICEGATE customs queries.
* **Smart Recommendation:** Recommends the exact 8-digit Indian Trade Clarification (ITC-HS) code with rationale based on product specs.

### 💰 Feature 6: FTA / CEPA Duty Concession Finder
* **Agreement Matching:** Automatically identifies preferential trade pacts (e.g., India–UAE CEPA, India–Australia ECTA, ASEAN–India FTA).
* **Buyer Duty Savings:** Calculates the exact tariff savings available to the foreign buyer if a Preferential Certificate of Origin is filed.

### ⚡ Feature 7: 1-Click Agentic Form Generator (*Zero-Blank Auto-Filling*)
Merges Company Master Data + Invoice Data using Gemini Structured Outputs to generate downloadable, print-ready PDFs:
1. **ICEGATE Shipping Bill Checklist:** Standardized single-window customs declaration format for Indian Customs House Agents (CHAs) including IEC, AD Code, and RoDTEP claims.
2. **e-Certificate of Origin (e-CoO) Draft:** Auto-filled DGFT Form A to claim FTA duty benefits with pre-filled origin criteria and signatory text.
3. **SCOMET End-User Undertaking (EUU):** Official buyer declaration form required by DGFT if goods trigger dual-use thresholds.

### 📊 Feature 8: Operations & Compliance Dashboard
* **Shipment Metrics:** Total shipments audited, compliance pass rate, estimated customs duty saved for buyers.
* **Audit Trail:** Searchable history of all past shipments with verification timestamps and cited policy clauses.

---

## 3. Data Merging Architecture

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│       COMPANY MASTER PROFILE        │     │          TRANSACTION DATA           │
│      (Saved in Settings / DB)       │     │       (Extracted from Invoice)      │
├─────────────────────────────────────┤     ├─────────────────────────────────────┤
│ • IEC, GSTIN, PAN                   │     │ • Foreign Buyer Name & Address      │
│ • Bank AD Code                      │  +  │ • Destination Port (e.g., AEJEA)    │
│ • Factory Address & State Code      │     │ • Line Items, Net/Gross Weights     │
│ • Authorized Signatory Details      │     │ • Invoice Value, Currency, HS Codes │
└──────────────────┬──────────────────┘     └──────────────────┬──────────────────┘
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         │
                                         ▼
                        ┌─────────────────────────────────┐
                        │      GEMINI 1.5 PRO REASONING    │
                        │   Validates with Vertex RAG &   │
                        │   maps to official JSON Schema  │
                        └────────────────┬────────────────┘
                                         │
                                         ▼
                        ┌─────────────────────────────────┐
                        │    100% COMPLETE PDF FORMS      │
                        │  • ICEGATE Shipping Bill Sheet  │
                        │  • Certificate of Origin (CoO)  │
                        │  • SCOMET End-User Undertaking  │
                        └─────────────────────────────────┘
```

---

## 4. Google Cloud Architecture

```
                                  ┌───────────────────────────────┐
                                  │      FRONTEND (Next.js 14)    │
                                  │       Cloud Run Container     │
                                  │                               │
                                  │  [TradeAdvisor] [Invoice Hub] │
                                  │  [Company Profile] [Form Hub] │
                                  └───────────────┬───────────────┘
                                                  │ REST APIs
                                  ┌───────────────▼───────────────┐
                                  │     BACKEND (FastAPI/Python)  │
                                  │       Cloud Run Container     │
                                  └───────┬───────────────┬───────┘
                                          │               │
                 ┌────────────────────────┼───────────────┼────────────────────────┐
                 ▼                        ▼               ▼                        ▼
       ┌──────────────────┐    ┌────────────────────┐ ┌───────────────────┐ ┌───────────────┐
       │   Document AI    │    │ Vertex AI Search   │ │ Gemini 1.5 Pro    │ │ Cloud Storage │
       │ (Invoice Parser) │    │  (DGFT/SCOMET RAG) │ │ Reasoning, Search │ │  & Cloud SQL  │
       │                  │    │                    │ │ Grounding, JSON   │ │ (Files & DB)  │
       └──────────────────┘    └────────────────────┘ └─────────┬─────────┘ └───────────────┘
                                                                │
                                                        ┌───────▼────────┐
                                                        │ PDF Generator  │
                                                        │ (ReportLab/Kit)│
                                                        └────────────────┘
```

---

## 5. Technology Stack

| Layer | Component | Purpose |
|---|---|---|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Lucide Icons | Responsive dashboard with TradeAdvisor chat, invoice analyzer, and company profile views |
| **Backend API** | Python 3.11, FastAPI, Pydantic, Uvicorn | Orchestration layer connecting AI services, company profile merging, and generating PDFs |
| **Document AI** | Google Cloud Document AI (Invoice Parser) | Extracts structured tables, line items, and entities from Indian tax invoices |
| **Vector Search / RAG**| Vertex AI Search (Agent Builder) | Semantic search over official DGFT SCOMET, FTP 2023, and Customs PDFs |
| **Reasoning Engine** | Gemini 1.5 Pro on Vertex AI | Multi-step reasoning, policy comparison, Google Search grounding, structured JSON output |
| **PDF Generation** | Python `reportlab` / `fpdf2` | Dynamically stamps structured JSON data onto standard customs form templates |
| **Storage & Hosting** | Cloud Run, Cloud Storage (GCS), Cloud SQL | Serverless hosting, secure document storage, and company profile/shipment audit database |

---

## 6. MVP Build Plan (3-Week Hackathon Sprint)

* **Week 1: Scaffolding & Document Ingestion (Sep 27 – Oct 3)**
  * Scaffold Next.js frontend and FastAPI backend.
  * Create Company Profile setup view and database schema (IEC, GSTIN, AD Code).
  * Ingest sample Indian export invoices with Document AI.
  * Populate Cloud Storage bucket with DGFT SCOMET and FTP PDFs; initialize Vertex AI Search datastore.

* **Week 2: AI Pipelines & Form Auto-Generation (Oct 4 – Oct 10)**
  * Implement TradeAdvisor chat endpoint using Gemini 1.5 Pro + Search Grounding + Vertex Search.
  * Implement the compliance evaluation pipeline (Document AI $\rightarrow$ Vertex AI Search $\rightarrow$ Gemini risk score).
  * Build the Data Merging Engine (Company Profile + Invoice Data $\rightarrow$ PDF Generator) for ICEGATE Shipping Bill & Certificate of Origin.

* **Week 3: Dashboard UI, Deployment & Submission (Oct 11 – Oct 18)**
  * Wire up the frontend dashboard: TradeAdvisor chat, invoice upload zone, risk cards, and download buttons.
  * Deploy frontend and backend containers to Google Cloud Run.
  * Record the 3-minute demo video covering both workflows (Planning + Invoice Execution with Zero-Blank Form Generation).
  * Finalize solution deck and submit.
