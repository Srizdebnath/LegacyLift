import os
import json
import glob
import zipfile
import tempfile
import time
import requests
import uuid
import datetime
from flask import Flask, request, Response, jsonify, redirect
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv
from github import Github, GithubException

# FIREBASE ADMIN SDK
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET", "super_secret_dev_key")

# Enable CORS (Allow localhost:3000 to send credentials/headers)
CORS(app, supports_credentials=True) 

# --- FIREBASE CONFIGURATION ---
# 1. Load the Service Account Key
if not os.path.exists("serviceAccountKey.json"):
    print("WARNING: serviceAccountKey.json not found! Firebase features will crash.")
else:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {
        # REPLACE THIS WITH YOUR ACTUAL BUCKET NAME FROM FIREBASE CONSOLE -> STORAGE
        'storageBucket': 'legacylift-597a3.firebasestorage.app' 
    })

db = firestore.client()
bucket = storage.bucket()

# --- GEMINI & GITHUB CONFIG ---
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
GH_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID")
GH_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")

# Use Gemini 2.5 Flash for speed/cost efficiency
MODEL_ID = "gemini-2.5-flash" 
client = genai.Client(api_key=GEMINI_KEY)

# RAM Storage for small repos (fallback for Google Cache)
fallback_memory = {}

# --- HELPER FUNCTIONS ---

def verify_firebase_token(request):
    """
    Middleware to protect routes.
    Expects header: 'Authorization: Bearer <firebase_id_token>'
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    try:
        token = auth_header.split(" ")[1]
        decoded_token = auth.verify_id_token(token)
        return decoded_token # Returns dict with 'uid', 'email', etc.
    except Exception as e:
        print(f"Auth Verification Failed: {e}")
        return None

def extract_code_from_zip(zip_path):
    """Flattens a zip file into a single text string."""
    code_content = ""
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_ref.extractall(temp_dir)
            for filepath in glob.glob(f'{temp_dir}/**/*', recursive=True):
                if os.path.isfile(filepath):
                    if filepath.endswith(('.java', '.php', '.py', '.js', '.ts', '.css', '.html', '.sql', '.go', '.c', '.cpp')):
                        try:
                            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                                rel_path = os.path.relpath(filepath, temp_dir)
                                code_content += f"\n--- START FILE: {rel_path} ---\n"
                                code_content += f.read()
                                code_content += f"\n--- END FILE: {rel_path} ---\n"
                        except: pass
    return code_content

def clean_gemini_json(text):
    """Sanitizes AI output to ensure valid JSON."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Strip first line (```json) and last line (```)
        if lines[0].startswith("```"): lines = lines[1:]
        if lines[-1].startswith("```"): lines = lines[:-1]
        text = "\n".join(lines)
    return json.loads(text)

