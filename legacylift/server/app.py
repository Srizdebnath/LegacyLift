import os
import json
import glob
import zipfile
import tempfile
import time
import requests
import uuid
from flask import Flask, request, Response, jsonify, redirect
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv
from github import Github, GithubException

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "dev_secret")

# Enable CORS (Allow localhost:3000 to send credentials/headers)
CORS(app, supports_credentials=True) 

# --- CONFIGURATION ---
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
GH_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID")
GH_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")

# Initialize Gemini Client
client = genai.Client(api_key=GEMINI_KEY)

# MODEL: Use 'gemini-2.5-flash' for speed/rate-limits. 
# Fallback to 'gemini-1.5-flash-002' if 2.5 isn't available in your region.
MODEL_ID = "gemini-2.5-flash" 

# --- IN-MEMORY STORAGE (Hackathon "Database") ---
# Stores code content for small repos that don't fit in Google's Cache (>32k tokens)
fallback_memory = {}

# --- HELPERS ---

def extract_code_from_zip(zip_path):
    """Flattens a zip file into a single text string."""
    code_content = ""
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_ref.extractall(temp_dir)
            for filepath in glob.glob(f'{temp_dir}/**/*', recursive=True):
                if os.path.isfile(filepath):
                    # Filter: Only read code files
                    if filepath.endswith(('.java', '.php', '.py', '.js', '.ts', '.css', '.html', '.sql', '.cob', '.c', '.cpp', '.h')):
                        try:
                            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                                rel_path = os.path.relpath(filepath, temp_dir)
                                code_content += f"\n--- START FILE: {rel_path} ---\n"
                                code_content += f.read()
                                code_content += f"\n--- END FILE: {rel_path} ---\n"
                        except Exception:
                            pass
    return code_content

def clean_gemini_json(text):
    """Sanitizes Gemini output to ensure valid JSON."""
    text = text.strip()
    # Remove markdown fencing if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Find start and end of code block
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines)
    return json.loads(text)

def create_context_cache_or_ram(content, display_name):
    """
    Decides whether to use Google Context Cache (for big files) 
    or RAM (for small files) to avoid 400 errors.
    """
    # Rough token count (1 token ~= 4 chars)
    est_tokens = len(content) // 4
    
    # Google Cache requires ~32,000 tokens minimum
    if est_tokens < 30000:
        print(f"Repo too small ({est_tokens} tokens). Using RAM Fallback.")
        fake_id = str(uuid.uuid4())
        fallback_memory[fake_id] = content
        return {"cache_name": fake_id, "token_count": est_tokens, "mode": "ram"}
    
    # Use Real Google Cache
    try:
        print(f"Creating Google Cache for {display_name}...")
        cache = client.caches.create(
            model=MODEL_ID,
            config=types.CreateCachedContentConfig(
                display_name=display_name,
                system_instruction="You are a Senior Software Architect. You have access to the entire codebase.",
                contents=[content],
                ttl="3600s"
            )
        )
        return {
            "cache_name": cache.name, 
            "token_count": cache.usage_metadata.total_token_count, 
            "mode": "google_cache"
        }
    except Exception as e:
        print(f"Cache creation failed: {e}. Falling back to RAM.")
        fake_id = str(uuid.uuid4())
        fallback_memory[fake_id] = content
        return {"cache_name": fake_id, "token_count": est_tokens, "mode": "fallback_ram"}

# --- ROUTES: AUTHENTICATION ---

@app.route('/login/github')
def login_github():
    """Redirects user to GitHub for authorization."""
    return redirect(f"https://github.com/login/oauth/authorize?client_id={GH_CLIENT_ID}&scope=repo")

@app.route('/github/callback')
def github_callback():
    """Handles the callback from GitHub."""
    code = request.args.get('code')
    
    # Exchange code for token
    token_resp = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": GH_CLIENT_ID,
            "client_secret": GH_CLIENT_SECRET,
            "code": code
        }
    )
    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    
    # Redirect to Frontend with token (Simple Hackathon approach)
    # Note: In production, store this in a secure HttpOnly cookie
    return redirect(f"http://localhost:3000?gh_token={access_token}")

# --- ROUTES: REPO MANAGEMENT ---

@app.route('/github/repos', methods=['POST'])
def list_repos():
    """Lists the user's recent repositories."""
    token = request.json.get('token')
    if not token: return jsonify({"error": "Unauthorized"}), 401
    
    g = Github(token)
    user = g.get_user()
    
    # Fetch last 15 pushed repos
    repos = []
    try:
        for repo in user.get_repos(sort="pushed", direction="desc"):
            if len(repos) >= 15: break
            repos.append({
                "id": repo.id,
                "name": repo.full_name,
                "private": repo.private,
                "pushed_at": str(repo.pushed_at)
            })
        return jsonify(repos)
    except GithubException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/github/ingest', methods=['POST'])
