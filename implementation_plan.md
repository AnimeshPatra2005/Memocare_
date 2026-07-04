# Architecture Plan: FastAPI Microservices & End-to-End Encryption

This document outlines the proposed microservices architecture, client-side End-to-End Encryption (E2EE) design, database schema, and division of work for refactoring the MemoCare project.

---

## 1. System Architecture

To allow two developers to work independently, we will decompose the application into independent microservices containerized with **Docker** and orchestrated using **Docker Compose**.

### Mermaid Data Flow & Architecture
```mermaid
graph TD
    %% Clients
    subgraph Client ["Client Browser (React/Vite Frontend)"]
        FE[SPA Frontend]
        Crypto[Web Crypto API: AES-GCM]
    end

    %% API Gateway
    Gateway[API Gateway / Gateway Service <br> FastAPI]

    %% Microservices
    subgraph Services ["Backend Microservices"]
        AuthSvc[Auth Service <br> FastAPI]
        DBSvc[Medical Records DB Service <br> FastAPI]
        Model1Svc[MRI Model Service <br> FastAPI + DenseNet]
        Model2Svc[Tabular Model Service <br> FastAPI + Stacking Model]
        PDFSvc[PDF Generation Service <br> FastAPI + ReportLab]
    end

    %% Databases
    subgraph Databases ["Data Layer"]
        DB[(PostgreSQL Database)]
    end

    %% Connections
    FE -->|HTTPS Request| Gateway
    Gateway -->|Verify JWT / Route| AuthSvc
    Gateway -->|Store Encrypted Blob| DBSvc
    Gateway -->|MRI Image Upload| Model1Svc
    Gateway -->|Predict Plaintext (Temp)| Model2Svc
    Gateway -->|Request Summary PDF| PDFSvc

    AuthSvc -->|Read/Write User Credentials| DB
    DBSvc -->|Read/Write Ciphertext Records| DB
```

---

## 2. Microservice Boundaries

We split the logic into separate microservices to isolate dependencies (e.g., machine learning frameworks vs. database drivers) and allow independent development.

1. **Gateway / Orchestrator Service**:
   - Entry point for the frontend. Handles cross-cutting concerns (CORS, request routing, rate limiting).
   - Validates JWTs issued by the Auth service.
   - Coordinates requests to the inference services and the PDF generator.

2. **Auth Service**:
   - Handles user registration, local login (password hashing using `bcrypt` or `argon2`), Google OAuth.
   - Generates and signs JWT access/refresh tokens.
   - Manages the `users` table in PostgreSQL.

3. **Medical Records Database Service**:
   - Manages storage and retrieval of medical records.
   - Connects to PostgreSQL.
   - **Crucial Security Rule**: This service is zero-knowledge. It only writes and reads encrypted strings (ciphertexts) and does not possess the decryption keys.

4. **Model 1 (MRI Image) Inference Service**:
   - Contains Keras, TensorFlow, and the DenseNet model files.
   - Exposes a single `/predict` endpoint that takes an image and returns classification probabilities.
   - Runs independently (can be deployed on a GPU-enabled node).

5. **Model 2 (Tabular Ensemble) Inference Service**:
   - Contains Scikit-Learn, Joblib, the `scaler.pkl`, and the `stacking_model.pkl`.
   - Exposes a `/predict` endpoint that takes raw patient features, scales them, runs the ensemble, and returns predictions.
   - Does not store any data.

6. **PDF & Support Service**:
   - Generates medical reports using ReportLab.
   - Manages healthcare charity lists and support directories.

---

## 3. End-to-End Encryption (E2EE) Design

Medical records are subject to strict privacy rules. Under true End-to-End Encryption, the server **cannot read** the medical records stored in the database.

### How E2EE Will Work:
1. **Key Derivation (Client Side)**:
   - When a user logs in, the client-side JavaScript takes the user's password (or a separate passphrase).
   - It derives a symmetric key using **PBKDF2** (Password-Based Key Derivation Function 2) with a unique salt (retrieved from the server).
   - The derived key is stored securely in-memory (e.g., in a React State, *never* in `localStorage` or cookies to prevent XSS theft).

2. **Encryption (Client Side)**:
   - Before uploading tabular medical data (age, symptoms, lifestyle factors), the frontend serializes the data to JSON.
   - It encrypts the JSON string using **AES-GCM-256** (via the native browser **Web Crypto API**).
   - The frontend sends the encrypted payload (ciphertext + IV + Salt) to the Gateway to be saved.

