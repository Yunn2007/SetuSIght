# SetuSight: Smart Bridge Health Monitoring and Asset Management System
## Exhaustive Engineering Architecture & Technical System Documentation

---

### Executive Summary

| Document Metadata | Specification |
| :--- | :--- |
| **Project Title** | Smart Bridge Health Monitoring and Asset Management System using Computer Vision |
| **Product Name** | **SetuSight** |
| **Target Infrastructure** | Regional and National Bridge Asset Networks (Navi Mumbai Infrastructure Demo) |
| **Document Version** | 2.0.0 (Production Release) |
| **Architecture Paradigm** | Pure Cloud Relational (Supabase PostgreSQL) + Cloud Asset Storage (Cloudinary) + Express.js REST API |
| **Security Standard** | Cryptographic Role-Based Access Control (RBAC) via JSON Web Tokens (JWT) & bcrypt |
| **Computer Vision Module** | YOLOv8 Visual Defect Detection Interface (Isolated Architectural Contract) |

---

## 1. System Architecture & High-Level Design

```mermaid
graph TD
    subgraph Client Layer
        LP[Public Landing Page /]
        AuthUI[Login Portal /login]
        AdminUI[Executive Admin Console /admin]
        InspectorUI[Field Inspector Portal /inspector]
        ContractorUI[Contractor Partner Portal /contractor]
        DossierUI[Bridge Asset Dossier & Timeline /bridge-details]
        ReportUI[Printable Structural Dossier /report-view]
    end

    subgraph Application & Gateway Layer
        Router[Express.js REST API Gateway]
        AuthMW[JWT Verification & Role Guard Middleware]
        UploadMW[Multer In-Memory Buffer Streamer]
        ErrorMW[Centralized Fail-Safe Error Handler]
    end

    subgraph Service & Engine Layer
        DBService[Supabase Direct Query Service]
        MLService[Computer Vision Engine: Real YOLOv8 PyTorch Pipeline]
        HealthEngine[3-Tier Multi-Parameter Structural Health Engine]
        NotifService[Database-Backed Alert Dispatcher]
    end

    subgraph Cloud Infrastructure Layer
        Supabase[(Supabase PostgreSQL Database)]
        Cloudinary[(Cloudinary Cloud Media Storage)]
    end

    Client Layer -->|HTTP / HTTPS Requests| Router
    Router --> AuthMW
    Router --> UploadMW
    AuthMW --> DBService
    UploadMW -->|In-Memory Buffer Stream| Cloudinary
    Cloudinary -->|Secure HTTPS URL & Public ID| DBService
    DBService --> Supabase
    Router --> MLService
    Router --> HealthEngine
    HealthEngine --> DBService
    Router --> NotifService
    NotifService --> DBService
    Router --> ErrorMW
```

### 1.1 Architectural Guarantees & Single Source of Truth
1. **Zero Local Fallback Policy:** The application communicates directly with Supabase PostgreSQL and Cloudinary. There is **no** local JSON database, SQLite database, filesystem persistence, or in-memory fallback.
2. **Deterministic Failure Modes:**
   - When Supabase is unreachable or unconfigured, the API halts cleanly and returns:
     ```json
     { "success": false, "error": "Database service unavailable" }
     ```
     with `HTTP 503 Service Unavailable`.
   - When Cloudinary is unreachable or unconfigured during image upload, the API returns:
     ```json
     { "success": false, "error": "Image upload service unavailable" }
     ```
     with `HTTP 503 Service Unavailable`.
3. **Stateless Memory Buffer Streaming:** File uploads never write temporary files to local disk. Uploads are buffered in memory via `multer.memoryStorage({ limits: { fileSize: 10 * 1024 * 1024 } })` and streamed directly to Cloudinary over HTTPS.

---

## 2. Database Architecture & Schema Specifications

