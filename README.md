# LegacyLift - Enterprise AI Legacy Code Modernizer

LegacyLift is an autonomous AI Architect designed to ingest, analyze, and modernize legacy codebases at scale. Leveraging **Google Gemini 2.5 Flash** with massive context caching (1M+ tokens), it understands entire repositories to automatically generate Pull Requests for refactoring, security patches, and technology migrations.

![LegacyLift Banner](https://img.shields.io/badge/Status-Beta-blue?style=for-the-badge) ![Gemini](https://img.shields.io/badge/Powered%20By-Gemini%202.5-purple?style=for-the-badge) 

---

## 🚀 Key Features

### 🧠 Deep Context Awareness
- **Massive Ingestion**: Supports ingesting complete repositories via Zip upload or direct GitHub cloning.
- **Smart Caching**: Intelligently switches between RAM (for small files) and Google GenAI Context Cache (for large repos >30k tokens) to optimize speed and cost.
- **Polyglot Support**: Native understanding of Java, Python, PHP, JavaScript, TypeScript, Go, C++, and SQL.

### ⚡ Autonomous Refactoring Agent
- **Streaming Architect**: Real-time logic transformation suggestions streamed directly to the frontend.
- **Auto-PR Agent**: Automatically creates a branch, pushes code, and opens a Pull Request on GitHub with a comprehensive description.
- **Audit Trail**: Every refactor and PR is logged in the `Mission Control` dashboard for compliance and tracking.

### 🕹 Mission Control Dashboard
- **Activity Feed**: Live feed of all refactoring jobs and pull requests across the team.
- **Real-time Stats**: Track total refactors, PRs created, and system operational status.
- **Multi-Source Management**: Switch seamlessly between local archives and remote GitHub repositories.

---

## 🏗 System Architecture

The system follows a transparent **Ingest -> Reason -> Execute** pipeline:

1.  **Ingestion Layer**:
    -   **Local**: Encrypted Zip uploads to Firebase Cloud Storage.
    -   **Remote**: PyGithub integration to clone public/private repositories.
2.  **Processing Layer**:
    -   Backend recursively flattens the codebase.
    -   Content is tokenized and loaded into **Gemini 2.5 Flash**.
3.  **Application Layer (Next.js)**:
    -   User issues natural language commands (e.g., *"Convert all raw SQL queries in user.php to PDO prepared statements"*).
4.  **Execution Layer**:
    -   **Refactor**: AI streams the diff/solution back to the UI.
    -   **Action**: AI interacts with the GitHub API to commit changes and raise a PR.

---

## 🛠 Technology Stack

### Client (Frontend)
-   **Framework**: Next.js 16 (App Router, React 19)
-   **Styling**: Tailwind CSS v4, Lucide React (Icons)
-   **Auth**: Firebase Authentication (Google & GitHub OOP)
-   **State**: React Hooks & Suspense
-   **Deployment**: Vercel (Recommended)

### Server (Backend)
-   **Runtime**: Python 3.10+
-   **Framework**: Flask, Gunicorn (Production WSGI)
-   **AI Engine**: Google GenAI SDK (Gemini 2.5 Flash)
-   **Database**: Firebase Firestore (NoSQL for Logs/Stats)
-   **Storage**: Firebase Cloud Storage (Archives)
-   **Integration**: PyGithub, Dotenv

---

## ⚙️ Installation & Configuration

### Prerequisites
-   Node.js v18+ & npm
-   Python v3.10+
-   Firebase Project (Auth, Firestore, Storage enabled)
-   Google Cloud Project (Gemini API enabled)
-   GitHub OAuth App

### 1. Repository Setup
```bash
git clone https://github.com/yourusername/LegacyLift.git
cd LegacyLift
```

### 2. Backend (Flask)
```bash
cd legacylift/server

# Create Virtual Env
python -m venv venv
# Windows: .\venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt
```

**Configuration**: Create `legacylift/server/.env`:
```env
FLASK_SECRET=your_super_secret_key
GEMINI_API_KEY=your_google_gemini_key
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Firebase**: Place your `serviceAccountKey.json` from Firebase Console in `legacylift/server/`.

**Run Server**:
```bash
python app.py
# Production: gunicorn app:app
```

### 3. Client (Next.js)
```bash
cd ../client
npm install
```

**Configuration**: Create `legacylift/client/.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Environment Config**: The app automatically switches API URLs based on environment:
-   **Development**: `http://localhost:5000`
-   **Production**: `https://legacylift-backend.onrender.com` (Configurable in `lib/config.ts`)

**Run Client**:
```bash
npm run dev
```

---

## 📡 API Documentation

### Auth & User
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/dashboard` | Returns user stats (refactors, PRs) and activity feed. |
| **GET** | `/login/github` | Initiates GitHub OAuth flow. |

### Ingestion
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/upload` | Uploads .zip, extracts code, and creates Gemini Cache. |
| **POST** | `/github/ingest` | Clones a GitHub repo and creates Gemini Cache. |
| **POST** | `/github/repos` | Lists recent repositories for the authenticated user. |

### AI Actions
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/refactor` | Streams architectural changes based on natural language query. |
| **POST** | `/github/create_pr` | Generates code, creates a branch, commits, and opens a PR. |

**Security Note**: All protected endpoints require `Authorization: Bearer <firebase_id_token>` header.

---

## 👥 Team Khasta Kochuri
-   **Sriz Debnath** - AI System & Automation
-   **Shilajit Khan** - Backend Engineering
-   **Subhajit Patra** - Frontend Engineering

---

