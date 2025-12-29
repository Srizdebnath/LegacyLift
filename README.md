# LegacyLift - Enterprise AI Legacy Code Modernizer

LegacyLift is an AI-powered architect designed to ingest, analyze, and modernize legacy codebases. Leveraging **Google Gemini 2.5 Flash** with massive context caching (1M+ tokens), it can understand entire repositories and automatically generate Pull Requests to refactor, fix security vulnerabilities, or migrate technologies.

![LegacyLift Banner](https://img.shields.io/badge/Status-Beta-blue?style=for-the-badge) ![Gemini](https://img.shields.io/badge/Powered%20By-Gemini%202.5-purple?style=for-the-badge)

---

## � Features

- **Context Caching**: Ingests massive repositories (Zip upload or GitHub clone) into Gemini's "Smart Cache" for deep architectural understanding.
- **Streaming Refactoring**: Real-time code transformation suggestions streamed directly to the dashboard.
- **Auto-PR Agent**: Automatically creates a branch, commits changes, and opens a Pull Request on GitHub with the proposed fixes.
- **Dual Ingestion Mode**:
    - **Zip Archive**: Upload local legacy projects (encrypted & stored in Firebase).
    - **GitHub Repo**: Direct integration to clone and analyze private/public repositories.
- **Secure Pipeline**: End-to-end encryption using Firebase Auth & Cloud Storage.

---

## 🏗 Architecture

**Conceptual Flow:**
1.  **Ingestion**: User uploads a Zip or selects a GitHub Repo.
2.  **Processing**: Backend extracts code, identifying key files (JS, PY, Java, SQL, etc.).
3.  **Tokenization**: Content is sent to Google Gemini's **Context Cache** (RAM fallback for small repos).
4.  **Reasoning**: User queries (e.g., "Migrate to TypeScript") are processed against the cached context.
5.  **Execution**: AI streams the solution or executes a GitHub Action to raise a PR.

---

## 🛠 Tech Stack

### Client (Frontend)
-   **Framework**: Next.js 16 (React 19)
-   **Styling**: Tailwind CSS v4
-   **Auth**: Firebase Authentication (Google & GitHub Providers)
-   **UI**: Lucide React, Glassmorphism Design
-   **State**: React Hooks & Context

### Server (Backend)
-   **Runtime**: Python 3.10+
-   **Framework**: Flask
-   **AI Engine**: Google GenAI SDK (Gemini 2.5 Flash)
-   **Database**: Firebase Firestore (Logs, Audit Trails)
-   **Storage**: Firebase Cloud Storage (Archives)
-   **Integration**: PyGithub (GitHub API)

---

## ⚙️ Installation & Setup

### Prerequisites
-   Node.js (v18+) & npm
-   Python (v3.10+)
-   Firebase Project (Auth, Firestore, Storage enabled)
-   Google Cloud Project with Gemini API enabled
-   GitHub OAuth App

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/LegacyLift.git
cd LegacyLift
```

### 2. Backend Setup
Navigate to the server directory:
```bash
cd legacylift/server
```

Create a virtual environment and install dependencies:
```bash
python -m venv venv
# Windows
.\venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

**Configuration (.env):**
Create a `.env` file in `server/`:
```env
FLASK_SECRET=your_super_secret_key
GEMINI_API_KEY=your_google_gemini_key
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
```

**Firebase Admin SDK:**
Download your service account JSON from Firebase Console -> Project Settings -> Service Accounts. Save it as `serviceAccountKey.json` in the `server/` directory.

**Run Server:**
```bash
python app.py
```
*Server runs on `http://localhost:5000`*

### 3. Frontend Setup
Navigate to the client directory:
```bash
cd ../client
```

Install dependencies:
```bash
npm install
```

**Configuration (.env.local):**
Create `.env.local` in `client/` with your Firebase public config:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**Run Client:**
```bash
npm run dev
```
*Client runs on `http://localhost:3000`*

---

## 📡 API Documentation

### 1. Upload Archive
**POST** `/upload`
Uploads a zip file, extracts content, and initializes Gemini Cache.
-   **Headers**: `Authorization: Bearer <firebase_token>`
-   **Body**: `multipart/form-data` -> `file: <zip_file>`
-   **Response**: `{ "status": "success", "cache_name": "...", "token_count": 12345 }`

### 2. Ingest GitHub Repo
**POST** `/github/ingest`
Clones a GitHub repo and initializes Gemini Cache.
-   **Headers**: `Authorization: Bearer <firebase_token>`
-   **Body**: `{ "token": "<gh_oauth_token>", "repo_name": "user/repo" }`
-   **Response**: `{ "status": "success", "cache_name": "...", "token_count": 12345 }`

### 3. Stream Refactoring
**POST** `/refactor`
Streams AI-generated code modernization suggestions.
-   **Headers**: `Authorization: Bearer <firebase_token>`
-   **Body**: `{ "cache_name": "...", "query": "Refactor login.php to use PDO" }`
-   **Response**: Server-Sent Events (SSE) stream.

### 4. Create Pull Request
**POST** `/github/create_pr`
Generates a fix, creates a branch, and opens a PR.
-   **Headers**: `Authorization: Bearer <firebase_token>`
-   **Body**: `{ "token": "...", "repo_name": "...", "cache_name": "...", "query": "Fix SQL Injection" }`
-   **Response**: `{ "status": "success", "pr_url": "https://github.com/..." }`

### 5. List Repos
**POST** `/github/repos`
Lists the user's recent GitHub repositories.
-   **Body**: `{ "token": "<gh_oauth_token>" }`
-   **Response**: JSON array of repos.

---

## 🤝 Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---


## 👥 Team Khasta Kochuri
- **Sriz Debnath** - AI System & Automation
- **Shilajit Khan** - Backend Engineering
- **Subhajit Patra** - Frontend Engineering