The database schema is defined in [schema.sql](file:///Users/yunuskhan/Desktop/SetuSIght/schema.sql) and executed directly on Supabase PostgreSQL.

```mermaid
erDiagram
    contractors ||--o{ users : employs
    contractors ||--o{ bridges : maintains
    contractors ||--o{ maintenance : executes
    users ||--o{ inspections : conducts
    users ||--o{ notifications : receives
    bridges ||--o{ inspections : undergoes
    bridges ||--o{ maintenance : receives
    bridges ||--o{ notifications : triggers
    bridges ||--o{ reports : generates
    inspections ||--o{ reports : referenced_in

    contractors {
        uuid id PK
        varchar contractor_code UK
        varchar company_name
        varchar contact_person
        varchar email UK
        varchar phone
        varchar flag_status
        timestamptz created_at
    }

    users {
        uuid id PK
        varchar user_code UK
        varchar name
        varchar email UK
        varchar password_hash
        varchar role
        uuid contractor_id FK
        timestamptz created_at
    }

    bridges {
        uuid id PK
        varchar bridge_id UK
        varchar bridge_name
        varchar location
        int construction_year
        int design_life
        varchar material
        varchar bridge_type
        numeric length
        numeric width
        uuid contractor_id FK
        date last_maintenance_date
        date next_maintenance_date
        int maintenance_cycle_years
        numeric current_health_score
        varchar current_health_status
        timestamptz created_at
        timestamptz updated_at
    }

    inspections {
        uuid id PK
        varchar inspection_code UK
        uuid bridge_id FK
        uuid inspector_id FK
        date inspection_date
        text image_url
        text cloudinary_public_id
        int crack_count
        varchar crack_severity
        numeric detection_confidence
        jsonb detection_data
        numeric health_score
        varchar health_status
        text remarks
        timestamptz created_at
    }

    maintenance {
        uuid id PK
        varchar maintenance_code UK
        uuid bridge_id FK
        uuid contractor_id FK
        date scheduled_date
        date completion_date
        varchar priority
        varchar status
        text remarks
        timestamptz created_at
    }

    notifications {
        uuid id PK
        varchar notification_code UK
        uuid recipient_id FK
        uuid bridge_id FK
        varchar type
        varchar title
        text message
        boolean is_read
        timestamptz created_at
    }

    reports {
        uuid id PK
        varchar report_code UK
        uuid bridge_id FK
        uuid inspection_id FK
        varchar report_type
        text file_url
        timestamptz created_at
    }
```

### 2.1 Table Data Dictionaries

#### 1. `contractors`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique immutable contractor identifier |
| `contractor_code` | `VARCHAR(20)` | `UNIQUE NOT NULL` | Display identifier (e.g. `C001`, `C002`) |
| `company_name` | `VARCHAR(255)` | `NOT NULL` | Registered engineering firm name |
| `contact_person` | `VARCHAR(255)` | `NOT NULL` | Authorized executive representative |
| `email` | `VARCHAR(255)` | `UNIQUE NOT NULL` | Login & notification email address |
| `phone` | `VARCHAR(50)` | `NOT NULL` | Emergency and operational dispatch phone |
| `flag_status` | `VARCHAR(50)` | `CHECK IN ('Normal', 'Yellow / Review', 'Red / Escalated Review')` | Contractor performance & compliance audit badge |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Record creation timestamp |

#### 2. `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique user identifier |
| `user_code` | `VARCHAR(20)` | `UNIQUE NOT NULL` | Unique user badge code (e.g. `A001`, `I001`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Full legal name and designation |
| `email` | `VARCHAR(255)` | `UNIQUE NOT NULL` | Unique authentication email |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | 10-round salted bcrypt hash |
| `role` | `VARCHAR(50)` | `CHECK IN ('admin', 'inspector', 'contractor')` | System RBAC authorization role |
| `contractor_id` | `UUID` | `REFERENCES contractors(id) ON DELETE SET NULL` | Linked contractor firm (for contractor users) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Account creation timestamp |

#### 3. `bridges`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Internal database UUID |
| `bridge_id` | `VARCHAR(50)` | `UNIQUE NOT NULL` | Public structure code (e.g. `BR001`, `BR003`) |
| `bridge_name` | `VARCHAR(255)` | `NOT NULL` | Official civil engineering asset name |
| `location` | `VARCHAR(255)` | `NOT NULL` | Node/Municipality (e.g. `Nerul`, `Seawoods`) |
| `construction_year`| `INTEGER` | `NOT NULL` | Year bridge was commissioned |
| `design_life` | `INTEGER` | `NOT NULL, DEFAULT 50` | Expected operational lifespan in years |
| `material` | `VARCHAR(100)`| `NOT NULL` | Primary material (e.g. `Prestressed Concrete`) |
| `bridge_type` | `VARCHAR(100)`| `NOT NULL` | Engineering classification (e.g. `ROB`, `Flyover`) |
| `length` | `NUMERIC(10,2)`| `NOT NULL` | Total bridge span length in meters |
| `width` | `NUMERIC(10,2)`| `NOT NULL` | Deck carriageway width in meters |
| `contractor_id` | `UUID` | `REFERENCES contractors(id) ON DELETE SET NULL` | Assigned maintenance contractor |
| `last_maintenance_date`| `DATE` | `NOT NULL` | Date of last executed structural repair |
| `next_maintenance_date`| `DATE` | `NOT NULL` | Scheduled next maintenance date |
| `maintenance_cycle_years`| `INTEGER`| `DEFAULT 5` | Routine overhaul recurrence cycle |
| `current_health_score` | `NUMERIC(5,2)`| `CHECK (0 <= score <= 100)` | Computed health index (0 - 100) |
| `current_health_status`| `VARCHAR(50)`| `CHECK IN ('Good', 'Moderate', 'Attention Required')` | Health categorization |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Audit timestamps (auto-updated by trigger) |

---

## 3. Structural Health Assessment Engine (Phase 3A Multi-Patch Architecture)

The Health Assessment Engine ([src/services/healthService.js](file:///Users/yunuskhan/Desktop/SetuSIght/src/services/healthService.js)) enforces a strict 3-tier civil engineering condition hierarchy:

```mermaid
graph TD
    subgraph Tier 1: Local Concrete Observation
        Img1[Patch 1 Image] --> YOLO1[YOLOv8 Inference] --> P1[Patch Condition C_1]
        Img2[Patch 2 Image] --> YOLO2[YOLOv8 Inference] --> P2[Patch Condition C_2]
        ImgN[Patch N Image] --> YOLON[YOLOv8 Inference] --> PN[Patch Condition C_N]
    end

    subgraph Tier 2: Inspection Session Aggregation
        P1 & P2 & PN --> Agg[Deterministic Session Aggregation]
        Agg --> SessionCond[Session Condition Score C_session]
        Agg --> WorstSev[Worst Observed Severity S_worst]
    end

    subgraph Tier 3: Holistic Bridge Asset Health
        SessionCond --> BridgeModel[Holistic Civil Engineering Model]
        WorstSev --> BridgeModel
        Age[Bridge Age & Design Life] --> BridgeModel
        Material[Material Vulnerability] --> BridgeModel
        Exposure[Environmental & Traffic Exposure] --> BridgeModel
        Maintenance[Maintenance Track Record & Overdue Penalty] --> BridgeModel
        Trend[Historical Inspection Trajectory] --> BridgeModel
        BridgeModel --> BridgeHealth[Bridge Health Score H_bridge & Unified Status]
        BridgeModel --> Priority[Maintenance Priority: Low / Medium / High / Urgent]
    end
```

### 3.1 Mathematical Formulations

#### 1. Local Patch Condition ($C_{\text{patch}, i} \in [10, 100]$)
For each inspected image patch $i$:
$$C_{\text{patch}, i} = \max\Big(10.0,\, \min\big(100.0,\, 100.0 - (D_{\text{sev}} + D_{\text{count}})\big)\Big)$$
- Severity deduction ($D_{\text{sev}}$): `none`: $0$, `low`: $8$, `moderate`: $20$, `high`: $34$, `critical`: $48$
- Crack count deduction ($D_{\text{count}}$): $\min(N_{\text{cracks}, i} \times 2.0, 15.0)$

#### 2. Inspection Session Condition ($C_{\text{session}} \in [10, 100]$)
Aggregates $N$ inspected patches across the bridge structure:
- Affected patch ratio: $R_{\text{affected}} = \frac{N_{\text{affected}}}{N}$
- Raw blended condition: $C_{\text{raw}} = 0.55 \cdot \bar{C}_{\text{patch}} + 0.45 \cdot \min_i(C_{\text{patch}, i})$
- Structural spread penalty: $\Delta_{\text{spread}} = R_{\text{affected}} \times 8.0$
- Base score: $C_{\text{session}} = \max(10.0, \min(100.0, C_{\text{raw}} - \Delta_{\text{spread}}))$
- **Worst Severity Safety Caps:**
  - If $S_{\text{worst}} = \text{'critical'}$: $C_{\text{session}} \le 55.0$ (Hotspot override prevents clean patches from masking severe failure)
  - If $S_{\text{worst}} = \text{'high'}$: $C_{\text{session}} \le 72.0$
  - If $S_{\text{worst}} = \text{'moderate'}$: $C_{\text{session}} \le 82.0$

#### 3. Holistic Bridge-Level Health Score ($H_{\text{bridge}} \in [10, 100]$)
Integrates visual evidence with asset-level structural attributes without double-counting:
$$H_{\text{bridge}} = \operatorname{clamp}\Big(100.0 - D_{\text{defect}} - D_{\text{age}} - D_{\text{material}} - D_{\text{exposure}} + \Delta_{\text{maintenance}} + \Delta_{\text{trend}},\, 10.0,\, 100.0\Big)$$

- **Physical Defect Deduction ($D_{\text{defect}}$):** Derived directly from session condition:
  $$D_{\text{defect}} = (100.0 - C_{\text{session}}) \times 0.45 \quad (\le 40.5\text{ pts})$$
- **Age vs. Design Life Ratio ($D_{\text{age}}$):**
  $$\text{Age Ratio } (R) = \frac{\max(0, \text{Current Year} - \text{Construction Year})}{\text{Design Life}}$$
  $$D_{\text{age}} = \begin{cases}
  R \times 4.0 & \text{if } R \le 0.2 \\
  10.0 \times (R - 0.3) & \text{if } 0.2 < R \le 0.5 \\
  18.0 \times (R - 0.5) & \text{if } R > 0.8 \quad (\le 22.0\text{ pts})
  \end{cases}$$
- **Material Vulnerability ($D_{\text{material}}$):** Steel ($+4.0$), Underpass/Culvert/Masonry ($+5.0$), Composite ($+3.0$), Prestressed Concrete ($+1.0$).
- **Environmental Exposure ($D_{\text{exposure}}$):** Saline Marine / Creek ($+5.0$), Heavy Traffic / Dynamic Vibration ($+3.0$), Standard Urban ($+1.0$).
- **Maintenance History Offset ($\Delta_{\text{maintenance}}$):** $+5.0$ if completed within service window; $-6.0$ penalty if overdue.
- **Historical Deterioration Trend ($\Delta_{\text{trend}}$):** Expert-informed trend adjustment based on past inspection scores: $-3.0$ if progressive decline observed; $+2.0$ if confirmed post-repair improvement.

### 3.2 Authoritative Categorical Health Status & Safety Overrides
$$\text{Health Status} = \begin{cases}
\mathbf{Attention\ Required} & \text{if } H_{\text{bridge}} < 60.0 \text{ or } S_{\text{worst}} = \text{'critical'} \\
\mathbf{Moderate} & \text{if } 60.0 \le H_{\text{bridge}} < 80.0 \text{ or } S_{\text{worst}} = \text{'high'} \\
\mathbf{Good} & \text{if } H_{\text{bridge}} \ge 80.0 \text{ and } S_{\text{worst}} \notin \{\text{'high'}, \text{'critical'}\}
\end{cases}$$
*Authoritative Safety Override:* If $S_{\text{worst}} = \text{'critical'}$, the bridge score is capped at $\le 58.0$ and forced to `Attention Required`. If $S_{\text{worst}} = \text{'high'}$, the bridge score is capped at $\le 74.0$ and forced to at most `Moderate`.

### 3.3 Maintenance Priority Determination
Independent from health score to determine urgency of intervention:
$$\text{Priority} = \begin{cases}
\mathbf{Urgent} & \text{if } S_{\text{worst}} = \text{'critical'} \text{ or } H_{\text{bridge}} < 45.0 \text{ or (Overdue and } H_{\text{bridge}} < 60.0) \\
\mathbf{High} & \text{if } S_{\text{worst}} = \text{'high'} \text{ or } H_{\text{bridge}} < 60.0 \text{ or (Overdue and } H_{\text{bridge}} < 75.0) \\
\mathbf{Medium} & \text{if } S_{\text{worst}} = \text{'moderate'} \text{ or } H_{\text{bridge}} < 78.0 \\
\mathbf{Low} & \text{otherwise}
\end{cases}$$

---

## 4. Computer Vision (YOLOv8) Service Interface & Local Setup

The machine learning module executes real Computer Vision inference via Python ultralytics YOLOv8 in [src/services/mlService.js](file:///Users/yunuskhan/Desktop/SetuSIght/src/services/mlService.js) and [ml/inference.py](file:///Users/yunuskhan/Desktop/SetuSIght/ml/inference.py).

```mermaid
sequenceDiagram
    participant FieldInspector as Inspector Client
    participant ExpressGateway as Express API Gateway
    participant CloudinaryStore as Cloudinary Storage
    participant PyYOLO as Python YOLOv8 Engine (ml/best.pt)
    participant HealthEngine as 3-Tier Health Engine
    participant SupabaseDB as Supabase Database

    FieldInspector->>ExpressGateway: POST /api/inspections (1-10 Multipart Images)
    loop For each patch image
        ExpressGateway->>CloudinaryStore: Stream In-Memory Buffer
        CloudinaryStore-->>ExpressGateway: Secure Cloudinary URL
        ExpressGateway->>PyYOLO: analyzeBridgeImage(patch_url) via ml/best.pt
        PyYOLO-->>ExpressGateway: Real Detection Bounding Boxes & Confidence
        ExpressGateway->>ExpressGateway: Calculate Local Patch Condition (10-100)
    end
    ExpressGateway->>HealthEngine: aggregateSessionEvidence(patches)
    ExpressGateway->>HealthEngine: calculateHealthAssessment(bridge, sessionEvidence, history)
    HealthEngine-->>ExpressGateway: { healthScore, healthStatus, maintenancePriority }
    ExpressGateway->>SupabaseDB: Persist Inspection Session + inspection_images
    ExpressGateway->>SupabaseDB: Update Bridge current_health_score & status
    SupabaseDB-->>ExpressGateway: Record Confirmation
    ExpressGateway-->>FieldInspector: HTTP 201 Inspection Created with Full Visual AI Telemetry
```

### 4.1 ML Weights & Local Environment Requirements
> [!IMPORTANT]
> The trained weights file `ml/best.pt` is intentionally ignored by `.gitignore` and is NOT committed to GitHub.
> 
> 1. Developers/operators running SetuSight locally must place the trained weights file at:
>    `ml/best.pt`
> 2. The local Python environment must contain `ultralytics`, `torch`, and `Pillow`. A dedicated virtual environment at `ml/venv` is automatically discovered by `mlService.js`.
> 3. If `ml/best.pt` is missing, the service cleanly rejects requests with `HTTP 503 Service Unavailable`:
>    ```json
>    {
>      "success": false,
>      "error": "YOLO model not found at ml/best.pt. Place the trained SetuSight model at this path."
>    }
>    ```
>    The system strictly forbids returning fake detections or simulated scores when the model is unavailable.

### 4.2 ML Interface Output Contract
```typescript
interface MLAnalysisResult {
  isMock: boolean;             // false (Real PyTorch YOLOv8 model inference)
  status: string;             // "AI analysis completed"
  crackDetected: boolean;     // Detected visual crack presence
  crackCount: number;         // Count of detected bounding boxes
  confidence: number;         // Mean confidence score [0.0 - 1.0]
  detections: Array<{
    bbox: [number, number, number, number]; // [x_min, y_min, x_max, y_max]
    confidence: number;
    label: string;            // e.g. "crack"
    severity_level: "low" | "moderate" | "high" | "critical";
  }>;
  image_dimensions: { width: number; height: number };
  processedAt: string;        // ISO 8601 Timestamp
}
```

---

## 5. Security Architecture & Role-Based Access Control (RBAC)

### 5.1 Role Matrix & Capabilities

| Capability / Resource | Executive Admin (`admin`) | Field Inspector (`inspector`) | Contractor Partner (`contractor`) | Public Visitor |
| :--- | :---: | :---: | :---: | :---: |
| **View Public Bridge Network Table** | ✅ | ✅ | ✅ | ✅ |
| **View Executive Dashboard & Analytics** | ✅ | ❌ | ❌ | ❌ |
| **Register & Edit Bridge Inventory** | ✅ | ❌ | ❌ | ❌ |
| **Submit New Field Inspection & Photo** | ❌ | ✅ | ❌ | ❌ |
| **View Full Inspection History** | ✅ | ✅ | ❌ | ❌ |
| **Schedule Maintenance Work Order** | ✅ | ❌ | ❌ | ❌ |
| **View Assigned Maintenance Tasks** | ✅ | ❌ | ✅ *(Assigned Only)* | ❌ |
| **Update Work Order Status & Notes** | ✅ | ❌ | ✅ *(Assigned Only)* | ❌ |
| **View Bridge Dossier & Full History** | ✅ | ✅ | ❌ | ❌ |
| **Generate & Export Printable Reports** | ✅ | ✅ | ❌ | ❌ |
| **Audit Contractor Compliance Flags** | ✅ | ❌ | ❌ | ❌ |

### 5.2 Contractor Backend Isolation
Contractors are strictly restricted at the database query layer.
1. The authenticated contractor's `contractor_id` is encoded inside their JWT session token.
2. When calling `GET /api/bridges`, the backend injects `.eq('contractor_id', req.user.contractor_id)`.
3. When calling `GET /api/bridges/:id` or `PUT /api/maintenance/:id`, the controller validates:
   ```javascript
   if (req.user.role === 'contractor' && record.contractor_id !== req.user.contractor_id) {
     return res.status(403).json({
       success: false,
       error: "Access denied. Record not assigned to your contractor account."
     });
   }
   ```

---

## 6. Complete REST API Specifications

### 6.1 Authentication Endpoints

#### `POST /api/auth/login`
- **Description:** Authenticates credentials and returns a signed 7-day JWT token.
- **Request Body:**
  ```json
  {
    "email": "contractor@setusight.gov.in",
    "password": "contract123"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c0000000-0000-0000-0000-000000000003",
      "name": "M/s InfraTech Projects Lead",
      "email": "contractor@setusight.gov.in",
      "role": "contractor",
      "contractor_id": "c1111111-1111-1111-1111-111111111111"
    }
  }
  ```

#### `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (`200 OK`):** Returns authenticated user session payload.

---

### 6.2 Bridge Inventory Endpoints

#### `GET /api/bridges`
- **Access:** Public / Filtered for `contractor` role.
- **Query Parameters:** `status`, `location`, `material`, `search`.
- **Behavior:** Returns all bridges for admin/public; returns **only** assigned bridges for logged-in contractors (`BR001`, `BR003`, `BR008`).
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 3,
    "data": [
      {
        "id": "d0000001-0000-0000-0000-000000000001",
        "bridge_id": "BR001",
        "bridge_name": "Nerul Railway Over Bridge",
        "location": "Nerul",
        "construction_year": 2012,
        "design_life": 50,
        "material": "Prestressed Concrete",
        "bridge_type": "Railway Over Bridge",
        "length": 420.00,
        "width": 18.50,
        "current_health_score": 88.50,
        "current_health_status": "Good",
        "maintenance_priority": "Low",
        "maintenance_status": "Completed"
      }
    ]
  }
  ```

#### `GET /api/bridges/:id`
- **Access:** Admin, Inspector, or Assigned Contractor.
- **Response (`200 OK`):** Detailed bridge specifications, inspection count, maintenance count, and latest inspection summary.

#### `POST /api/bridges` *(Admin Only)*
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "bridge_id": "BR016",
    "bridge_name": "Kharghar Creek Flyover",
    "location": "Kharghar",
    "construction_year": 2020,
    "design_life": 60,
    "material": "Prestressed Concrete",
    "bridge_type": "Elevated Viaduct",
    "length": 520.00,
    "width": 24.00,
    "contractor_id": "c1111111-1111-1111-1111-111111111111"
  }
  ```
- **Response (`201 Created`):** Returns newly registered bridge asset with initial computed health index.

---

### 6.3 Field Inspection & Upload Endpoints

#### `POST /api/inspections` *(Inspector Only)*
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Form Data Fields:**
  - `bridge_id`: Target bridge UUID
  - `inspection_date`: YYYY-MM-DD
  - `crack_severity`: `none` | `low` | `moderate` | `high` | `critical`
  - `crack_count`: Integer count
  - `remarks`: Field engineering remarks
  - `image`: Binary image file (JPEG, PNG, WebP $\le 10$MB)
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Inspection uploaded and health assessment recorded successfully",
    "data": {
      "id": "e0000005-0000-0000-0000-000000000005",
      "bridge_id": "d0000001-0000-0000-0000-000000000001",
      "image_url": "https://res.cloudinary.com/c3wesoc5/image/upload/v1787335079/setusight/inspections/...",
      "health_score": 86.00,
      "health_status": "Good",
      "ml_analysis": {
        "isMock": true,
        "status": "AI analysis module pending integration"
      }
    }
  }
  ```

---

### 6.4 Maintenance Work Order Endpoints

#### `GET /api/maintenance`
- **Access:** Admin (all work orders) / Contractor (strictly assigned work orders).
- **Response (`200 OK`):** List of maintenance orders with bridge and contractor metadata.

#### `PUT /api/maintenance/:id`
- **Access:** Admin or Assigned Contractor.
- **Request Body:**
  ```json
  {
    "status": "Completed",
    "completion_date": "2026-08-21",
    "remarks": "Epoxy injection on pier P4 completed. Expansion joint seals replaced."
  }
  ```
- **Response (`200 OK`):** Updated maintenance record; triggers bridge health recalibration.

---

## 7. Frontend Portals & User Interface Architecture

```
public/
├── index.html            # Public Landing Page (Exact Design Tokens Preserved)
├── landing.css           # Design Tokens: Navy #10233D, Green #1F7A4D, Fonts
├── landing.js            # Live Bridge Network dynamic API loader
├── app.css               # Clean Engineering Dashboard Design System
├── app.js                # Core Application Framework (Auth, Notifications, Toasts)
├── login.html             # Role-Based Authentication Portal
├── admin.html & .js      # Executive Admin Console (Overview, CRUD, Maintenance, Analytics)
├── inspector.html & .js  # Field Inspector Portal (Photo Upload, Health Recalibration)
├── contractor.html & .js # Contractor Portal (Assigned Tasks, Bridges, Completed Repairs)
├── bridge-details.html   # Bridge Asset Dossier & Chronological Lifecycle Timeline
└── report-view.html      # Printable Official Structural Health Dossier
```

### 7.1 Design Tokens Reference

```css
:root {
  /* Primary Brand Colors */
  --navy: #10233D;
  --navy-dark: #0A1728;
  --navy-soft: #2C4263;
  --navy-faint: #637794;
  --green: #1F7A4D;
  --green-dark: #145C39;
  --green-tint: #E7F2EA;

  /* Status Indicators */
  --amber: #B07A12;
  --amber-tint: #FDF3DF;
  --red: #B5432E;
  --red-tint: #FBEAE7;
  --blue: #2C5F8A;

  /* Surfaces & Borders */
  --bg: #FAFAF8;
  --bg-card: #FFFFFF;
  --bg-alt: #F2F5F1;
  --border: #E2E6E1;
  --border-strong: #CBD3CA;

  /* Typography */
  --font-heading: 'Manrope', -apple-system, sans-serif;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
```

---

## 8. Deployment, Cloud Setup & Operations

### 8.1 Prerequisites
- Node.js $\ge 18.0.0$
- Supabase Project (PostgreSQL 15+)
- Cloudinary Account

### 8.2 Environment Configuration ([`.env`](file:///Users/yunuskhan/Desktop/SetuSIght/.env))
```ini
PORT=3000
NODE_ENV=development
JWT_SECRET=setusight_jwt_secret_key_2026_infrastructure_secure_token

# Supabase PostgreSQL Credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudinary Image Storage Credentials
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 8.3 Database Setup Steps
1. Navigate to **Supabase Dashboard $\rightarrow$ SQL Editor**.
2. Run the DDL script in [`schema.sql`](file:///Users/yunuskhan/Desktop/SetuSIght/schema.sql) to create tables, indexes, and triggers.
3. Run the initial data seed script in [`seed.sql`](file:///Users/yunuskhan/Desktop/SetuSIght/seed.sql) or execute:
   ```bash
   npm run seed
   ```

### 8.4 Starting the Server
```bash
npm start
# SetuSight running on http://localhost:3000
```

---

## 9. Verification & Audit Test Suite

Automated verification tests are included in the repository:

1. **Service & Engine Test Suite:**
   ```bash
   node scripts/test-services.js
   ```
   - ✅ Verifies real YOLOv8 ML inference execution (`isMock: false`, `ml/best.pt`).
   - ✅ Verifies mathematical rule-based health assessment across young, moderate, and critical bridges.
   - ✅ Verifies RBAC middleware.

2. **Contractor Portal & Access Control Test Suite:**
   ```bash
   node scripts/test-contractor-flow.js
   ```
   - ✅ Verifies contractor token includes `contractor_id`.
   - ✅ Verifies backend query isolation returns only assigned bridges.
   - ✅ Verifies cross-contractor access rejection (`HTTP 403 Forbidden`).
   - ✅ Verifies maintenance state lifecycle transitions.

3. **Phase 2B Visual AI Canvas & Bounding Box Test Suite:**
   ```bash
   node scripts/test-phase2b-visual-ai.js
   ```
   - ✅ Verifies real YOLOv8 bounding boxes, confidence, and center/edge crack alignment.
   - ✅ Verifies responsive canvas box scaling across mobile, tablet, and desktop viewports.
   - ✅ Verifies historical inspection viewer uses stored telemetry without re-running inference.

4. **Phase 3A End-to-End Multi-Patch Verification Suite:**
   ```bash
   node scripts/test-phase3a-verification.js
   ```
   - ✅ 7 end-to-end integration tests exercising multi-patch uploads, Supabase storage, admin alerts, contractor isolation, and maintenance completion.

5. **Critical Regression & Safety Dilution Test Suite:**
   ```bash
   node scripts/test-regression.js
   ```
   - ✅ Verifies patch score separation (Patch 58.5 + Patch 92.5 does NOT overwrite bridge health).
   - ✅ Verifies critical defect safety override (9 clean patches + 1 critical patch forces Attention Required and score <= 58.0).
   - ✅ Verifies partial multi-image failure handling.