def ingest_github():
    """Downloads a GitHub repo and loads it into context."""
    data = request.json
    token = data.get('token')
    repo_name = data.get('repo_name')
    
    g = Github(token)
    try:
        repo = g.get_repo(repo_name)
    except:
        return jsonify({"error": "Repo not found"}), 404
    
    # Recursive fetch (Hackathon limit: max 50 files to be fast)
    full_code = ""
    file_count = 0
    contents = repo.get_contents("")
    queue = []
    
    if isinstance(contents, list):
        queue.extend(contents)
    else:
        queue.append(contents)
        
    while queue and file_count < 60:
        file_content = queue.pop(0)
        if file_content.type == "dir":
            try:
                queue.extend(repo.get_contents(file_content.path))
            except: pass
        else:
            # Only ingest textual code files
            if file_content.path.endswith(('.php', '.js', '.ts', '.py', '.java', '.go', '.html', '.css', '.sql')):
                try:
                    full_code += f"\n--- START FILE: {file_content.path} ---\n"
                    full_code += file_content.decoded_content.decode("utf-8")
                    full_code += f"\n--- END FILE: {file_content.path} ---\n"
                    file_count += 1
                except:
                    pass

    # Store in Cache or RAM
    result = create_context_cache_or_ram(full_code, f"GH_{repo_name.replace('/', '_')}")
    return jsonify({"status": "success", **result})

@app.route('/upload', methods=['POST'])
def upload_repo():
    """Standard Zip Upload Route."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip:
        file.save(temp_zip.name)
        full_code_text = extract_code_from_zip(temp_zip.name)
        
    result = create_context_cache_or_ram(full_code_text, "Uploaded_Zip_Repo")
    return jsonify({"status": "success", **result})

# --- ROUTES: AI ACTION ---

@app.route('/refactor', methods=['POST'])
def refactor_stream():
    """Streams the AI response to the frontend."""
    data = request.json
    cache_name = data.get('cache_name')
    query = data.get('query')
    
    if not cache_name or not query:
        return jsonify({"error": "Missing params"}), 400

    def generate():
        time.sleep(0.5) # Prevent instant rate-limit hit
        
        # Check Fallback RAM
        if cache_name in fallback_memory:
            full_context = fallback_memory[cache_name]
            # Construct a massive prompt manually
            prompt = f"SYSTEM: You are a Legacy Code Expert.\nCONTEXT:\n{full_context}\n\nUSER REQUEST: {query}"
            
            response_stream = client.models.generate_content_stream(
                model=MODEL_ID,
                contents=prompt
            )
        else:
            # Use Real Google Cache
            try:
                response_stream = client.models.generate_content_stream(
                    model=MODEL_ID,
                    contents=query,
                    config=types.GenerateContentConfig(cached_content=cache_name)
                )
            except Exception as e:
                yield f"data: Error with Google Cache: {str(e)}\n\n"
                return

        # Stream Logic
        for chunk in response_stream:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"

    return Response(generate(), mimetype='text/event-stream')

@app.route('/github/create_pr', methods=['POST'])
def create_pr():
    """The 'Agent' that creates a real PR on GitHub."""
    data = request.json
    token = data.get('token')
    repo_name = data.get('repo_name')
    query = data.get('query')
    cache_name = data.get('cache_name')
    
    # 1. Ask Gemini for the Git Plan (Strict JSON)
    prompt = f"""
    Based on this request: "{query}"
    
    Generate a JSON plan to fix the code.
    RULES:
    1. Output ONLY valid JSON. No markdown.
    2. Branch name must be unique/descriptive.
    3. Include complete file content for modified files.
    
    JSON STRUCTURE:
    {{
        "branch_name": "fix/modernize-auth",
        "pr_title": "Refactor: Security Update",
        "pr_body": "Updated login.php to use PDO...",
        "files": [
            {{ "path": "src/login.php", "content": "<?php ...full code..." }}
        ]
    }}
    """
    
    try:
        # Fetch the Plan (from RAM or Cache)
        if cache_name in fallback_memory:
            full_context = fallback_memory[cache_name]
            final_prompt = f"CONTEXT:\n{full_context}\n\n{prompt}"
            resp = client.models.generate_content(model=MODEL_ID, contents=final_prompt)
        else:
            resp = client.models.generate_content(
                model=MODEL_ID, 
                contents=prompt,
                config=types.GenerateContentConfig(cached_content=cache_name)
            )
            
        plan = clean_gemini_json(resp.text)
        
        # 2. Execute Git Operations
        g = Github(token)
        repo = g.get_repo(repo_name)
        
        # Get Source SHA
        sb = repo.get_branch(repo.default_branch)
        
        # Create Branch
        # Add timestamp to ensure uniqueness
        branch_ref = f"{plan['branch_name']}-{int(time.time())}"
        repo.create_git_ref(ref=f"refs/heads/{branch_ref}", sha=sb.commit.sha)
        
        # Commit Files
        for f in plan['files']:
            try:
                # Update existing
                contents = repo.get_contents(f['path'], ref=branch_ref)
                repo.update_file(
                    contents.path, 
                    f"Refactor {f['path']}", 
                    f['content'], 
                    contents.sha, 
                    branch=branch_ref
                )
            except:
                # Create new
                repo.create_file(
                    f['path'], 
                    f"Create {f['path']}", 
                    f['content'], 
                    branch=branch_ref
                )
        
        # Create Pull Request
        pr = repo.create_pull(
            title=plan['pr_title'],
            body=plan['pr_body'],
            head=branch_ref,
            base=repo.default_branch
        )
        
        return jsonify({"status": "success", "pr_url": pr.html_url})
        
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)