#  LegacyLift (Enterprise Edition)

> **Resurrecting Legacy Code with Gemini 2.5 & Google Cloud Context Caching.**

![Status](https://img.shields.io/badge/Status-Hackathon_Ready-success)
![Tech](https://img.shields.io/badge/Stack-Google_Gemini_|_Firebase_|_Next.js-blue)


## 📖 Overview
**LegacyLift** is an AI-powered architectural modernization tool. Unlike standard coding assistants that look at single files, LegacyLift ingests **entire repositories** (ZIP or GitHub) into **Gemini 2.5's massive context window**. 

It understands global dependencies, business logic, and architectural debt, allowing it to:
1.  **Refactor** 20-year-old code (PHP, COBOL, Java) to modern stacks.
2.  **Audit** security vulnerabilities across the whole project.
3.  **Auto-Pilot** GitHub Pull Requests to fix issues instantly.

---

## 🛠 Tech Stack (The "Google Powerhouse")

| Component | Technology | Usage |
| :--- | :--- | :--- |
| **AI Engine** | **Google Gemini 2.5 Flash** | The reasoning brain. We use the **Context Caching API** to load 1M+ tokens once and query cheaply. |
| **Auth & Identity** | **Firebase Authentication** | Secure Google Login & Identity Management. |
| **Database** | **Cloud Firestore** | Storing user project history, audit logs, and refactoring queries. |
| **Storage** | **Firebase Cloud Storage** | Secure archiving of uploaded legacy zip files. |
| **Backend** | **Python Flask** | Orchestrates the AI pipeline, handles GitHub OAuth, and manages caching strategies. |
| **Frontend** | **Next.js 15 + Tailwind** | Enterprise-grade "Glassmorphism" UI with real-time streaming. |
| **Integration** | **GitHub API** | For cloning repos and programmatically raising Pull Requests. |

---

## ⚙️ How It Works (Architecture)

1.  **Ingestion:** User uploads a `.zip` or connects a GitHub Repo.
2.  **Tokenization:** The backend flattens the directory structure into a single context stream.
3.  **Smart Caching:** 
    *   If the repo is large (>30k tokens), we create a **Google Context Cache** (TTL 1 Hour).
    *   If small, we use an in-memory fallback to save costs.
4.  **Reasoning:** The user prompts (e.g., "Migrate this to Go"). Gemini 2.5 analyzes the *cached* context.
5.  **Action:** 
    *   **Stream:** Code is generated in real-time.
    *   **Agent:** A JSON plan is created to commit files and open a PR on GitHub automatically.

---

## 🔌 API Documentation

Base URL: `http://localhost:5000`

### 1. Upload & Cache
**POST** `/upload`
*   **Headers:** `Authorization: Bearer <FIREBASE_ID_TOKEN>`
*   **Body:** `form-data` -> `file: <legacy_code.zip>`
*   **Response:** `{ "status": "success", "cache_name": "...", "token_count": 45000 }`

### 2. GitHub Ingest
**POST** `/github/ingest`
*   **Headers:** `Authorization: Bearer <FIREBASE_ID_TOKEN>`
*   **Body:** `{ "token": "<GH_OAUTH_TOKEN>", "repo_name": "user/repo" }`
*   **Description:** Clones repo, extracts text, uploads to Gemini Context Cache.

### 3. Refactor (Streaming)
**POST** `/refactor`
*   **Headers:** `Authorization: Bearer <FIREBASE_ID_TOKEN>`
*   **Body:** `{ "cache_name": "...", "query": "Fix SQL Injections" }`
*   **Response:** Server-Sent Events (SSE) stream of the new code.

### 4. Auto-PR Agent
**POST** `/github/create_pr`
*   **Headers:** `Authorization: Bearer <FIREBASE_ID_TOKEN>`
*   **Body:** `{ "token": "...", "repo_name": "...", "query": "...", "cache_name": "..." }`
*   **Description:** AI generates a patch plan, creates a branch, pushes code, and opens a PR.

---

## 💻 Local Development Setup

### Prerequisites
*   Node.js 18+
*   Python 3.10+
*   Google AI Studio API Key
*   Firebase Project (Auth, Firestore, Storage enabled)
*   GitHub OAuth App Credentials

### 1. Backend (Flask)
```bash
cd server
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Create .env file with:
# GEMINI_API_KEY=...
# GITHUB_CLIENT_ID=...
# GITHUB_CLIENT_SECRET=...
# FLASK_SECRET=...

# Add serviceAccountKey.json from Firebase
python app.py