3. **Decryption (Client Side)**:
   - When viewing the profile page, the frontend fetches the encrypted payload.
   - It decrypts the ciphertext in the browser using the derived key and renders the plaintext fields.

4. **Running Model 2 (Server-Side Inference)**:
   - Because Model 2 runs on the server, the server needs the plaintext values *momentarily* to compute the prediction.
   - **Protocol**: The client sends the plaintext data in the request body over HTTPS. The Model 2 Service runs the inference, returns the result, and immediately discards the data. It is never written to disk or logged.
   - The prediction result is returned to the client, encrypted client-side, and stored in the database.

---

## 4. PostgreSQL Schema Design

We will replace the MongoDB schemas with a structured PostgreSQL relational schema using **SQLAlchemy** or **SQLModel** as the ORM.

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL, -- Client-side salt for PBKDF2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Medical Records Table (Encrypted)
```sql
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    encrypted_data TEXT NOT NULL,          -- AES-GCM encrypted JSON payload
    iv VARCHAR(64) NOT NULL,               -- Initialization Vector for decryption
    prediction_result VARCHAR(100),        -- Can be encrypted or stored as-is
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Work Division Plan (Between 2 Partners)

To minimize code conflicts, we divide the project cleanly into two scopes: **Core Security & Data** (Partner A) and **Inference & PDF Pipeline** (Partner B).

### Partner A: Authentication, Storage & Encryption Core
*Focuses on user login, security boundaries, database management, and frontend decryption.*

* **Task 1: Auth Service**
  - Set up PostgreSQL connection using SQLAlchemy/SQLModel.
  - Implement login, signup, JWT generation, and Google OAuth flow in FastAPI.
  - Expose API endpoints `/api/auth/register` and `/api/auth/login`.
* **Task 2: Database Service**
  - Create the `medical_records` endpoints (`POST /records`, `GET /records`).
  - Set up CORS and user-scoped data retrieval (ensuring User A cannot request User B's ciphertext).
* **Task 3: Client-Side Crypto & Integration**
  - Create the client-side encryption utility using `crypto.subtle` in the React frontend.
  - Implement key derivation on login.
  - Build the Login/Signup frontend pages and integrate them with the Auth Service.
  - Create the user Profile Page that fetches, decrypts, and displays the medical records.

### Partner B: Machine Learning Inference, Orchestration & PDF Pipeline
*Focuses on AI prediction services, the orchestrator gateway, and document compilation.*

* **Task 1: MRI Model 1 Service**
  - Refactor DenseNet201 image loading and prediction logic from the Flask app into a lightweight FastAPI service.
  - Optimize memory usage (as TensorFlow can be heavy).
* **Task 2: Tabular Model 2 Service**
  - Port the ensemble stacking classifier (`stacking_model.pkl` + `scaler.pkl`) into a FastAPI service.
  - Expose an endpoint `/predict` accepting numerical and categorical inputs.
* **Task 3: API Gateway & PDF Generation**
  - Build the Gateway service (FastAPI) which authenticates requests and proxies them to the model services.
  - Implement the PDF report generation using `ReportLab` based on the prediction results.
  - Build the Frontend MRI upload page and prediction result panels.

---

## 6. Git & Collaboration Workflow

Since you are two developers working in parallel, you should establish a clear Git branching strategy and repository structure to avoid conflicts.

### A. Repository Structure (Monorepo Layout)
We recommend keeping all microservices in a single repository (monorepo). This makes it easy to orchestrate with a single `docker-compose.yml` file and keeps all API contracts aligned.

Here is the proposed folder structure:
```text
memocare/
├── .gitignore
├── README.md
├── docker-compose.yml
├── gateway/                 # API Gateway (FastAPI)
│   ├── Dockerfile
│   └── main.py
├── frontend/                # React/Vite Frontend
│   └── ...
└── services/
    ├── auth/                # Auth Service (FastAPI + PostgreSQL)
    │   ├── Dockerfile
    │   ├── main.py
    │   └── models.py
    ├── db/                  # Medical Records Database Service
    │   ├── Dockerfile
    │   ├── main.py
    │   └── db_config.py
    ├── model_mri/           # MRI Scan Inference (FastAPI + TensorFlow)
    │   ├── Dockerfile
    │   ├── main.py
    │   └── mri_models/      # Weights and models folder
    ├── model_tabular/       # Tabular Ensemble Inference (FastAPI + Scikit-Learn)
    │   ├── Dockerfile
    │   ├── main.py
    │   └── models/          # scaler.pkl and stacking_model.pkl
    └── pdf_reports/         # PDF Report Generator
        ├── Dockerfile
        └── main.py
