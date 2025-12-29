'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import CodeViewer from '../components/CodeViewer'; 
import { 
  Upload, Sparkles, Terminal, ShieldCheck, Zap, Code2, Cpu, 
  Github, FileArchive, GitPullRequest, ArrowRight, CheckCircle, 
  Loader2, LogIn, LogOut, Lock, Database, Network 
} from 'lucide-react';

// --- PRODUCTION CONFIG ---
const API_BASE = 'https://legacylift-backend.onrender.com';

// --- MAIN LOGIC COMPONENT (Not Exported Default) ---
function HomeContent() {
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
    setRepos([]);
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
      const res = await fetch(`${API_BASE}/github/repos`, {
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
    setStatus('Encrypting & Uploading to Firebase Storage...');
    
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const res = await authenticatedFetch(`${API_BASE}/upload`, { 
        method: 'POST', 
        body: formData 
      });
      
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
    setStatus(`Cloning ${selectedRepo} & Caching Context...`);

    try {
      const res = await authenticatedFetch(`${API_BASE}/github/ingest`, {
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
      const token = await user?.getIdToken();
      const response = await fetch(`${API_BASE}/refactor`, {
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
      const res = await authenticatedFetch(`${API_BASE}/github/create_pr`, {
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

  // --- LOADING STATE ---
  if (authLoading) return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
            <span className="text-gray-400 font-mono text-sm tracking-widest uppercase">Initializing LegacyLift...</span>
        </div>
    </div>
  );

  return (
    <main className="min-h-screen relative selection:bg-purple-500/30 font-sans text-gray-100 bg-[#030014] overflow-x-hidden">
      
      {/* --- DEEP SPACE BACKGROUND FX --- */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl shadow-lg shadow-purple-500/20 border border-white/10">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">
                LegacyLift
              </span>
              <span className="text-[10px] font-mono text-purple-400 tracking-wider">ENTERPRISE EDITION</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
                <>
                    <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <img src={user.photoURL || ''} alt="User" className="w-6 h-6 rounded-full ring-2 ring-purple-500/50" />
                        <span className="text-xs font-medium text-gray-300">{user.displayName}</span>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2.5 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors text-gray-400 border border-transparent hover:border-red-500/20"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </>
            ) : (
                <button 
                    onClick={handleLogin}
                    className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-all shadow-lg shadow-white/5"
                >
                    <LogIn size={16} /> <span className="hidden sm:inline">Sign In</span>
                </button>
            )}
          </div>
        </div>
      </nav>

      {/* --- CONDITIONAL CONTENT --- */}
      {!user ? (
          // ==========================
          // LANDING PAGE (Unauthenticated)
          // ==========================
          <div className="pt-32 px-6 flex flex-col items-center relative z-10 pb-20">
            
            {/* HERO SECTION */}
            <div className="text-center max-w-4xl mx-auto mb-32">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                  <ShieldCheck size={14} /> Secured by Firebase & Google Cloud
              </div>
              
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 animate-in fade-in zoom-in duration-700 delay-100 leading-tight">
                  LEGACY <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">LIFT</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                  The AI Architect that ingests entire repositories, detects technical debt, and 
                  <span className="text-white font-semibold"> automatically submits Pull Requests</span> with modern fixes.
              </p>
              
              <button 
                  onClick={handleLogin}
                  className="group relative px-10 py-5 bg-white text-black font-bold rounded-full text-lg hover:scale-105 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 overflow-hidden"
              >
                  <span className="relative z-10 flex items-center gap-2">
                      Initialize Modernization <ArrowRight size={20} />
                  </span>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity" />
              </button>
            </div>

            {/* FEATURE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mb-32 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                {[
                    { title: "Context Caching", icon: <Database className="text-blue-400"/>, desc: "Ingest 1M+ tokens. No memory limits." },
                    { title: "Auto-PR Agent", icon: <GitPullRequest className="text-purple-400"/>, desc: "Direct GitHub integration & committing." },
                    { title: "Secure Pipeline", icon: <Lock className="text-emerald-400"/>, desc: "End-to-end encrypted Firebase Auth." }
                ].map((f, i) => (
                    <div key={i} className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group backdrop-blur-sm">
                        <div className="mb-6 p-4 bg-black/40 w-fit rounded-2xl border border-white/5 group-hover:scale-110 transition-transform shadow-lg">
                            {f.icon}
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white">{f.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>

            {/* --- ARCHITECTURE SECTION --- */}
            <div className="w-full max-w-6xl mb-32 animate-in fade-in slide-in-from-bottom-16 duration-1000">
               <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-5xl font-bold mb-6">Architecture of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Trust</span></h2>
                  <p className="text-gray-400">Transparent AI processing pipeline powered by Google Cloud.</p>
               </div>
               
               <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Connector Line */}
                  <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent -z-10" />
                  
                  {[
                     { step: "01", title: "Ingestion", desc: "Secure upload via Firebase Storage or GitHub clone.", icon: <Upload size={20}/> },
                     { step: "02", title: "Tokenization", desc: "Loaded into Gemini 2.5 Flash Context Cache.", icon: <Cpu size={20}/> },
                     { step: "03", title: "Reasoning", desc: "Deep architectural analysis of legacy dependencies.", icon: <Network size={20}/> },
                     { step: "04", title: "Execution", desc: "Streaming generation & Pull Request automation.", icon: <Zap size={20}/> }
                  ].map((s, i) => (
                     <div key={i} className="bg-black/40 border border-white/10 p-8 rounded-3xl flex flex-col items-center text-center hover:border-blue-500/30 transition-colors backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-blue-500/50 text-blue-400 flex items-center justify-center font-bold mb-6 shadow-[0_0_15px_rgba(59,130,246,0.2)] z-10">
                           {s.icon}
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
                     </div>
                  ))}
               </div>
            </div>

            {/* --- TEAM SECTION --- */}
            <div className="w-full border-t border-white/5 pt-24 pb-12">
               <div className="text-center mb-16">
                  <span className="text-xs font-mono text-purple-400 tracking-[0.3em] uppercase mb-4 block animate-pulse">Engineered By</span>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                    TEAM KHASTA KOCHURI
                  </h2>
               </div>
               
               <div className="flex flex-wrap justify-center gap-12 md:gap-20 max-w-5xl mx-auto mb-20">
                  {[
                    { 
                      name: "Sriz Debnath", 
                      role: "AI System and Automation Engineer", 
                      img: "/team/sriz.jpeg" 
                    },
                    { 
                      name: "Shilajit Khan", 
                      role: "Backend Engineer", 
                      img: "/team/shilajit.jpeg" 
                    },
                    { 
                      name: "Subhajit Patra", 
                      role: "Frontend Engineer", 
                      img: "/team/subhojit.jpeg" 
                    }
                  ].map((member, i) => (
                     <div key={i} className="flex flex-col items-center group relative">
                        {/* Image Container */}
                        <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-br from-white/10 to-transparent border border-white/10 group-hover:border-purple-500/50 group-hover:scale-105 transition-all duration-500 mb-6 relative z-10 overflow-hidden shadow-2xl">
                           <div className="w-full h-full rounded-full overflow-hidden bg-black/50 relative">
                              <img 
                                src={member.img} 
                                alt={member.name}
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${member.name}&background=random`;
                                }}
                              />
                           </div>
                        </div>
                        <div className="text-center relative z-10">
                            <h4 className="font-bold text-white text-xl tracking-tight mb-1 group-hover:text-purple-300 transition-colors">
                              {member.name}
                            </h4>
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 inline-block">
                              <p className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
                                {member.role}
                              </p>
                            </div>
                        </div>
                     </div>
                  ))}
               </div>
               
               <div className="text-center border-t border-white/5 pt-8">
                 <p className="text-gray-600 text-xs font-mono flex items-center justify-center gap-2">
                    <span>© 2025 LegacyLift.</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                    <span>Powered by Google Gemini & Firebase.</span>
                 </p>
               </div>
            </div>

          </div>
      ) : (
          // ==========================
          // AUTHENTICATED WORKSPACE
          // ==========================
          <div className="max-w-7xl mx-auto pt-28 px-6 pb-12">
            
            {/* --- MODE SELECTION --- */}
            {!cacheName && (
              <div className="flex flex-col items-center space-y-10 animate-in fade-in duration-500 py-10">
                <div className="text-center space-y-3">
                    <h2 className="text-4xl font-bold text-white">Choose Ingestion Source</h2>
                    <p className="text-gray-400">Select how you want to modernize the legacy codebase.</p>
                </div>

                <div className="bg-black/40 p-1.5 rounded-full flex gap-2 border border-white/10 backdrop-blur-xl shadow-2xl">
                  <button 
                    onClick={() => setMode('zip')}
                    className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${mode === 'zip' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2"><FileArchive size={18} /> Zip Archive</div>
                  </button>
                  <button 
                    onClick={() => {
                        if(!ghToken) window.location.href = `${API_BASE}/login/github`;
                        else setMode('github');
                    }}
                    className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${mode === 'github' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2"><Github size={18} /> GitHub Repo</div>
                  </button>
                </div>

                <div className="w-full max-w-2xl mt-8">
                  {mode === 'zip' ? (
                     <div 
                     onClick={() => fileInputRef.current?.click()}
                     className="group relative cursor-pointer w-full aspect-[2.5/1] rounded-3xl border border-dashed border-white/10 bg-gradient-to-b from-white/5 to-transparent hover:bg-white/10 hover:border-blue-500/30 transition-all flex flex-col items-center justify-center overflow-hidden"
                   >
                     {isLoading ? (
                       <div className="flex flex-col items-center gap-4">
                         <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                         <p className="text-blue-300 font-mono text-xs tracking-widest uppercase animate-pulse">{status}</p>
                       </div>
                     ) : (
                       <>
                         <div className="p-5 rounded-full bg-blue-500/10 group-hover:scale-110 transition-transform mb-6 border border-blue-500/20">
                           <Upload className="w-10 h-10 text-blue-400" />
                         </div>
                         <h3 className="text-xl font-bold text-white mb-2">Upload Legacy Archive</h3>
                         <p className="text-sm text-gray-500">Supports .zip files up to 50MB</p>
                       </>
                     )}
                     <input ref={fileInputRef} type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
                   </div>
                  ) : (
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
                       <div className="flex justify-between items-center mb-6">
                           <h3 className="text-white font-bold text-lg flex items-center gap-2">
                             <Github size={20} /> Repository List
                           </h3>
                           <span className="text-xs text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 font-mono">
                             {repos.length} REPOS
                           </span>
                       </div>
                       
                       {repos.length === 0 ? (
                          <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
                             <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 opacity-50" />
                             <p>Fetching repositories from GitHub...</p>
                          </div>
                       ) : (
                          <div className="space-y-4">
                             <div className="grid gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {repos.map(repo => (
                                   <div 
                                     key={repo.id}
                                     onClick={() => setSelectedRepo(repo.name)}
                                     className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-3 group ${selectedRepo === repo.name ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                   >
                                      <div className={`p-2 rounded-lg ${selectedRepo === repo.name ? 'bg-purple-500 text-white' : 'bg-black text-gray-400'}`}>
                                        <Github size={16} />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className={`text-sm font-bold ${selectedRepo === repo.name ? 'text-white' : 'text-gray-300'}`}>{repo.name}</span>
                                        <span className="text-[10px] text-gray-500">Last updated recently</span>
                                      </div>
                                      {selectedRepo === repo.name && <CheckCircle size={18} className="ml-auto text-purple-400" />}
                                   </div>
                                ))}
                             </div>
                             <button 
                                onClick={handleGithubIngest}
                                disabled={!selectedRepo || isLoading}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-purple-900/40 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                             >
                                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <Zap size={20} />}
                                Ingest & Analyze
                             </button>
                          </div>
                       )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- WORKSPACE VIEW --- */}
            {cacheName && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                
                {/* LEFT PANEL */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Status Card */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Session Active
                      </h3>
                      <ShieldCheck size={16} className="text-green-500" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                        <p className="text-[10px] text-gray-500 uppercase mb-2">Ingestion Source</p>
                        <div className="flex items-center gap-3 text-white font-mono text-sm truncate">
                          <div className={`p-1.5 rounded ${mode === 'github' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {mode === 'github' ? <Github size={14} /> : <FileArchive size={14} />}
                          </div>
                          {selectedRepo || 'Uploaded_Archive.zip'}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                           <p className="text-[10px] text-gray-500 uppercase mb-1">Tokens</p>
                           <span className="text-xl font-bold text-blue-400">{tokenCount.toLocaleString()}</span>
                        </div>
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                           <p className="text-[10px] text-gray-500 uppercase mb-1">Model</p>
                           <span className="text-xl font-bold text-purple-400">Flash 2.5</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interaction Panel */}
                  <div className="glass-panel p-2 rounded-3xl bg-black/40 border border-white/10">
                    <textarea 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`// Describe the task...
> "Find SQL Injections in login.php"
> "Refactor database.java to use Connection Pooling"`}
                      className="w-full h-56 bg-transparent text-gray-200 p-6 outline-none resize-none font-mono text-sm placeholder-gray-600 focus:placeholder-gray-500 transition-colors rounded-2xl"
                    />
                    
                    <div className="p-2 space-y-3">
                      <button 
                        onClick={handleRefactor}
                        disabled={!query || isGenerating}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-blue-900/20 group"
                      >
                        {isGenerating ? <Zap className="w-5 h-5 animate-pulse text-yellow-300" /> : <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                        {isGenerating ? 'Architecting Solution...' : 'Execute Transformation'}
                      </button>

                      {mode === 'github' && output && !isGenerating && (
                         <button 
                         onClick={handleCreatePR}
                         disabled={isCreatingPR}
                         className="w-full bg-gradient-to-r from-purple-900/50 to-pink-900/50 hover:from-purple-800/50 hover:to-pink-800/50 border border-purple-500/30 text-purple-300 font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                       >
                         {isCreatingPR ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitPullRequest className="w-5 h-5" />}
                         {isCreatingPR ? 'Pushing to Branch...' : 'Raise Pull Request'}
                       </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Success Alert */}
                  {prUrl && (
                     <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-4 shadow-lg">
                        <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                           <CheckCircle size={20} />
                        </div>
                        <div>
                           <h4 className="text-white font-bold text-sm">Action Successful</h4>
                           <p className="text-gray-400 text-xs mt-1">Pull Request has been created on GitHub.</p>
                           <a href={prUrl} target="_blank" className="text-xs text-emerald-400 hover:text-white underline mt-3 flex items-center gap-1 font-bold">
                              OPEN PR <ArrowRight size={12} />
                           </a>
                        </div>
                     </div>
                  )}
                </div>

                {/* RIGHT PANEL: CONSOLE */}
                <div className="lg:col-span-8 h-[calc(100vh-10rem)] min-h-[600px]">
                  <div className="h-full rounded-3xl overflow-hidden flex flex-col border border-white/10 bg-[#050505] shadow-2xl relative">
                    
                    {/* Console Header */}
                    <div className="bg-white/5 border-b border-white/5 p-4 flex items-center justify-between backdrop-blur-md z-10">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                            </div>
                            <span className="text-sm text-gray-400 font-mono ml-2">legacy_lift_agent_output.tsx</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 rounded bg-black/50 border border-white/5">
                            <Terminal size={12} className="text-gray-500" />
                            <span className="text-[10px] text-gray-500 font-mono">READ-ONLY</span>
                        </div>
                    </div>

                    {/* Output Area */}
                    <div className="flex-1 overflow-auto bg-[#0a0a0a] relative custom-scrollbar p-0">
                      {output ? (
                        <div className="p-8">
                           <CodeViewer content={output} />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 select-none pointer-events-none">
                          <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                            <Code2 className="w-24 h-24 text-gray-500 relative z-10" />
                          </div>
                          <p className="text-gray-500 font-mono text-sm mt-6 tracking-widest uppercase">Awaiting Instructions</p>
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

// --- MAIN WRAPPER (To fix Build Error) ---
export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#030014] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        }>
            <HomeContent />
        </Suspense>
    );
}