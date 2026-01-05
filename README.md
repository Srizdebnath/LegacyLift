
<div align="center">
  <h1>🚀 LegacyLift</h1>
  <h3><i>"Transforming Legacy Code into Modern Masterpieces"</i></h3>
  
  <p>
    Built for <strong>GDGoC GCELT TECHSPRINT Hackathon</strong> by Team <strong>Khasta Kochuri</strong>
  </p>

  <p>
    <a href="https://legacylift-eight.vercel.app/">
      <img src="https://img.shields.io/badge/Live_Demo-Visit_Site-2ea44f?style=for-the-badge&logo=vercel" alt="Live Demo" />
    </a>
    <a href="https://youtu.be/e9O3huM-emw?feature=shared">
      <img src="https://img.shields.io/badge/Demo_Video-Watch_on_YouTube-FF0000?style=for-the-badge&logo=youtube" alt="Demo Video" />
    </a>
    <a href="https://legacylift-backend.onrender.com/">
      <img src="https://img.shields.io/badge/Backend_API-Active-blue?style=for-the-badge&logo=python" alt="Backend API" />
    </a>
  </p>
  
  <p>
    <img src="https://img.shields.io/badge/Powered%20By-Gemini%202.5%20Flash-purple?style=flat-square" />
    <img src="https://img.shields.io/badge/Stack-Next.js_15_|_FastAPI-black?style=flat-square" />
  </p>
</div>

---

## � The Problem
Legacy code is the silent killer of innovation. Companies spend **42% of developer time** maintaining "spaghetti code" that no one understands. Migrating it is risky, slow, and expensive.

## 🛠️ The Solution: LegacyLift
**LegacyLift** is an **Autonomous AI Architect** that ingests entire repositories, understands the logic, and **modernizes them automatically**. 

Unlike simple autocomplete tools, LegacyLift understands the *entire context* of a project (1M+ tokens) to perform system-wide refactors, security patches, and language migrations—all while generating ready-to-merge Pull Requests.

---

## 🌟 Key Features

### 🧠 Deep Context Awareness
- **Full-Repo Ingestion**: Drag & Drop a `.zip` or just paste a GitHub URL. We ingest it all.
- **Smart Caching**: Intelligently switches between RAM (fast access) and **Google GenAI Context Cache** (massive scale) to handle million-line codebases instantly.
- **Polyglot Master**: Fluent in Java, Python, PHP, JavaScript, Go, C++, and COBOL.

### ⚡ Autonomous Refactoring Agent
- **Streaming Architect**: Watch as the AI reasons through architectural changes in real-time.
- **Auto-PR Agent**: It doesn't just suggest code; it **writes it, branches it, and opens a PR** on GitHub for you.
- **Audit Trail**: Every action is logged in Mission Control for complete compliance.

### 🕹 Mission Control Dashboard
- **Live Activity Feed**: Monitor refinements as they happen.
- **Multi-Source**: seamlessly manage local uploads and remote repositories.

---

## 🏗 System Architecture

We built a transparent **Ingest -> Reason -> Execute** pipeline:

1.  **Ingestion & Flattening**: 
    -   Repositories are cloned/uploaded and flattened into a context-optimized format.
2.  **Cognitive Layer (Gemini 2.5)**: 
    -   The flattened codebase is cached with a 1M+ token context window, allowing the AI to "hold" the entire system in memory.
3.  **Application Layer (Next.js 16)**: 
    -   A beautiful, high-performance UI where users interact via natural language (e.g., *"Migrate this Flask app to FastAPI"*).
4.  **Execution Layer**:
    -   **Refactor**: AI streams diffs to the user.
    -   **Action**: PyGithub integration executes the git commands to finalize the work.

---

## 🛠 Tech Stack

### Client (Frontend)
-   **Framework**: Next.js 16 (App Router)
-   **Styling**: Tailwind CSS v4, Framer Motion (Animations), Lucide React
-   **Auth**: Firebase Authentication
-   **Deployment**: Vercel

### Server (Backend)
-   **Runtime**: Python 3.12+
-   **Core**: Flask
-   **AI**: Google GenAI SDK (Gemini 2.5 Flash)
-   **Database**: Firebase Firestore (NoSQL)
-   **Storage**: Firebase Cloud Storage
-   **Hosting**: Render

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.12+
- Firebase & Google Cloud API Keys

### Quick Setup

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/Srizdebnath/LegacyLift.git
    cd LegacyLift
    ```

2.  **Backend Setup**
    ```bash
    cd legacylift/server
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    
    # Configure .env with FLASK_SECRET, GEMINI_API_KEY, GITHUB_CLIENT_ID...
    python app.py
    ```

3.  **Frontend Setup**
    ```bash
    cd ../client
    npm install
    npm run dev
    ```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/upload` | Ingests `.zip` archives. |
| **POST** | `/github/ingest` | Clones & caches GitHub repos. |
| **POST** | `/refactor` | Streams AI architectural plans. |
| **POST** | `/github/create_pr` | **The Magic Button** - creates the PR. |

---

## 👥 Team Khasta Kochuri

Made with ❤️ and code by:

-   **Sriz Debnath** - AI System & Automation
-   **Shilajit Khan** - Backend Engineering
-   **Subhajit Patra** - Frontend Engineering

---

<div align="center">
  <i>"Legacy code is just code that works. We make it work better."</i>
</div>
