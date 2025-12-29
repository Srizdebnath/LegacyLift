'use client';
import { useState, useRef } from 'react';
import CodeViewer from '../components/CodeViewer';
import { Upload, Sparkles, Terminal, ShieldCheck, Zap, Code2, Cpu } from 'lucide-react';

export default function Home() {
  const [cacheName, setCacheName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [query, setQuery] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsLoading(true);
    setStatus('Ingesting Codebase...');
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const res = await fetch('http://localhost:5000/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.cache_name) {
        setCacheName(data.cache_name);
        setTokenCount(data.token_count);
        setStatus('Ready');
      } else {
        setStatus('Error: ' + JSON.stringify(data));
      }
    } catch (err) {
      setStatus('Connection Failed');
    }
    setIsLoading(false);
  };

  const handleRefactor = async () => {
    if (!cacheName || !query) return;
    setOutput('');
    setIsGenerating(true);
    
    const response = await fetch('http://localhost:5000/refactor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cache_name: cacheName, query: query }),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          setOutput((prev) => prev + line.replace('data: ', ''));
        }
      }
    }
    setIsGenerating(false);
  };

  return (
    <main className="min-h-screen relative selection:bg-blue-500/30">
      
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b-0 border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              LegacyLift
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <span>v1.0 Enterprise</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto pt-24 px-6 pb-12">
        
        {/* Hero Section */}
        {!cacheName && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white glow-text">
                Resurrect <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  Legacy Code.
                </span>
              </h1>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                Ingest entire repositories using Gemini 2.5 Flash context caching. 
                Refactor, document, and modernize instantly.
              </p>
            </div>

            {/* Upload Area */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer w-full max-w-xl aspect-[3/1] rounded-2xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-300 flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {isLoading ? (
                <div className="flex flex-col items-center gap-4 z-10">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-blue-400 font-mono text-sm tracking-wider animate-pulse">{status}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 z-10">
                  <div className="p-4 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-8 h-8 text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Drop Legacy Zip File</p>
                    <p className="text-xs text-gray-500 mt-1">Supports PHP, Java, COBOL, Python</p>
                  </div>
                </div>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".zip"
                onChange={handleUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Workspace (Visible after upload) */}
        {cacheName && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Sidebar / Controls */}
            <div className="lg:col-span-4 space-y-6">
              {/* Status Card */}
              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Repository Context</h3>
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Session ID</p>
                    <p className="font-mono text-xs text-white truncate opacity-70">{cacheName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tokens Loaded</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-blue-400">{tokenCount.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">tokens</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prompt Area */}
              <div className="glass-panel p-1 rounded-2xl bg-black/40">
                <textarea 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="// Enter refactoring instructions...
Example: Analyze login.php vulnerabilities and rewrite in Go."
                  className="w-full h-48 bg-transparent text-white p-5 outline-none resize-none font-mono text-sm placeholder-gray-600 focus:placeholder-gray-500 transition-colors"
                />
                <button 
                  onClick={handleRefactor}
                  disabled={!query || isGenerating}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Zap className="w-4 h-4 animate-pulse" />
                      <span>Refactoring...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                      <span>Execute Transformation</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output Console */}
            <div className="lg:col-span-8 h-[calc(100vh-12rem)] min-h-[600px]">
              <div className="glass-panel h-full rounded-2xl overflow-hidden flex flex-col border border-white/10">
                {/* Console Header */}
                <div className="bg-black/40 border-b border-white/5 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300 font-mono">genai_output.tsx</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                  </div>
                </div>

                {/* Code Content */}
                <div className="flex-1 overflow-auto p-6 bg-[#0a0a0a]/50">
                  {output ? (
                    <CodeViewer content={output} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4 opacity-50">
                      <Code2 className="w-16 h-16" />
                      <p className="font-mono text-sm">Waiting for input stream...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}