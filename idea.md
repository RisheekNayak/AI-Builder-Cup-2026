# 🏭 ShipSure: Intelligent Supply Chain & Export Operations Copilot

## 🏆 Hackathon Context
* **Event:** AI Builder Cup 2026
* **Theme:** Manufacturing: Intelligent Operations & Industrial Efficiency
* **Problem Area:** Resolving supply chain bottlenecks, automating export logistics, and preventing customs delays.

---

## 🚨 The Problem
Manufacturers can build world-class products efficiently on the factory floor, but the **supply chain often halts at the border**. 
When a manufacturer exports machinery or parts, they face a minefield of complex, constantly changing global logistics regulations: export controls, dual-use goods restrictions, and complex Harmonized System (HS) tariff codes. 

A single error on a Commercial Invoice or missing an End-User Certificate can result in goods being impounded at customs for weeks, halting downstream industrial operations and costing millions in delays. SMEs in manufacturing simply don't have the teams of trade lawyers required to prevent this.

## 💡 The Solution: ShipSure
ShipSure is an **Intelligent Operations Copilot** for manufacturing supply chains. It acts as an automated logistics expert.

Instead of logistics managers manually researching trade policies and typing out paperwork, they simply upload their factory's Commercial Invoice or Bill of Materials. ShipSure automatically:
1. **Extracts** the manufacturing and shipment data.
2. **Cross-references** the items against live global customs and export rules.
3. **Flags** operational risks (e.g., missing licenses, restricted buyers).
4. **Auto-generates** the required customs and compliance documents, perfectly filled out so the supply chain never stops.

---

## 🛠️ Key Features (The Demo Flow)

### 1. Intelligent Document Extraction
Logistics teams upload unstructured Commercial Invoices or Packing Lists. The system intelligently extracts key operational data: Buyer, Seller, Origin, Destination, Product Descriptions, and HS Codes.

### 2. Contextual Risk Assessment 
The system queries a vector database of dense trade regulations and export controls. It generates an **Operations Risk Report**:
* 🔴 **High Risk:** Flags heavily restricted items that will be blocked at customs.
* 🟡 **Warning:** Identifies missing licenses or incorrect tariff codes that will cause delays.

### 3. Agentic Document Generation 🌟 *The Magic Moment*
Based on the policies retrieved, ShipSure identifies exactly which customs forms are required (e.g., US Export Declaration). It maps the extracted factory data to the required form fields and **auto-generates the completed PDF documents**, ready to hand to the freight forwarder.

---

## ☁️ Google Cloud Architecture Mapping
ShipSure strictly adheres to the AI Builder Cup technology requirements:

* **Document AI:** Parses unstructured factory invoices to extract structured logistics data.
* **Vertex AI Agent Search (RAG):** Acts as the knowledge base, loaded with real trade regulations (EAR, EU customs rules) to ensure grounded, hallucination-free checks.
* **Gemini 1.5 Pro on Vertex AI:** The reasoning engine. It compares Document AI data against Vertex Search policies to assess risk, and uses Structured Outputs (JSON) to map data for form auto-filling.
* **Cloud Run:** Hosts the frontend (Next.js) and the backend API (Python/FastAPI) in scalable containers.
* **Cloud SQL / AlloyDB:** Stores factory profiles, shipment history, and compliance audit logs.

---

## 📅 MVP Scope (The 3-Week Plan)
For the October 18th hackathon submission, we will build:
1. A Next.js web dashboard for the Supply Chain Manager.
2. A backend pipeline that runs the `Document AI -> Vertex Search -> Gemini` flow.
3. An upload portal for sample PDF Invoices.
4. A results view showing an Operational Risk Score, cited policy violations, and a **"Generate Customs Forms"** button.
5. The ability to download a dynamically generated, pre-filled compliance PDF.
