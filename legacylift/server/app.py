import os
import glob
import zipfile
import tempfile
import time
from flask import Flask, request, Response, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
MODEL_ID = "gemini-2.5-flash" 

fallback_memory = {}

def extract_code_from_zip(zip_path):
    code_content = ""
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_ref.extractall(temp_dir)
            for filepath in glob.glob(f'{temp_dir}/**/*', recursive=True):
                if os.path.isfile(filepath):
                    if filepath.endswith(('.java', '.php', '.cob', '.py', '.js', '.ts', '.html', '.css', '.sql')):
                        try:
                            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                                rel_path = os.path.relpath(filepath, temp_dir)
                                code_content += f"\n--- START FILE: {rel_path} ---\n"
                                code_content += f.read()
                                code_content += f"\n--- END FILE: {rel_path} ---\n"
                        except Exception:
                            pass
    return code_content

@app.route('/upload', methods=['POST'])
def upload_repo():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip:
        file.save(temp_zip.name)
        full_code_text = extract_code_from_zip(temp_zip.name)
    
    est_tokens = len(full_code_text) // 4

    if est_tokens < 30000:
        print(f"File too small for Google Cache ({est_tokens} tokens). Using RAM.")
        import uuid
        fake_id = str(uuid.uuid4())
        fallback_memory[fake_id] = full_code_text
        return jsonify({
            "status": "success", 
            "cache_name": fake_id, 
            "token_count": est_tokens,
            "mode": "fallback (RAM)" 
        })

    try:
        cache = client.caches.create(
            model=MODEL_ID,
            config=types.CreateCachedContentConfig(
                display_name="LegacyLift_Cache",
                system_instruction="You are an expert Software Architect...",
                contents=[full_code_text],
                ttl="3600s"
            )
        )
        return jsonify({
            "status": "success", 
            "cache_name": cache.name, 
            "token_count": cache.usage_metadata.total_token_count,
            "mode": "google_cache"
        })
    except Exception as e:
        import uuid
        fake_id = str(uuid.uuid4())
        fallback_memory[fake_id] = full_code_text
        return jsonify({"status": "success", "cache_name": fake_id, "mode": "fallback_error"})

@app.route('/refactor', methods=['POST'])
def refactor_stream():
    data = request.json
    cache_name = data.get('cache_name')
    query = data.get('query')

    def generate():
        time.sleep(1) 
        
        if cache_name in fallback_memory:
            full_context = fallback_memory[cache_name]
            prompt = f"SYSTEM: You are a code refactoring expert.\nCONTEXT:\n{full_context}\n\nUSER REQUEST: {query}"
            
            response_stream = client.models.generate_content_stream(
                model=MODEL_ID,
                contents=prompt
            )
        else:
            response_stream = client.models.generate_content_stream(
                model=MODEL_ID,
                contents=query,
                config=types.GenerateContentConfig(cached_content=cache_name)
            )

        for chunk in response_stream:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(port=5000, debug=True)