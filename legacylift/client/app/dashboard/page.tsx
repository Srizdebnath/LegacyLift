'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  LayoutDashboard, GitPullRequest, Terminal, Clock, 
  ArrowLeft, ExternalLink, Loader2, Cpu, Activity 
} from 'lucide-react';

// CONFIG
const API_BASE = 'https://legacylift-backend.onrender.com';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }

      // Fetch Dashboard Data
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE}/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030014] text-white font-sans selection:bg-purple-500/30">
        
        {/* Background FX */}
        <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-[500px] bg-purple-900/10 blur-[120px]" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        </div>

        {/* Navbar */}
        <nav className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
                    <div className="p-1.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                        <Cpu className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold tracking-tight">LegacyLift</span>
                </div>
                <button 
                    onClick={() => router.push('/')} 
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Workspace
                </button>
            </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <LayoutDashboard className="text-purple-400" />
                <h1 className="text-3xl font-bold">Mission Control</h1>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
                            <Terminal size={24} />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-mono uppercase">Total Refactors</p>
                            <h3 className="text-2xl font-bold">{data?.stats?.total_refactors || 0}</h3>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
                            <GitPullRequest size={24} />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-mono uppercase">PRs Created</p>
                            <h3 className="text-2xl font-bold">{data?.stats?.total_prs || 0}</h3>
                        </div>
                    </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-green-500/20 text-green-400">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-mono uppercase">System Status</p>
                            <h3 className="text-xl font-bold text-green-400">Operational</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
                    <h2 className="text-xl font-bold">Recent Activity</h2>
                </div>
                
                <div className="divide-y divide-white/5">
                    {data?.activity_feed?.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No activity recorded yet. Start refactoring!
                        </div>
                    ) : (
                        data?.activity_feed?.map((item: any, i: number) => (
                            <div key={i} className="p-6 hover:bg-white/5 transition-colors group">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className={`mt-1 p-2 rounded-lg ${item.type === 'pr' ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                            {item.type === 'pr' ? <GitPullRequest size={18} /> : <Terminal size={18} />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white flex items-center gap-2">
                                                {item.title}
                                                {item.type === 'pr' && (
                                                    <a href={item.link} target="_blank" className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1 hover:bg-purple-500/30">
                                                        View <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </h4>
                                            <p className="text-sm text-gray-400 mt-1 font-mono">{item.desc}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                        <Clock size={12} />
                                        {new Date(item.timestamp).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    </div>
  );
}