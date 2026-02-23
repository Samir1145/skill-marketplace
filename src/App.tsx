import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard, SkillsList, CreateSkill, GitHubImport, TaskList, TaskDetail, KnowledgeBase, BillingDashboard, Marketplace } from './components/AppComponents';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <nav className="border-b bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            Orchestrator
          </div>
          <div className="flex gap-4 text-sm font-medium text-slate-600">
            <a href="/" className="hover:text-slate-900">Dashboard</a>
            <a href="/tasks" className="hover:text-slate-900">Tasks</a>
            <a href="/skills" className="hover:text-slate-900">Skills</a>
            <a href="/marketplace" className="hover:text-slate-900">Marketplace</a>
            <a href="/billing" className="hover:text-slate-900">Billing</a>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/skills" element={<SkillsList />} />
          <Route path="/skills/new" element={<CreateSkill />} />
          <Route path="/skills/import/github" element={<GitHubImport />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/billing" element={<BillingDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