def create_smart_cache(content, display_name, user_id="anon"):
    """
    Intelligent Caching:
    - Small Files -> RAM (Free, Fast)
    - Big Files -> Google Context Cache (Scalable)
    """
    est_tokens = len(content) // 4
    
    # 30k limit is roughly where Google Cache minimum starts
    if est_tokens < 30000:
        fake_id = str(uuid.uuid4())
        fallback_memory[fake_id] = content
        return {"cache_name": fake_id, "token_count": est_tokens, "mode": "ram"}
    
    try:
        cache = client.caches.create(
            model=MODEL_ID,
            config=types.CreateCachedContentConfig(
                display_name=f"{user_id}_{display_name}"[:40], # Limit name length
                system_instruction="You are a Senior Software Architect. Analyze code deeply.",
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
        print(f"Cache Error: {e}")
        # Fallback to RAM if cache fails
        fake_id = str(uuid.uuid4())
        fallback_memory[fake_id] = content
        return {"cache_name": fake_id, "token_count": est_tokens, "mode": "fallback_ram"}

# --- ROUTES: UPLOAD & INGEST ---

@app.route('/upload', methods=['POST'])
def upload_repo():
    # 1. Verify User
    user = verify_firebase_token(request)
    if not user: return jsonify({"error": "Unauthorized"}), 401

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    
    # 2. Upload to Firebase Cloud Storage (Permanent Archive)
    try:
        filename = f"users/{user['uid']}/uploads/{int(time.time())}_{file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(file.stream, content_type='application/zip')
        
        # Rewind file stream to read it again for processing
        file.stream.seek(0)
    except Exception as e:
        print(f"Storage Error: {e}") 
        # We continue even if storage fails for the hackathon demo
    
    # 3. Process Logic
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip:
        file.save(temp_zip.name)
        full_code = extract_code_from_zip(temp_zip.name)
        
    result = create_smart_cache(full_code, "Zip_Upload", user['uid'])
    return jsonify({"status": "success", **result})

@app.route('/github/ingest', methods=['POST'])
def ingest_github():
    # 1. Verify User
    user = verify_firebase_token(request)
    if not user: return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    gh_token = data.get('token')
    repo_name = data.get('repo_name')
    
    g = Github(gh_token)
    try:
        repo = g.get_repo(repo_name)
    except:
        return jsonify({"error": "Repo not found"}), 404
    
    # Recursive fetch (Limit to 60 files for speed)
    full_code = ""
    file_count = 0
    contents = repo.get_contents("")
    queue = []
    
    if isinstance(contents, list): queue.extend(contents)
    else: queue.append(contents)
        
    while queue and file_count < 60:
        file_content = queue.pop(0)
        if file_content.type == "dir":
            try: queue.extend(repo.get_contents(file_content.path))
            except: pass
        else:
            if file_content.path.endswith(('.php', '.js', '.ts', '.py', '.java', '.go', '.html', '.css', '.sql')):
                try:
                    full_code += f"\n--- START FILE: {file_content.path} ---\n"
                    full_code += file_content.decoded_content.decode("utf-8")
                    full_code += f"\n--- END FILE: {file_content.path} ---\n"
                    file_count += 1
                except: pass

    # 2. Log Ingestion to Firestore
    db.collection('users').document(user['uid']).collection('projects').add({
        'type': 'github',
        'repo_name': repo_name,
        'timestamp': datetime.datetime.now()
    })

    result = create_smart_cache(full_code, f"GH_{repo_name}", user['uid'])
    return jsonify({"status": "success", **result})

# --- ROUTES: AI & REFACTORING ---

@app.route('/refactor', methods=['POST'])
def refactor_stream():
    # 1. Verify User
    user = verify_firebase_token(request)
    if not user: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    cache_name = data.get('cache_name')
    query = data.get('query')

    # 2. Log Query to Firestore (Audit Trail)
    db.collection('users').document(user['uid']).collection('history').add({
        'query': query,
        'timestamp': datetime.datetime.now(),
        'cache_id': cache_name
    })

    def generate():
        time.sleep(0.5)
        # Check RAM or Cache
        if cache_name in fallback_memory:
            full_context = fallback_memory[cache_name]
            prompt = f"SYSTEM: You are a Code Expert.\nCONTEXT:\n{full_context}\n\nUSER REQUEST: {query}"
            stream = client.models.generate_content_stream(model=MODEL_ID, contents=prompt)
        else:
            stream = client.models.generate_content_stream(
                model=MODEL_ID, 
                contents=query,
                config=types.GenerateContentConfig(cached_content=cache_name)
            )

        for chunk in stream:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"

    return Response(generate(), mimetype='text/event-stream')

@app.route('/github/create_pr', methods=['POST'])
def create_pr():
    # 1. Verify User
    user = verify_firebase_token(request)
    if not user: return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    gh_token = data.get('token')
    repo_name = data.get('repo_name')
    query = data.get('query')
    cache_name = data.get('cache_name')
    
    # AI Prompt for PR Plan
    prompt = f"""
    Request: "{query}"
    Generate a JSON plan for a GitHub Pull Request.
    OUTPUT VALID JSON ONLY. NO MARKDOWN.
    Structure:
    {{
        "branch_name": "refactor/fix-issue",
        "pr_title": "Fix: Description",
        "pr_body": "Details...",
        "files": [ {{ "path": "file.ext", "content": "full code" }} ]
    }}
    """
    
    try:
        # Get AI Plan
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
        
        # Execute GitHub API
        g = Github(gh_token)
        repo = g.get_repo(repo_name)
        sb = repo.get_branch(repo.default_branch)
        branch_ref = f"{plan['branch_name']}-{int(time.time())}"
        repo.create_git_ref(ref=f"refs/heads/{branch_ref}", sha=sb.commit.sha)
        
        for f in plan['files']:
            try:
                contents = repo.get_contents(f['path'], ref=branch_ref)
                repo.update_file(contents.path, f"Fix {f['path']}", f['content'], contents.sha, branch=branch_ref)
            except:
                repo.create_file(f['path'], f"Create {f['path']}", f['content'], branch=branch_ref)
        
        pr = repo.create_pull(
            title=plan['pr_title'],
            body=plan['pr_body'],
            head=branch_ref,
            base=repo.default_branch
        )
        
        # Log Success to Firestore
        db.collection('users').document(user['uid']).collection('prs').add({
            'repo': repo_name,
            'pr_url': pr.html_url,
            'timestamp': datetime.datetime.now()
        })
        
        return jsonify({"status": "success", "pr_url": pr.html_url})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- GITHUB OAUTH (Public Routes) ---

@app.route('/login/github')
def login_github():
    return redirect(f"https://github.com/login/oauth/authorize?client_id={GH_CLIENT_ID}&scope=repo")

@app.route('/github/callback')
def github_callback():
    code = request.args.get('code')
    token_resp = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={"client_id": GH_CLIENT_ID, "client_secret": GH_CLIENT_SECRET, "code": code}
    )
    access_token = token_resp.json().get("access_token")
    FRONTEND_URL = "https://legacylift-eight.vercel.app/" 
    return redirect(f"{FRONTEND_URL}?gh_token={access_token}")
    

@app.route('/github/repos', methods=['POST'])
def list_repos():
    # Note: Fetching repos uses the GH Token, not Firebase token necessarily,
    # but we could add verify_firebase_token here if we wanted strict locking.
    token = request.json.get('token')
    if not token: return jsonify({"error": "Unauthorized"}), 401
    g = Github(token)
    try:
        repos = []
        for repo in g.get_user().get_repos(sort="pushed", direction="desc"):
            if len(repos) >= 15: break
            repos.append({"id": repo.id, "name": repo.full_name})
        return jsonify(repos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)