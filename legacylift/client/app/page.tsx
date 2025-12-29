'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth, googleProvider } from '../lib/firebase'; // Ensure this file exists
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import CodeViewer from '../components/CodeViewer'; 
import { 
  Upload, Sparkles, Terminal, ShieldCheck, Zap, Code2, Cpu, 
  Github, FileArchive, GitPullRequest, ArrowRight, CheckCircle, 
  Loader2, LogIn, LogOut, Lock 
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- APP STATE ---
  const [mode, setMode] = useState<'zip' | 'github'>('zip');
  const [ghToken, setGhToken] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  
  const [cacheName, setCacheName] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  
  const [query, setQuery] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Listen for Firebase User
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    // 2. Check for GitHub Token (OAuth Redirect)
    const token = searchParams.get('gh_token');
    if (token) {
      setGhToken(token);
      setMode('github');
      // Clean URL
      router.replace('/');
    }
    return () => unsubscribe();
  }, [searchParams, router]);

  useEffect(() => {
    if (ghToken && user) {
      fetchRepos(ghToken);
    }
  }, [ghToken, user]);

  // --- AUTH ACTIONS ---
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login Failed", e);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCacheName(null);
    setGhToken(null);
  };

  // --- SECURE API HELPER ---
  const authenticatedFetch = async (url: string, options: any = {}) => {
    if (!user) throw new Error("User not authenticated");
    const token = await user.getIdToken();
    const headers = { 
        ...options.headers, 
        'Authorization': `Bearer ${token}` 
    };
    return fetch(url, { ...options, headers });
  };

  // --- HANDLERS ---

  const fetchRepos = async (token: string) => {
    try {
      // Repos list doesn't strictly need Firebase token, but we send it for good measure if needed
      const res = await fetch('http://localhost:5000/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      setRepos(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsLoading(true);
    setStatus('Secure Upload to Firebase Storage...');
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      // Use authenticatedFetch to send Firebase ID Token
      const res = await authenticatedFetch('http://localhost:5000/upload', { 
        method: 'POST', 
        body: formData 
      });
      
      if (res.status === 401) throw new Error("Unauthorized");
      
      const data = await res.json();
      if (data.cache_name) {
        setCacheName(data.cache_name);
        setTokenCount(data.token_count);
        setStatus('Ready');
      } else {
        setStatus('Upload Failed');
      }
    } catch (err) {
      setStatus('Upload Error / Unauthorized');
    }
    setIsLoading(false);
  };

  const handleGithubIngest = async () => {
    if (!selectedRepo) return;
    setIsLoading(true);
    setStatus(`Ingesting ${selectedRepo}...`);

    try {
      const res = await authenticatedFetch('http://localhost:5000/github/ingest', {
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
    setPrUrl(null);
    setIsGenerating(true);
    
    try {
      // Note: EventSource doesn't easily support custom headers for SSE.
      // We use standard fetch with a stream reader here, sending the token in headers.
      const token = await user?.getIdToken();
      const response = await fetch('http://localhost:5000/refactor', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
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
      const res = await authenticatedFetch('http://localhost:5000/github/create_pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: ghToken, 
          repo_name: selectedRepo,
          cache_name: cacheName,
          query: query 
        })
      });
      const data = await res.json();
      if (data.pr_url) setPrUrl(data.pr_url);
    } catch (e) {
      alert("Error creating PR");
    }
    setIsCreatingPR(false);
  };

  // --- RENDER ---

  if (authLoading) return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
            <span className="text-gray-400 font-mono text-sm">Initializing Secure Environment...</span>
        </div>
    </div>
  );

  return (
    <main className="min-h-screen relative selection:bg-purple-500/30 font-sans text-gray-100 bg-[#030014]">
      
      {/* Background FX */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg shadow-purple-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              LegacyLift <span className="text-xs font-mono text-purple-400 align-top ml-1">ENT</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
                <>
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <img src={user.photoURL || ''} alt="User" className="w-5 h-5 rounded-full ring-2 ring-purple-500/50" />
                        <span className="text-xs font-medium text-gray-300">{user.displayName}</span>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </>
            ) : (
                <button 
                    onClick={handleLogin}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-all shadow-lg shadow-white/10"
                >
                    <LogIn size={16} /> Sign In
                </button>
            )}
          </div>
        </div>
      </nav>

      {/* CONDITIONAL CONTENT */}
      {!user ? (
          // --- LANDING PAGE ---
          <div className="pt-32 px-6 flex flex-col items-center text-center min-h-screen relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <ShieldCheck size={16} /> Enterprise Grade Security Enabled
            </div>
            
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 animate-in fade-in zoom-in duration-700 delay-100">
                CODE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">EVOLUTION</span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                The AI Architect that modernizes legacy repositories. 
                Secured by <span className="text-white font-semibold">Firebase</span>. 
                Powered by <span className="text-white font-semibold">Gemini 2.5</span>.
            </p>
            
            <button 
                onClick={handleLogin}
                className="group relative px-10 py-5 bg-white text-black font-bold rounded-full text-lg hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300"
            >
                <span className="relative z-10 flex items-center gap-2">
                    Start Modernizing <ArrowRight size={20} />
                </span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity" />
            </button>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                {[
                    { title: "Context Caching", icon: <Zap className="text-yellow-400"/>, desc: "Ingest 1M+ tokens. No timeouts." },
                    { title: "Auto-PR Agent", icon: <GitPullRequest className="text-purple-400"/>, desc: "Direct GitHub integration." },
                    { title: "Firebase Secure", icon: <Lock className="text-green-400"/>, desc: "End-to-end encrypted auth." }
                ].map((f, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group text-left">
                        <div className="mb-4 p-3 bg-black/40 w-fit rounded-xl border border-white/5 group-hover:scale-110 transition-transform">
                            {f.icon}
                        </div>
                        <h3 className="text-lg font-bold mb-2 text-gray-200">{f.title}</h3>
                        <p className="text-sm text-gray-400">{f.desc}</p>
                    </div>
                ))}
            </div>
          </div>
      ) : (
          // --- AUTHENTICATED WORKSPACE ---
          <div className="max-w-7xl mx-auto pt-28 px-6 pb-12">
            
            {/* INGEST SECTION */}
            {!cacheName && (
              <div className="flex flex-col items-center space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-white">Select Data Source</h2>
                    <p className="text-gray-400">Choose how you want to ingest the legacy codebase.</p>
                </div>

                <div className="bg-white/5 p-1.5 rounded-full flex gap-2 border border-white/10 backdrop-blur-xl">
                  <button 
                    onClick={() => setMode('zip')}
                    className={`px-8 py-3 rounded-full text-sm font-semibold transition-all ${mode === 'zip' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-2"><FileArchive size={18} /> Zip Upload</div>
                  </button>
                  <button 
                    onClick={() => {
                        if(!ghToken) window.location.href = 'http://localhost:5000/login/github';
                        else setMode('github');
                    }}
                    className={`px-8 py-3 rounded-full text-sm font-semibold transition-all ${mode === 'github' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-2"><Github size={18} /> GitHub Repo</div>
                  </button>
                </div>

                <div className="w-full max-w-xl mt-8">
                  {mode === 'zip' ? (
                     <div 
                     onClick={() => fileInputRef.current?.click()}
                     className="group relative cursor-pointer w-full aspect-[2.5/1] rounded-2xl border border-dashed border-white/20 bg-gradient-to-b from-white/5 to-transparent hover:bg-white/10 transition-all flex flex-col items-center justify-center overflow-hidden"
                   >
                     {isLoading ? (
                       <div className="flex flex-col items-center gap-4">
                         <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                         <p className="text-blue-300 font-mono text-xs tracking-widest uppercase animate-pulse">{status}</p>
                       </div>
                     ) : (
                       <>
                         <div className="p-4 rounded-full bg-blue-500/10 group-hover:scale-110 transition-transform mb-4">
                           <Upload className="w-8 h-8 text-blue-400" />
                         </div>
                         <p className="text-gray-300 font-medium">Drop Legacy Zip File</p>
                       </>
                     )}
                     <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
                   </div>
                  ) : (
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl">
                       <div className="flex justify-between items-center mb-4">
                           <h3 className="text-gray-300 font-medium">Your Repositories</h3>
                           <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">{repos.length} found</span>
                       </div>
                       {repos.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                             <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                             Fetching...
                          </div>
                       ) : (
                          <div className="space-y-3">
                             <div className="grid gap-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                                {repos.map(repo => (
                                   <div 
                                     key={repo.id}
                                     onClick={() => setSelectedRepo(repo.name)}
                                     className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${selectedRepo === repo.name ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                   >
                                      <Github size={16} className="text-gray-400" />
                                      <span className="text-sm font-mono text-gray-300">{repo.name}</span>
                                      {selectedRepo === repo.name && <CheckCircle size={14} className="ml-auto text-purple-400" />}
                                   </div>
                                ))}
                             </div>
                             <button 
                                onClick={handleGithubIngest}
                                disabled={!selectedRepo || isLoading}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                             >
                                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Zap size={16} />}
                                Ingest Repository
                             </button>
                          </div>
                       )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WORKSPACE */}
            {cacheName && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* CONTROLS */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest">Active Session</h3>
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                    </div>
                    <div className="space-y-4">
                      <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Source Context</p>
                        <div className="flex items-center gap-2 text-white font-mono text-sm truncate">
                          {mode === 'github' ? <Github size={14} /> : <FileArchive size={14} />}
                          {selectedRepo || 'Uploaded_Archive.zip'}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5">
                           <p className="text-[10px] text-gray-500 uppercase mb-1">Tokens</p>
                           <span className="text-xl font-bold text-blue-400">{tokenCount.toLocaleString()}</span>
                        </div>
                        <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5">
                           <p className="text-[10px] text-gray-500 uppercase mb-1">Model</p>
                           <span className="text-xl font-bold text-purple-400">Flash 2.5</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-1 rounded-2xl bg-black/40 border-t border-white/10">
                    <textarea 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="// Enter instructions for the Architect..."
                      className="w-full h-48 bg-transparent text-gray-200 p-5 outline-none resize-none font-mono text-sm placeholder-gray-600 focus:placeholder-gray-500"
                    />
                    <div className="p-2 space-y-2">
                      <button 
                        onClick={handleRefactor}
                        disabled={!query || isGenerating}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGenerating ? <Zap className="w-4 h-4 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
                        {isGenerating ? 'Analyzing...' : 'Execute Refactor'}
                      </button>

                      {mode === 'github' && output && !isGenerating && (
                         <button 
                         onClick={handleCreatePR}
                         disabled={isCreatingPR}
                         className="w-full bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {isCreatingPR ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                         {isCreatingPR ? 'Committing...' : 'Raise Pull Request'}
                       </button>
                      )}
                    </div>
                  </div>
                  
                  {prUrl && (
                     <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                        <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                        <div>
                           <h4 className="text-green-400 font-bold text-sm">Success</h4>
                           <a href={prUrl} target="_blank" className="text-xs text-gray-400 hover:text-white underline mt-1 flex items-center gap-1">
                              View PR on GitHub <ArrowRight size={10} />
                           </a>
                        </div>
                     </div>
                  )}
                </div>

                {/* OUTPUT */}
                <div className="lg:col-span-8 h-[calc(100vh-10rem)] min-h-[600px]">
                  <div className="glass-panel h-full rounded-2xl overflow-hidden flex flex-col border border-white/10 bg-[#050505]">
                    <div className="bg-white/5 border-b border-white/5 p-4 flex items-center gap-3 backdrop-blur-md">
                        <Terminal className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400 font-mono">architect_output.tsx</span>
                    </div>
                    <div className="flex-1 overflow-auto bg-[#0a0a0a] relative custom-scrollbar">
                      {output ? (
                        <div className="p-6"><CodeViewer content={output} /></div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                          <Code2 className="w-16 h-16 text-gray-600 mb-4" />
                          <p className="text-gray-500 font-mono text-sm">Ready for instructions</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
      )}
    </main>
  );
}