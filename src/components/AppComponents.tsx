import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Bot, CheckCircle, ChevronRight, FileText, Layers, Layout, Plus, Search, Settings, Terminal, Upload, CreditCard, DollarSign, BarChart3, FileCheck, ShieldAlert, Github, Zap } from 'lucide-react';

// ... (Types)
interface UsageLog {
  id: string;
  task_title: string;
  mobile_app_source: string;
  skill_name: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  created_at: string;
}

interface Invoice {
  id: string;
  app_source: string;
  period_start: string;
  period_end: string;
  total_cost: number;
  status: string;
  created_at: string;
}

// ... (Existing Components)

export function BillingDashboard() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  // Tenant Simulation State
  const [orgId, setOrgId] = useState('default-org');
  const [currentAppId, setCurrentAppId] = useState('web-dashboard');

  const headers = {
    'x-organization-id': orgId,
    'x-app-id': currentAppId
  };

  const fetchData = () => {
    fetch('/api/billing/usage', { headers }).then(res => res.json()).then(setLogs);
    fetch('/api/billing/summary', { headers }).then(res => res.json()).then(setSummary);
    fetch('/api/billing/invoices', { headers }).then(res => res.json()).then(setInvoices);
    fetch('/api/admin/apps', { headers }).then(res => res.json()).then(setApps);
  };

  useEffect(() => {
    fetchData();
  }, [orgId, currentAppId]);

  const generateInvoice = async () => {
    setGenerating(true);
    // Hardcoded period for demo
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    
    try {
      await fetch('/api/billing/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          appId: currentAppId,
          start: start.toISOString(),
          end: end.toISOString()
        })
      });
      // Refresh
      fetch('/api/billing/invoices', { headers }).then(res => res.json()).then(setInvoices);
    } catch (e) {
      alert("Failed to generate invoice (maybe no usage?)");
    } finally {
      setGenerating(false);
    }
  };

  const toggleAppStatus = async (appId: string, currentStatus: string) => {
    try {
      const app = apps.find(a => a.id === appId);
      if (!app) return;

      await fetch('/api/admin/apps/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          id: appId,
          status: currentStatus === 'active' ? 'disabled' : 'active',
          monthly_cost_limit: app.monthly_cost_limit,
          per_task_token_limit: app.per_task_token_limit
        })
      });
      fetch('/api/admin/apps', { headers }).then(res => res.json()).then(setApps);
    } catch (e) {
      alert("Failed to update status");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Billing & Usage</h1>
        
        {/* Tenant Simulator Controls */}
        <div className="flex gap-4 bg-slate-100 p-2 rounded-lg border">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 uppercase">Organization ID</label>
            <input 
              className="bg-white border rounded px-2 py-1 text-sm w-32" 
              value={orgId} 
              onChange={e => setOrgId(e.target.value)} 
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 uppercase">App ID (Context)</label>
            <input 
              className="bg-white border rounded px-2 py-1 text-sm w-32" 
              value={currentAppId} 
              onChange={e => setCurrentAppId(e.target.value)} 
            />
          </div>
          <Button size="sm" onClick={fetchData} variant="outline" className="h-auto">Refresh Context</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Cost (Org)</p>
              <h3 className="text-2xl font-bold">${summary?.total?.total_cost?.toFixed(4) || '0.0000'}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Tokens (Org)</p>
              <h3 className="text-2xl font-bold">{summary?.total?.total_tokens?.toLocaleString() || '0'}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
              <FileCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Invoices Issued</p>
              <h3 className="text-2xl font-bold">{invoices.length}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Admin / Apps Section */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-medium flex justify-between items-center">
          <span className="flex items-center gap-2"><Settings size={16} /> App Budgets & Controls (Org: {orgId})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
              <tr>
                <th className="px-4 py-3">App Name</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Monthly Usage</th>
                <th className="px-4 py-3">Monthly Limit</th>
                <th className="px-4 py-3">Per-Task Limit</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apps.map(app => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{app.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{app.id}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs border uppercase font-medium", app.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200")}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    ${app.usage.total_cost.toFixed(2)} <span className="text-slate-400">/ {app.usage.total_tokens.toLocaleString()} toks</span>
                  </td>
                  <td className="px-4 py-3">${app.monthly_cost_limit.toFixed(2)}</td>
                  <td className="px-4 py-3">{app.per_task_token_limit.toLocaleString()} toks</td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={cn("h-8 text-xs", app.status === 'active' ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50")}
                      onClick={() => toggleAppStatus(app.id, app.status)}
                    >
                      {app.status === 'active' ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-medium flex justify-between items-center">
          <span>Recent Usage Logs</span>
          <Button variant="outline" size="sm" className="h-8 text-xs">Export CSV</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">App ID</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Tokens (In/Out)</th>
                <th className="px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{new Date(log.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">{log.task_title || 'Untitled'}</td>
                  <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{log.app_id}</span></td>
                  <td className="px-4 py-3">{log.skill_name}</td>
                  <td className="px-4 py-3 text-slate-500">{log.input_tokens} / {log.output_tokens}</td>
                  <td className="px-4 py-3 text-right font-mono">${log.total_cost.toFixed(4)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No usage logs found for this organization.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices Section */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-medium flex justify-between items-center">
          <span>Invoices</span>
          <Button onClick={generateInvoice} disabled={generating} size="sm">
            {generating ? 'Generating...' : `Generate Invoice for ${currentAppId}`}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Invoice ID</th>
                <th className="px-4 py-3">App ID</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{inv.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-mono text-xs">{inv.app_source || inv.app_id}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(inv.period_start).toLocaleDateString()} - {new Date(inv.period_end).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">${inv.total_cost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs border border-green-200 uppercase font-medium">
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <FileText size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No invoices generated.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tool Audit Logs Section */}
      <ToolAuditLogs headers={headers} />
    </div>
  );
}

function ToolAuditLogs({ headers }: { headers: any }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/tool-logs', { headers }).then(res => res.json()).then(setLogs);
  }, [headers]);

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50 font-medium flex justify-between items-center">
        <span className="flex items-center gap-2"><ShieldAlert size={16} /> Tool Execution Audit (Zero-Trust)</span>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => fetch('/api/admin/tool-logs', { headers }).then(res => res.json()).then(setLogs)}>Refresh</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">Task ID</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Arguments</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium font-mono text-xs">{log.tool_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.task_id.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-xs">{log.execution_time_ms}ms</td>
                <td className="px-4 py-3">
                  <span className={cn("px-2 py-1 rounded-full text-xs border uppercase font-medium", 
                    log.status === 'success' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100")}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-xs truncate" title={log.arguments}>
                  {log.arguments}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No tool executions recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Pages ---
interface Skill {
  id: string;
  name: string;
  domain: string;
  description: string;
  version: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
}

interface Report {
  id: string;
  output: string;
  status: string;
  created_at: string;
  skill_id: string;
  execution_trace?: string; // JSON string
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// --- Pages ---

export function Marketplace() {
  const [skills, setSkills] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const search = () => {
    setLoading(true);
    fetch(`/api/marketplace/search?q=${query}`)
      .then(res => res.json())
      .then(setSkills)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    search();
  }, []);

  const handleInstall = async (id: string) => {
    if (!confirm("Install this skill to your organization?")) return;
    try {
      const res = await fetch(`/api/marketplace/install/${id}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert("Skill installed successfully!");
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layout size={24} /> Skill Marketplace
        </h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              className="pl-9 pr-4 py-2 border rounded-lg w-64" 
              placeholder="Search skills..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
          </div>
          <Button onClick={search} disabled={loading}>Search</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skills.map(skill => (
          <div key={skill.id} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{skill.name}</h3>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border">{skill.domain || 'General'}</span>
                  {skill.trust_badge && (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded border font-medium flex items-center gap-1",
                      skill.trust_badge === 'Enterprise Trusted' ? "bg-green-50 text-green-700 border-green-200" :
                      skill.trust_badge === 'Verified Stable' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      skill.trust_badge === 'Community Reliable' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                      skill.trust_badge === 'Experimental' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                      "bg-red-50 text-red-700 border-red-200"
                    )}>
                      <ShieldAlert size={10} /> {skill.trust_badge} ({skill.trust_score || 0})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-500 text-sm font-medium">
                <span className="text-slate-400 text-xs">★</span> {skill.rating || 0}
              </div>
            </div>
            
            <p className="text-slate-500 text-sm mb-6 line-clamp-3 h-10">
              {skill.description}
            </p>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-xs text-slate-400">
                v{skill.latest_version} • {skill.download_count} installs
              </div>
              <Button onClick={() => handleInstall(skill.id)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700">
                Install
              </Button>
            </div>
          </div>
        ))}
        {skills.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No skills found in the marketplace.
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Orchestrator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/tasks" className="block group">
          <div className="border rounded-xl p-6 hover:border-slate-400 transition-colors bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                <Layers size={24} />
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Tasks & Projects</h2>
            <p className="text-slate-500">Manage workflows and execute tasks using the agent system.</p>
          </div>
        </Link>

        <Link to="/skills" className="block group">
          <div className="border rounded-xl p-6 hover:border-slate-400 transition-colors bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                <Bot size={24} />
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Skill Registry</h2>
            <p className="text-slate-500">Define, version, and manage agent skills and prompts.</p>
          </div>
        </Link>

        <Link to="/knowledge" className="block group">
          <div className="border rounded-xl p-6 hover:border-slate-400 transition-colors bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
                <FileText size={24} />
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Knowledge Base</h2>
            <p className="text-slate-500">Manage documents for RAG context injection.</p>
          </div>
        </Link>

        <Link to="/billing" className="block group">
          <div className="border rounded-xl p-6 hover:border-slate-400 transition-colors bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg text-green-600">
                <CreditCard size={24} />
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Billing & Usage</h2>
            <p className="text-slate-500">Monitor token usage, cost breakdown, and invoices.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function SkillsList() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/skills')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSkills(data);
        } else {
          console.error("Failed to load skills:", data);
          setSkills([]);
        }
      })
      .catch(err => {
        console.error(err);
        setSkills([]);
      });
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const skillData = await res.json();
      // Navigate to create page with pre-filled data
      navigate('/skills/new', { state: { skillData } });
    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    } finally {
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCertify = async (id: string) => {
    try {
      const res = await fetch(`/api/skills/${id}/certify`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        // Refresh
        fetch('/api/skills').then(res => res.json()).then(setSkills);
      } else {
        alert(data.error || data.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/skills/${id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetch('/api/skills').then(res => res.json()).then(setSkills);
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm("Publish this skill to the public marketplace?")) return;
    try {
      const res = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localSkillId: id, visibility: 'public' })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Skill published successfully!");
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Skill Registry</h1>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".zip" 
            onChange={handleFileChange}
          />
          <Button onClick={handleImportClick} className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50">
            <Upload size={16} className="mr-2" /> Import Zip
          </Button>
          <Link to="/skills/import/github">
            <Button className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50">
              <Github size={16} className="mr-2" /> Import GitHub
            </Button>
          </Link>
          <Link to="/skills/new">
            <Button><Plus size={16} className="mr-2" /> New Skill</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        {skills.map(skill => (
          <div key={skill.id} className="border rounded-lg p-4 bg-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{skill.name}</h3>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border">{skill.domain}</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border">v{skill.version}</span>
                <span className={cn(
                  "text-xs px-2 py-1 rounded border uppercase font-semibold",
                  skill.status === 'active' ? "bg-green-50 text-green-700 border-green-200" :
                  skill.status === 'certified' ? "bg-blue-50 text-blue-700 border-blue-200" :
                  skill.status === 'draft' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                  "bg-slate-50 text-slate-500"
                )}>{skill.status}</span>
                {skill.source_type === 'marketplace' && (
                  <span className="text-xs bg-purple-50 text-purple-700 border-purple-200 px-2 py-1 rounded border flex items-center gap-1">
                    <Layout size={10} /> Marketplace
                  </span>
                )}
                {skill.source_type === 'github' && (
                  <span className="text-xs bg-slate-100 text-slate-700 border-slate-200 px-2 py-1 rounded border flex items-center gap-1">
                    <Github size={10} /> GitHub
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm">{skill.description}</p>
            </div>
            <div className="flex gap-2">
              {skill.status === 'draft' && (
                <Button onClick={() => handleCertify(skill.id)} className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
                  <ShieldAlert size={14} className="mr-1" /> Certify
                </Button>
              )}
              {skill.status === 'certified' && (
                <Button onClick={() => handleActivate(skill.id)} className="h-8 text-xs bg-green-600 hover:bg-green-700">
                  <CheckCircle size={14} className="mr-1" /> Activate
                </Button>
              )}
              {skill.source_type !== 'marketplace' && skill.status === 'active' && (
                <Button onClick={() => handlePublish(skill.id)} className="h-8 text-xs bg-purple-600 hover:bg-purple-700">
                  <Upload size={14} className="mr-1" /> Publish
                </Button>
              )}
            </div>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
            No skills defined yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function GitHubImport() {
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const navigate = useNavigate();

  const handleFetch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/skills/import/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, branch })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fetch failed');
      }

      const data = await res.json();
      setPreview(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!preview) return;
    // Navigate to create page with pre-filled data
    navigate('/skills/new', { 
      state: { 
        skillData: preview.skill,
        source: preview.source
      } 
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Github size={24} /> Import from GitHub
      </h1>

      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">GitHub Repository URL</label>
          <input 
            type="text" 
            className="w-full border rounded p-2" 
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Branch (Optional)</label>
          <input 
            type="text" 
            className="w-full border rounded p-2" 
            placeholder="main"
            value={branch}
            onChange={e => setBranch(e.target.value)}
          />
        </div>
        <Button onClick={handleFetch} disabled={loading || !url} className="w-full">
          {loading ? 'Fetching & Normalizing...' : 'Fetch & Preview'}
        </Button>
      </div>

      {preview && (
        <div className="mt-8 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {preview.wasNormalized ? <Zap className="text-yellow-500" size={18} /> : <CheckCircle className="text-green-500" size={18} />}
              {preview.wasNormalized ? 'Skill Normalized by AI' : 'Valid Claude Skill Detected'}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><span className="text-slate-500">Name:</span> {preview.skill.name}</div>
              <div><span className="text-slate-500">Version:</span> {preview.skill.version}</div>
              <div className="col-span-2"><span className="text-slate-500">Description:</span> {preview.skill.description}</div>
            </div>
            
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-blue-600">View Raw JSON</summary>
              <pre className="bg-slate-900 text-slate-50 p-4 rounded mt-2 text-xs overflow-auto max-h-64">
                {JSON.stringify(preview.skill, null, 2)}
              </pre>
            </details>

            <Button onClick={handleImport} className="w-full bg-green-600 hover:bg-green-700">
              Proceed to Import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateSkill() {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const initialData = location.state?.skillData || {};

  // Form State
  const [tags, setTags] = useState<string[]>(initialData.tags || []);
  const [triggers, setTriggers] = useState<string[]>(initialData.activation?.trigger_examples || []);
  const [examples, setExamples] = useState<any[]>(initialData.examples || []);
  const [previewMarkdown, setPreviewMarkdown] = useState(false);
  const [instructions, setInstructions] = useState(initialData.instructions || "");

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        e.currentTarget.value = '';
      }
    }
  };

  const addTrigger = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val && !triggers.includes(val)) {
        setTriggers([...triggers, val]);
        e.currentTarget.value = '';
      }
    }
  };

  const addExample = () => {
    setExamples([...examples, { input: "", output: {} }]);
  };

  const updateExample = (index: number, field: 'input' | 'output', value: string) => {
    const newExamples = [...examples];
    if (field === 'output') {
      try {
        newExamples[index][field] = JSON.parse(value);
      } catch (e) {
        // Allow typing invalid JSON temporarily? Or handle differently.
        // For now, we might store as string in UI state and parse on submit, 
        // but here we are storing objects. Let's store as string for editing.
      }
    } else {
      newExamples[index][field] = value;
    }
    setExamples(newExamples);
  };

  // Helper for example output text area
  const [exampleOutputs, setExampleOutputs] = useState<string[]>(
    (initialData.examples || []).map((ex: any) => JSON.stringify(ex.output, null, 2))
  );

  const handleExampleOutputChange = (index: number, value: string) => {
    const newOutputs = [...exampleOutputs];
    newOutputs[index] = value;
    setExampleOutputs(newOutputs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    // Construct Canonical JSON
    const rawSkillJson = {
      name: formData.get('name'),
      domain: formData.get('domain'),
      version: formData.get('version'),
      author: formData.get('author'),
      tags: tags,
      description: formData.get('description'),
      activation: {
        semantic_description: formData.get('semantic_description'),
        trigger_examples: triggers
      },
      system_instructions: instructions,
      tools: JSON.parse(formData.get('tools') as string || '[]'),
      output: {
        format: "json",
        schema: JSON.parse(formData.get('output_schema') as string || '{}')
      },
      examples: examples.map((ex, i) => ({
        input: ex.input, // This might need to be grabbed from form if not controlled
        output: JSON.parse(exampleOutputs[i] || '{}')
      })),
      governance: {
        allow_direct_llm_response: false,
        require_schema_validation: true,
        max_retries: 1
      }
    };

    // Update examples input from form data if needed, but we used state.
    // Actually, we need to make sure 'examples' state has the inputs.
    // The inputs are not bound to 'examples' state in the render below yet.
    // Let's bind them properly or grab from formData if we named them.
    // Easier to use state for complex dynamic lists.

    const data = {
      name: rawSkillJson.name,
      domain: rawSkillJson.domain,
      version: rawSkillJson.version,
      description: rawSkillJson.description,
      instructions: rawSkillJson.system_instructions,
      tools: rawSkillJson.tools,
      output_schema: rawSkillJson.output.schema,
      raw_skill_json: rawSkillJson
    };

    try {
      await fetch('/api/skills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      navigate('/skills');
    } catch (e) {
      alert('Failed to create skill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Define New Skill (Claude Compatible)</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Basic Metadata */}
        <section className="space-y-4 border p-4 rounded-xl bg-white">
          <h2 className="font-semibold flex items-center gap-2"><Settings size={18} /> Basic Metadata</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Skill Name</label>
              <Input name="name" placeholder="e.g. Financial Ratio Analysis" defaultValue={initialData.name} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Domain</label>
              <Input name="domain" placeholder="e.g. Finance" defaultValue={initialData.domain} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Version</label>
              <Input name="version" placeholder="1.0.0" defaultValue={initialData.version || "1.0.0"} required />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">Author (Optional)</label>
              <Input name="author" placeholder="e.g. YourApp" defaultValue={initialData.author} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (Press Enter to add)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(t => (
                <span key={t} className="bg-slate-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {t} <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}>&times;</button>
                </span>
              ))}
            </div>
            <Input placeholder="Add tag..." onKeyDown={addTag} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea name="description" placeholder="Brief summary of what this skill does." defaultValue={initialData.description} required />
          </div>
        </section>

        {/* Trigger Section */}
        <section className="space-y-4 border p-4 rounded-xl bg-white">
          <h2 className="font-semibold flex items-center gap-2"><Terminal size={18} /> Activation & Triggers</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Semantic Description (Used for Vector Search)</label>
            <Textarea name="semantic_description" placeholder="When should this skill be used?" defaultValue={initialData.activation?.semantic_description} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Trigger Examples (Press Enter to add)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {triggers.map(t => (
                <span key={t} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {t} <button type="button" onClick={() => setTriggers(triggers.filter(x => x !== t))}>&times;</button>
                </span>
              ))}
            </div>
            <Input placeholder="Add trigger example..." onKeyDown={addTrigger} />
          </div>
        </section>

        {/* System Instructions */}
        <section className="space-y-4 border p-4 rounded-xl bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><FileText size={18} /> System Instructions</h2>
            <Button type="button" onClick={() => setPreviewMarkdown(!previewMarkdown)} className="h-8 text-xs" variant="outline">
              {previewMarkdown ? 'Edit' : 'Preview'}
            </Button>
          </div>
          {previewMarkdown ? (
            <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-md min-h-[200px]">
              {/* Simple preview for now, markdown rendering would need a library */}
              <pre className="whitespace-pre-wrap font-sans">{instructions}</pre>
            </div>
          ) : (
            <Textarea 
              name="instructions" 
              className="font-mono h-64" 
              placeholder="# Identity..." 
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              required 
            />
          )}
        </section>

        {/* Tools Section */}
        <section className="space-y-4 border p-4 rounded-xl bg-white">
          <h2 className="font-semibold flex items-center gap-2"><Settings size={18} /> Tools (JSON)</h2>
          <Textarea name="tools" className="font-mono h-32" defaultValue={JSON.stringify(initialData.tools || [], null, 2)} />
        </section>

        {/* Output Schema */}
        <section className="space-y-4 border p-4 rounded-xl bg-white">
          <h2 className="font-semibold flex items-center gap-2"><CheckCircle size={18} /> Output Schema (JSON)</h2>
          <Textarea 
            name="output_schema" 
            className="font-mono h-48" 
            defaultValue={JSON.stringify(initialData.output_schema || { type: "object", properties: { result: { type: "string" } }, required: ["result"] }, null, 2)} 
            required 
          />
        </section>

        {/* Examples Section */}
        <section className="space-y-4 border p-4 rounded-xl bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Layers size={18} /> Few-Shot Examples</h2>
            <Button type="button" onClick={addExample} className="h-8 text-xs" variant="outline">
              <Plus size={14} className="mr-1" /> Add Example
            </Button>
          </div>
          <div className="space-y-4">
            {examples.map((ex, i) => (
              <div key={i} className="grid grid-cols-2 gap-4 border p-3 rounded bg-slate-50 relative">
                <button 
                  type="button" 
                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                  onClick={() => {
                    const newEx = [...examples];
                    newEx.splice(i, 1);
                    setExamples(newEx);
                    const newOut = [...exampleOutputs];
                    newOut.splice(i, 1);
                    setExampleOutputs(newOut);
                  }}
                >
                  &times;
                </button>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Input</label>
                  <Textarea 
                    value={ex.input} 
                    onChange={e => {
                      const newEx = [...examples];
                      newEx[i].input = e.target.value;
                      setExamples(newEx);
                    }}
                    className="h-24 text-xs" 
                    placeholder="User input..." 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Expected Output (JSON)</label>
                  <Textarea 
                    value={exampleOutputs[i]} 
                    onChange={e => handleExampleOutputChange(i, e.target.value)}
                    className="h-24 font-mono text-xs" 
                    placeholder="{ ... }" 
                  />
                </div>
              </div>
            ))}
            {examples.length === 0 && <p className="text-sm text-slate-500 italic">No examples added.</p>}
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/skills')}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Skill'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]); // In a real app, fetch from API
  
  // Mocking tasks for now as the list endpoint wasn't explicitly requested but needed for UI
  // I'll add a quick list endpoint or just create one to start
  
  const createTask = async () => {
    const title = prompt("Task Title");
    if (!title) return;
    const description = prompt("Task Description");
    
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'default', title, description })
    });
    const data = await res.json();
    window.location.href = `/tasks/${data.id}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Button onClick={createTask}><Plus size={16} className="mr-2" /> New Task</Button>
      </div>
      
      <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
        Create a task to start the agent workflow.
      </div>
    </div>
  );
}

export function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${id}`).then(res => res.json()).then(setTask);
    fetch(`/api/tasks/${id}/reports`).then(res => res.json()).then(setReports);
  }, [id]);

  const runAgent = async () => {
    if (!input.trim()) return;
    setRunning(true);
    try {
      await fetch(`/api/tasks/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInputs: input })
      });
      // Refresh reports
      const res = await fetch(`/api/tasks/${id}/reports`);
      const data = await res.json();
      setReports(data);
      setInput("");
    } catch (e) {
      alert("Failed to run agent");
    } finally {
      setRunning(false);
    }
  };

  if (!task) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto h-screen flex flex-col">
      <div className="mb-6">
        <div className="text-sm text-slate-500 mb-1">Task {task.id}</div>
        <h1 className="text-3xl font-bold">{task.title}</h1>
        <p className="text-slate-600 mt-2">{task.description}</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
        {/* Chat / Input Section */}
        <div className="flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 font-medium flex items-center gap-2">
            <Terminal size={18} />
            Agent Input
          </div>
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4">
              <p className="font-semibold mb-1">How this works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Your input + Task Description is embedded.</li>
                <li>System searches for the best <strong>Skill</strong> in the registry.</li>
                <li>System retrieves relevant <strong>Knowledge</strong> (RAG).</li>
                <li>Agent executes and returns structured JSON.</li>
              </ul>
            </div>
          </div>
          <div className="p-4 border-t bg-slate-50">
            <Textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Provide context or instructions for the agent..."
              className="mb-3"
            />
            <Button onClick={runAgent} disabled={running} className="w-full">
              {running ? 'Agent is thinking...' : 'Execute Task'}
            </Button>
          </div>
        </div>

        {/* Reports / Output Section */}
        <div className="flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 font-medium flex items-center gap-2">
            <CheckCircle size={18} />
            Execution Reports
          </div>
          <div className="flex-1 p-4 overflow-auto space-y-4 bg-slate-50/50">
            {reports.map(report => {
              let parsedOutput = report.output;
              try {
                parsedOutput = JSON.stringify(JSON.parse(report.output), null, 2);
              } catch (e) {}

              return (
                <div key={report.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">{new Date(report.created_at).toLocaleString()}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Success</span>
                  </div>
                  <pre className="text-xs font-mono bg-slate-900 text-slate-50 p-3 rounded overflow-x-auto">
                    {parsedOutput}
                  </pre>
                  
                  {report.execution_trace && (
                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs font-semibold mb-2 text-slate-500">Execution Trace</p>
                      <div className="space-y-1">
                        {(() => {
                          try {
                            const trace = JSON.parse(report.execution_trace);
                            return trace.map((step: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-slate-400 w-20">{new Date(step.entry_time).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}.{new Date(step.entry_time).getMilliseconds().toString().padStart(3, '0')}</span>
                                <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{step.state}</span>
                                {step.metadata && <span className="text-slate-500 truncate max-w-xs">{JSON.stringify(step.metadata)}</span>}
                              </div>
                            ));
                          } catch (e) { return null; }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {reports.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No execution reports yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeBase() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const addDoc = async () => {
    if (!content.trim()) return;
    setLoading(true);
    await fetch('/api/knowledge/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, metadata: { source: 'user-input' } })
    });
    setContent("");
    setLoading(false);
    alert("Document added to vector store.");
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Knowledge Base (LightRAG)</h1>
      <div className="border rounded-xl p-6 bg-white shadow-sm">
        <h2 className="font-semibold mb-4">Ingest Document</h2>
        <Textarea 
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Paste text content here to add to the knowledge base..."
          className="mb-4 h-40"
        />
        <Button onClick={addDoc} disabled={loading}>
          {loading ? 'Ingesting...' : 'Add to Knowledge Base'}
        </Button>
      </div>
    </div>
  );
}