```

### B. Git Branching Strategy (Feature Branch Workflow)
1. **`main` Branch**:
   - The production-ready codebase.
   - Direct commits to `main` should be restricted.
2. **Feature Branches**:
   - Both developers branch off `main` to work on their respective services.
   - Naming convention: `feature/auth-service`, `feature/mri-model`, `feature/frontend-login`.
3. **Pull Requests (PRs)**:
   - When a service or a feature is ready, open a Pull Request to merge it into `main`.
   - The other partner should review and approve the PR. This is crucial for:
     - Double-checking security practices (like database configurations or key derivation logic).
     - Staying updated on how the other parts of the system are evolving.
     - Catching configuration mismatches before they break local runs.

### C. Step-by-Step Initialization Guide

To initialize the new repository:
1. **Initialize the Local Repository**:
   Navigate to your new repository folder on your machine and run:
   ```bash
   git init
   ```
2. **Create the Project Skeleton**:
   Create the base directories (e.g., `gateway`, `frontend`, `services/auth`, etc.).
3. **Add a `.gitignore` File**:
   Create a root `.gitignore` to prevent committing massive models, environment files, database logs, and dependencies:
   ```text
   # Python
   __pycache__/
   *.pyc
   .venv/
   venv/
   .env

   # Node/Frontend
   node_modules/
   dist/

   # ML Models (Do not commit large model weights if they exceed 50MB; use Git LFS or external storage download script)
   # *.h5
   # *.pkl

   # System & IDEs
   .idea/
   .vscode/
   .DS_Store
   ```
4. **Make the Initial Commit**:
   ```bash
   git add .
   git commit -m "chore: initialize monorepo skeleton and gitignore"
   ```
5. **Link to Remote and Push**:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

---

## 7. Trade-off Analysis & Discussion

### Trade-off 1: Client-Side E2EE vs. Server-Side Encryption
* **Client-Side E2EE (Recommended)**:
  * *Pros*: Ultimate privacy. Even if the PostgreSQL database is breached, the attacker only gets useless encrypted blocks. HIPAA compliant.
  * *Cons*: If the user forgets their password, their data cannot be recovered by the site administrator (since the administrator does not have the key). Password recovery is only possible if they save a recovery phrase (like in crypto wallets) or if we implement complex key-recovery systems.
* **Server-Side Encryption (Envelope Encryption via KMS)**:
  * *Pros*: Password resets are simple. We can index and search data if needed.
  * *Cons*: If the server itself is compromised, the attacker can access the KMS key and decrypt the database.

### Trade-off 2: Web Crypto API vs. WASM / JS Encryption Libraries
* **Web Crypto API (Recommended)**:
  * *Pros*: Native browser API, implemented in C++ in the browser engine. Extremely fast, secure from side-channel attacks, and requires no external packages (reducing npm supply-chain risk).
  * *Cons*: Slightly lower-level API that requires careful code to handle array buffers.
* **CryptoJS / Node-Forge**:
  * *Pros*: Simpler JS wrapper.
  * *Cons*: Slower, adds bundle weight, open to supply-chain exploits.

### Trade-off 3: Microservices vs. Monolith (for 2 Developers)
* **Microservices (Proposed)**:
  * *Pros*: Absolute independence. Dev A can upgrade python packages in the MRI service without affecting the database service.
  * *Cons*: Requires running multiple Docker containers locally. Higher system resources (running TensorFlow and Scikit-Learn in separate python processes).

---

## 8. Open Questions

> [!IMPORTANT]
> Please review and provide feedback on the following questions:
> 1. **Password Recovery**: Under client-side encryption, how should we handle password recovery? (Options: A. User loses their records on password reset; B. We generate a downloadable recovery key; C. We store a key encrypted with a secondary key derived from security questions).
> 2. **MRI Images Encryption**: Do you want MRI scans to also be E2E encrypted in the database, or just the tabular medical data? (MRI scans are large, so encrypting/decrypting them on the client side takes more memory but is safer).
> 3. **Monorepo vs. Multi-repo**: Do you prefer to keep all services in a single repository (monorepo) using Docker Compose to orchestrate, or split them into separate repositories? (We recommend a monorepo for easier coordination).
