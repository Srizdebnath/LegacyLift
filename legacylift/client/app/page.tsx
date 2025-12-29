'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CodeViewer from '../components/CodeViewer'; // Ensure this component exists from previous steps
import { 
  Upload, Sparkles, Terminal, ShieldCheck, Zap, Code2, Cpu, 
  Github, FileArchive, GitPullRequest, ArrowRight, CheckCircle, Loader2 
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATE MANAGEMENT ---
  const [mode, setMode] = useState<'zip' | 'github'>('zip');
  const [ghToken, setGhToken] = useState<string | null>(null);
  
  // Repo Data
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  
  // App Logic State
  const [cacheName, setCacheName] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  
  // AI Interaction State
  const [query, setQuery] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Check for GitHub Token in URL after OAuth redirect
    const token = searchParams.get('gh_token');
    if (token) {
      setGhToken(token);
      setMode('github');
      fetchRepos(token);
      // Clean URL
      router.replace('/');
    }
  }, [searchParams, router]);

  // --- API HANDLERS ---

  const fetchRepos = async (token: string) => {
    try {
      const res = await fetch('http://localhost:5000/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      setRepos(data);
    } catch (e) {
      console.error("Failed to fetch repos", e);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsLoading(true);
    setStatus('Encrypting & Ingesting Zip...');
    
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
        setStatus('Upload Error');
      }
    } catch (err) {
      setStatus('Connection Failed');
    }
    setIsLoading(false);
  };

  const handleGithubIngest = async () => {
    if (!selectedRepo) return;
    setIsLoading(true);
    setStatus(`Cloning ${selectedRepo} & Caching Context...`);

    try {
      const res = await fetch('http://localhost:5000/github/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ghToken, repo_name: selectedRepo })
      });
      const data = await res.json();
      
      if (data.cache_name) {
        setCacheName(data.cache_name);
        setTokenCount(data.token_count);
        setStatus('Ready');
      } else {
        setStatus('Ingestion Failed');
      }
    } catch (err) {
      setStatus('API Error');
    }
    setIsLoading(false);
  };

  const handleRefactor = async () => {
    if (!cacheName || !query) return;
    setOutput('');
    setPrUrl(null); // Reset PR state
    setIsGenerating(true);
    
    try {
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
    } catch (e) {
      console.error(e);
    }
    setIsGenerating(false);
  };

  const handleCreatePR = async () => {
    if (!ghToken || !selectedRepo) return;
    setIsCreatingPR(true);
    
    try {
      const res = await fetch('http://localhost:5000/github/create_pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: ghToken, 
          repo_name: selectedRepo,
          cache_name: cacheName,
          query: query // Pass the original query so AI knows what to fix
        })
      });
      const data = await res.json();
      if (data.pr_url) {
        setPrUrl(data.pr_url);
      } else {
        alert("Failed to create PR: " + JSON.stringify(data));
      }
    } catch (e) {
      alert("Error connecting to PR Agent");
    }
    setIsCreatingPR(false);
  };

  // --- UI RENDER ---

  return (
    <main className="min-h-screen relative selection:bg-purple-500/30 font-sans text-gray-100">
      
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none bg-[#030014]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg shadow-purple-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              LegacyLift <span className="text-xs font-mono text-purple-400 align-top ml-1">ENT</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>SYSTEM ONLINE</span>
            </div>
            {ghToken && (
               <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                <Github size={12} />
                <span>GITHUB LINKED</span>
               </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto pt-28 px-6 pb-12">
        
        {/* HERO / INGEST SECTION */}
        {!cacheName && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in duration-700">
            
            <div className="space-y-6 max-w-3xl">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-2xl">
                Modernize Legacy Code <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 animate-gradient">
                  at Light Speed.
                </span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
                The first AI Architect that ingests entire repositories, identifies architectural debt, and 
                <span className="text-white font-semibold"> automatically submits Pull Requests</span> with modern fixes.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="bg-white/5 p-1.5 rounded-full flex gap-2 border border-white/10 shadow-2xl backdrop-blur-xl">
              <button 
                onClick={() => setMode('zip')}
                className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${mode === 'zip' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <FileArchive size={18} />
                Upload Zip
              </button>
              <button 
                onClick={() => {
                  if(!ghToken) window.location.href = 'http://localhost:5000/login/github';
                  else setMode('github');
                }}
                className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${mode === 'github' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Github size={18} />
                {ghToken ? 'GitHub Mode' : 'Connect GitHub'}
              </button>
            </div>

            {/* INPUT AREA */}
            <div className="w-full max-w-xl">
              {mode === 'zip' ? (
                 <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="group relative cursor-pointer w-full aspect-[3/1] rounded-2xl border border-dashed border-white/20 bg-gradient-to-b from-white/5 to-transparent hover:bg-white/10 transition-all duration-300 flex flex-col items-center justify-center overflow-hidden"
               >
                 {isLoading ? (
                   <div className="flex flex-col items-center gap-4">
                     <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                     <p className="text-blue-300 font-mono text-sm tracking-wider animate-pulse">{status}</p>
                   </div>
                 ) : (
                   <>
                     <div className="p-4 rounded-full bg-blue-500/20 group-hover:scale-110 transition-transform duration-300 mb-4">
                       <Upload className="w-8 h-8 text-blue-400" />
                     </div>
                     <p className="text-white font-medium">Click to Upload Legacy Archive</p>
                     <p className="text-xs text-gray-500 mt-2">.zip files up to 50MB</p>
                   </>
                 )}
                 <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
               </div>
              ) : (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl text-left">
                   {repos.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                        Fetching Repositories...
                      </div>
                   ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <h3 className="text-gray-300 font-medium">Select Repository</h3>
                           <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-1 rounded">
                              {repos.length} found
                           </span>
                        </div>
                        <div className="grid gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                           {repos.map(repo => (
                              <div 
                                key={repo.id}
                                onClick={() => setSelectedRepo(repo.name)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${selectedRepo === repo.name ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                              >
                                 <div className="flex items-center gap-3">
                                    <Github size={16} className="text-gray-400 group-hover:text-white" />
                                    <span className="text-sm font-mono text-gray-300">{repo.name}</span>
                                 </div>
                                 {selectedRepo === repo.name && <CheckCircle size={16} className="text-purple-400" />}
                              </div>
                           ))}
                        </div>
                        <button 
                           onClick={handleGithubIngest}
                           disabled={!selectedRepo || isLoading}
                           className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-900/40 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                           {isLoading ? <Loader2 className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                           Initialize Analysis
                        </button>
                      </div>
                   )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE (Visible after ingest) */}
        {cacheName && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* LEFT PANEL: Controls */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Context Stats */}
              <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Active Context</h3>
                  <div className={`w-2 h-2 rounded-full ${mode === 'github' ? 'bg-purple-500' : 'bg-blue-500'} shadow-[0_0_10px_currentColor]`} />
                </div>
                <div className="space-y-4">
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Source</p>
                    <div className="flex items-center gap-2 text-white font-mono text-sm truncate">
                      {mode === 'github' ? <Github size={14} /> : <FileArchive size={14} />}
                      {selectedRepo || 'Uploaded Archive'}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase mb-1">Tokens</p>
                      <span className="text-xl font-bold text-blue-400">{tokenCount.toLocaleString()}</span>
                    </div>
                    <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase mb-1">Engine</p>
                      <span className="text-xl font-bold text-purple-400">v2.5</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prompt Input */}
              <div className="glass-panel p-1 rounded-2xl bg-black/40 border-t border-white/10">
                <textarea 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`// Describe the refactoring task...
> Analyze security vulnerabilities in auth.php
> Migrate database connection to PDO
> Rewrite the dashboard using React components`}
                  className="w-full h-56 bg-transparent text-gray-200 p-5 outline-none resize-none font-mono text-sm placeholder-gray-600 focus:placeholder-gray-500 transition-colors"
                />
                
                <div className="p-2 space-y-2">
                  <button 
                    onClick={handleRefactor}
                    disabled={!query || isGenerating}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                  >
                    {isGenerating ? (
                      <>
                        <Zap className="w-4 h-4 animate-pulse fill-current" />
                        <span className="animate-pulse">Processing Stream...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        <span>Execute Transformation</span>
                      </>
                    )}
                  </button>

                  {/* PR BUTTON - ONLY IN GITHUB MODE */}
                  {mode === 'github' && output && !isGenerating && (
                     <button 
                     onClick={handleCreatePR}
                     disabled={isCreatingPR}
                     className="w-full bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-lg shadow-purple-900/30 border border-white/10"
                   >
                     {isCreatingPR ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                        <GitPullRequest className="w-4 h-4" />
                     )}
                     {isCreatingPR ? 'Pushing to Branch...' : 'Create Pull Request'}
                   </button>
                  )}
                </div>
              </div>

              {/* PR SUCCESS MESSAGE */}
              {prUrl && (
                 <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                       <h4 className="text-green-400 font-bold text-sm">Pull Request Created!</h4>
                       <a href={prUrl} target="_blank" className="text-xs text-gray-300 hover:text-white underline mt-1 flex items-center gap-1">
                          View on GitHub <ArrowRight size={10} />
                       </a>
                    </div>
                 </div>
              )}

            </div>

            {/* RIGHT PANEL: Output Console */}
            <div className="lg:col-span-8 h-[calc(100vh-10rem)] min-h-[600px]">
              <div className="glass-panel h-full rounded-2xl overflow-hidden flex flex-col border border-white/10 bg-[#050505]">
                
                {/* Console Header */}
                <div className="bg-white/5 border-b border-white/5 p-4 flex items-center justify-between backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gray-800 rounded">
                       <Terminal className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-300 font-mono">gemini_agent_output.tsx</span>
                  </div>
                  <div className="flex gap-2">
                     <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">READ-ONLY</span>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-0 bg-[#0a0a0a] relative custom-scrollbar">
                  {output ? (
                    <div className="p-6">
                       <CodeViewer content={output} />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                        <Code2 className="w-20 h-20 relative z-10 opacity-50" />
                      </div>
                      <div className="text-center space-y-2">
                         <p className="font-mono text-sm text-gray-500">Waiting for agent instructions...</p>
                         <p className="text-xs text-gray-800">System Ready</p>
                      </div>
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