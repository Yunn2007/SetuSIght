# SetuSight — Smart Bridge Health Monitoring & Asset Management System

> **Decision-Support Infrastructure Platform powered by Computer Vision (YOLOv8) & 3-Tier Multi-Parameter Structural Health Scoring**

---

## 📌 Executive Summary

**SetuSight** is a smart bridge health monitoring and asset management system designed for regional and municipal infrastructure authorities (demonstrated across the Navi Mumbai bridge network). 

SetuSight solves a fundamental flaw in typical computer-vision inspection systems: **a bridge is not a single photo**. An individual photograph represents only a localized surface observation. SetuSight introduces a 3-tier analytical hierarchy:
1. **Local Patch Condition ($C_{\text{patch}} \in [10, 100]$):** Evaluated from high-resolution concrete photography using real YOLOv8 object detection.
2. **Inspection Session Condition ($C_{\text{session}} \in [10, 100]$):** Deterministic aggregation across multiple inspection patches ($1 \le N \le 10$) incorporating affected surface ratios, crack burden, worst-patch severity, and safety overrides.
3. **Bridge Health Score ($H_{\text{bridge}} \in [10, 100]$):** Holistic asset-level score combining inspection evidence with structural age, design life, material vulnerability, traffic/environmental exposure, maintenance history, and historical deterioration trends.

---

## 🏗️ System Architecture

```
Field Inspector / Admin / Contractor UI
       │  (Multipart 1–10 images + metadata)
       ▼
Express.js REST API Gateway
       │
  ┌────┴───────────────────────────┐
  ▼                                ▼
Cloudinary Media Storage      Real YOLOv8 Inference
(In-Memory Stream)             (ml/best.pt via Python)
  │                                │
  │ (Secure Image URL)             ▼ (Bounding Boxes, Conf, Cracks)
  └───────────────┬────────────────┘
                  ▼
       Inspection Aggregation & 3-Tier Health Engine
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
Supabase PostgreSQL    Notification Engine
(inspections, patches,  (Admins & Contractors)
 bridges, maintenance)
```

---

## 🤖 YOLOv8 Computer Vision Pipeline & Model Setup

### **CRITICAL: Model Weights File Placement**
The trained YOLOv8 model file (`ml/best.pt`) is **intentionally excluded from Git** (enforced by `.gitignore`) to protect proprietary weights and repository size limits.

To run AI crack detection locally:
1. Obtain the trained weights file `best.pt`.
2. Place the file at:
   ```
   ml/best.pt
   ```
3. Set up the Python virtual environment:
   ```bash
   python3 -m venv ml/venv
   source ml/venv/bin/activate
   pip install ultralytics torch Pillow
   ```
4. **Fail-Safe Behavior:** If `ml/best.pt` is missing, the API halts inference cleanly with `HTTP 503`:
   ```json
   {
     "success": false,
     "error": "YOLO model not found at ml/best.pt. Place the trained SetuSight model at this path."
   }
   ```
   *The system strictly prohibits returning fake bounding boxes, simulated detections, or mock health scores.*

---

## 🗄️ Database Architecture

The persistence layer runs on **Supabase PostgreSQL**.

### Primary Entity Hierarchy
- `bridges`: Infrastructure asset master records (dimensions, material, coordinates, current health score).
- `inspections`: Inspection session parent record (session date, aggregate crack count, worst severity, session condition, overall bridge health).
- `inspection_images`: Individual concrete patch records (image URL, Cloudinary public ID, patch label, YOLO bounding boxes JSON, crack count, local condition score).
- `contractors`: Authorized maintenance firms with performance tracking.
- `maintenance`: Work orders with lifecycle states (`Scheduled` → `In Progress` → `Completed` / `Overdue`).
- `notifications`: Actionable alerts tied to real user UUIDs (`recipient_id`) with 10-minute idempotency deduplication.
- `reports`: Generated structural audit dossiers and summaries.

### Applying Database Migrations
1. Baseline schema: `schema.sql`
2. Phase 3A Multi-Image Migration: `migration_phase3a.sql`

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: 3.9+ with `torch`, `ultralytics`, `Pillow`
- **Supabase PostgreSQL** account & project
- **Cloudinary** media account

### Installation
```bash
# Clone the repository
git clone https://github.com/Yunn2007/SetuSIght.git
cd SetuSIght

# Install Node.js dependencies
npm install

# Setup Python environment for YOLOv8
python3 -m venv ml/venv
source ml/venv/bin/activate
pip install -r ml/requirements.txt || pip install ultralytics torch Pillow

# Copy environment variables
cp .env.example .env
```

### Environment Configuration (`.env`)
```ini
PORT=3000
NODE_ENV=development
JWT_SECRET=your_secure_jwt_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
YOLO_MODEL_PATH=ml/best.pt
```

### Running Locally
```bash
# Start development server with live watch
npm run dev

# Or start standard production server
npm start
```

Access the application in your browser:
- **Landing Page**: `http://localhost:3000/`
- **Login Portal**: `http://localhost:3000/login`
- **Inspector Workbench**: `http://localhost:3000/inspector`
- **Admin Command Center**: `http://localhost:3000/admin`
- **Contractor Portal**: `http://localhost:3000/contractor`

---

## 🧪 Verification & Test Suites

The repository contains automated test suites exercising real database connections, image uploading, YOLOv8 inference, and access control:

```bash
# 1. Unit & Service Verification Test Suite
node scripts/test-services.js

# 2. Phase 3A Full End-to-End Regression Test Suite (7 Multi-Image & RBAC tests)
node scripts/test-phase3a-verification.js

# 3. Visual AI Canvas Test Suite
node scripts/test-phase2b-visual-ai.js

# 4. Critical Regression & Safety Dilution Test Suite
node scripts/test-regression.js
```

---

## 👥 Role-Based Access Control (RBAC) Default Credentials

| Portal / Role | Email | Password | Authorized Scopes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@setusight.gov.in` | `admin123` | Full network control, bridge creation, contractor management, maintenance scheduling, reports |
| **Inspector** | `inspector@setusight.gov.in` | `inspect123` | Bridge inspection, multi-patch image uploads (1-10), real-time YOLOv8 canvas analysis |
| **Contractor** | `contractor@setusight.gov.in` | `contract123` | Isolated assigned work orders, status progression (`In Progress`, `Completed`) |

---

## 📄 License
This project is licensed under the ISC License.
