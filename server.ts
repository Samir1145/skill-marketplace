import express from "express";
import { createServer as createViteServer } from "vite";
import { db, SkillRegistry, LightRAG, Orchestrator, SkillCertifier, SkillNormalizer, MarketplaceRegistry } from "./src/backend";
import { SkillImporter, GitHubImporter } from "./src/importer";
import { tenantMiddleware } from "./src/middleware";
import bodyParser from 'body-parser';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(bodyParser.json());
  app.use(tenantMiddleware); // Apply tenant context to all routes

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Skills API
  app.post("/api/skills/create", async (req, res) => {
    try {
      // Create skill for the current organization (private) or global if admin decides?
      // For now, default to organization-scoped skills.
      const { organizationId } = req.context!;
      const id = await SkillRegistry.create(req.body, organizationId);
      res.json({ id, status: "created" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/skills/import", upload.single('file'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const parsedSkill = SkillImporter.parseZip(req.file.buffer);
      res.json(parsedSkill);
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/skills/import/github", async (req, res) => {
    try {
      const { url, branch } = req.body;
      if (!url) return res.status(400).json({ error: "GitHub URL required" });

      // 1. Fetch Repo
      const buffer = await GitHubImporter.fetchRepo(url, branch || 'main');
      
      // 2. Parse Zip
      const parsed = SkillImporter.parseZip(buffer);
      
      // 3. Check if valid Claude Skill
      const isValid = parsed.name && parsed.instructions && parsed.output_schema;
      
      let finalSkill = parsed;
      let wasNormalized = false;

      if (!isValid) {
        // 4. Auto-Convert / Normalize
        console.log("Skill schema mismatch. Triggering normalization...");
        const normalized = await SkillNormalizer.normalize(parsed.raw_files || {}, url);
        finalSkill = { ...parsed, ...normalized };
        wasNormalized = true;
      }

      // Return for preview
      res.json({ 
        skill: finalSkill, 
        wasNormalized,
        source: { type: 'github', url }
      });

    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/skills/search", async (req, res) => {
    try {
      const { q, domain } = req.query;
      const { organizationId } = req.context!;
      if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });
      
      const results = await SkillRegistry.search(String(q), organizationId, domain ? String(domain) : undefined);
      
      // Remove embedding from response to save bandwidth
      const cleanResults = results.map((r: any) => {
        const { embedding, ...rest } = r;
        return rest;
      });
      res.json(cleanResults);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/skills", (req, res) => {
    try {
        const { organizationId } = req.context!;
        // Show Global + My Org Skills
        const skills = db.prepare('SELECT id, name, domain, description, version, status, source_type, organization_id FROM skills WHERE organization_id IS NULL OR organization_id = ?').all(organizationId);
        res.json(skills);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  // Skill Certification API
  app.post("/api/skills/:id/certify", async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req.context!;
      
      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
      if (!skill) return res.status(404).json({ error: "Skill not found" });
      
      // Allow if global (null org) and user is admin? Or just check ownership if private.
      if (skill.organization_id && skill.organization_id !== organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // 1. Validate Structure
      try {
        SkillCertifier.validateStructure(skill);
      } catch (e: any) {
        return res.status(400).json({ error: `Structure validation failed: ${e.message}` });
      }

      // 2. Validate Dependencies
      try {
        SkillCertifier.validateDependencies(id);
      } catch (e: any) {
        return res.status(400).json({ error: `Dependency validation failed: ${e.message}` });
      }

      // 3. Run Tests
      const success = await SkillCertifier.runCertificationTests(id);
      
      if (success) {
        res.json({ status: "certified", message: "Skill passed all certification tests." });
      } else {
        res.status(400).json({ error: "Skill failed certification tests. Check logs." });
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/skills/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      const { organizationId } = req.context!;
      
      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
      if (!skill) return res.status(404).json({ error: "Skill not found" });
      
      if (skill.organization_id && skill.organization_id !== organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (skill.status !== 'certified') {
        return res.status(400).json({ error: "Skill must be certified before activation." });
      }

      // Deactivate other versions of this skill_id (if any active)
      db.prepare("UPDATE skills SET status = 'deprecated', is_latest = 0 WHERE skill_id = ? AND status = 'active'").run(skill.skill_id);
      
      // Activate this one
      db.prepare("UPDATE skills SET status = 'active', is_latest = 1 WHERE id = ?").run(id);

      res.json({ status: "active", message: "Skill activated successfully." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Marketplace API
  app.get("/api/marketplace/search", (req, res) => {
    try {
      const { q, domain } = req.query;
      const results = MarketplaceRegistry.search(String(q || ''), domain ? String(domain) : undefined);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/marketplace/skills/:id", (req, res) => {
    try {
      const result = MarketplaceRegistry.getDetail(req.params.id);
      if (!result) return res.status(404).json({ error: "Skill not found" });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/marketplace/publish", (req, res) => {
    try {
      const { localSkillId, visibility } = req.body;
      const { organizationId } = req.context!;
      const id = MarketplaceRegistry.publish(organizationId, localSkillId, visibility);
      res.json({ id, status: "published" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/marketplace/install/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { version } = req.body;
      const { organizationId } = req.context!;
      const localId = MarketplaceRegistry.install(organizationId, id, version);
      res.json({ localId, status: "installed" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Projects API
  app.post("/api/projects", (req, res) => {
    try {
      const { name, description } = req.body;
      const id = Orchestrator.createProject(name, description);
      res.json({ id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects", (req, res) => {
    try {
      const projects = db.prepare('SELECT * FROM projects').all();
      res.json(projects);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Tasks API
  app.post("/api/tasks", (req, res) => {
    try {
      const { projectId, title, description } = req.body;
      const { organizationId, appId } = req.context!;
      
      const id = Orchestrator.createTask(projectId, title, description, organizationId, appId);
      res.json({ id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:id", (req, res) => {
    try {
      const task = Orchestrator.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      
      // Security Check
      const { organizationId } = req.context!;
      // If task has org_id, it must match. If legacy/null, allow? Strict: block.
      if (task.organization_id && task.organization_id !== organizationId) {
         return res.status(403).json({ error: "Access denied to this task" });
      }

      res.json(task);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/run", async (req, res) => {
    try {
      const { userInputs } = req.body;
      // Orchestrator.executeTask will re-fetch task and use its org_id/app_id for billing
      // But we should verify access first
      const task = Orchestrator.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      
      const { organizationId } = req.context!;
      if (task.organization_id && task.organization_id !== organizationId) {
         return res.status(403).json({ error: "Access denied to this task" });
      }

      const result = await Orchestrator.executeTask(req.params.id, userInputs || "");
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tasks/:id/reports", (req, res) => {
    try {
      const reports = Orchestrator.getTaskReports(req.params.id);
      res.json(reports);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Billing API (Tenant Scoped)
  app.get("/api/billing/usage", (req, res) => {
    try {
      const { start, end } = req.query;
      const { organizationId, appId } = req.context!;
      
      let sql = `
        SELECT 
          u.*, 
          t.title as task_title, 
          t.skill_name,
          t.agent_name
        FROM usage_logs u
        JOIN tasks t ON u.task_id = t.id
        WHERE u.organization_id = ?
      `;
      const params: any[] = [organizationId];

      // Optional: Filter by specific app if requested, otherwise show all apps for org?
      // Usually billing dashboard shows all apps for the org.
      // But if we want to filter:
      if (req.query.app_id) {
        sql += ` AND u.app_id = ?`;
        params.push(req.query.app_id);
      }

      if (start) {
        sql += ` AND u.created_at >= ?`;
        params.push(start);
      }
      if (end) {
        sql += ` AND u.created_at <= ?`;
        params.push(end);
      }

      sql += ` ORDER BY u.created_at DESC`;

      const logs = db.prepare(sql).all(...params);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/billing/summary", (req, res) => {
    try {
      const { organizationId } = req.context!;

      // Aggregate stats for Org
      const totalStats = db.prepare(`
        SELECT 
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost
        FROM usage_logs
        WHERE organization_id = ?
      `).get(organizationId) as any;

      const byApp = db.prepare(`
        SELECT 
          a.name as app_name,
          u.app_id,
          SUM(u.total_cost) as cost
        FROM usage_logs u
        JOIN apps a ON u.app_id = a.id
        WHERE u.organization_id = ?
        GROUP BY u.app_id
      `).all(organizationId);

      const bySkill = db.prepare(`
        SELECT 
          t.skill_name,
          SUM(u.total_cost) as cost
        FROM usage_logs u
        JOIN tasks t ON u.task_id = t.id
        WHERE u.organization_id = ?
        GROUP BY t.skill_name
      `).all(organizationId);

      res.json({
        total: totalStats,
        byApp,
        bySkill
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/billing/invoices/generate", (req, res) => {
    try {
      const { appId, start, end } = req.body; // Generate for specific app or whole org?
      const { organizationId } = req.context!;
      
      // If appId provided, generate for app. Else for org?
      // Let's support per-app invoicing as requested.
      
      if (!appId) return res.status(400).json({ error: "App ID required" });

      // Verify app belongs to org
      const app = db.prepare('SELECT * FROM apps WHERE id = ? AND organization_id = ?').get(appId, organizationId);
      if (!app) return res.status(403).json({ error: "App not found or access denied" });

      // Calculate totals
      const stats = db.prepare(`
        SELECT 
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost
        FROM usage_logs
        WHERE app_id = ? AND organization_id = ?
        AND created_at >= ? AND created_at <= ?
      `).get(appId, organizationId, start, end) as any;

      if (!stats.total_tokens) {
        return res.status(400).json({ error: "No usage found for this period" });
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO invoices (id, organization_id, app_id, period_start, period_end, total_tokens, total_cost, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, organizationId, appId, start, end, stats.total_tokens, stats.total_cost, 'issued');

      res.json({ id, status: 'issued', amount: stats.total_cost });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/billing/invoices", (req, res) => {
    try {
      const { organizationId } = req.context!;
      const invoices = db.prepare('SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId);
      res.json(invoices);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin / Organization API
  app.get("/api/admin/organizations", (req, res) => {
    // In real app, only super-admin can see all.
    // For demo, we'll just return the current one or all if "super-admin" role.
    try {
        const orgs = db.prepare('SELECT * FROM organizations').all();
        res.json(orgs);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/apps", (req, res) => {
    try {
      const { organizationId } = req.context!;
      const apps = db.prepare('SELECT * FROM apps WHERE organization_id = ?').all(organizationId);
      
      // Merge with usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = db.prepare('SELECT * FROM app_usage_summary WHERE month = ?').all(currentMonth) as any[];
      
      const result = apps.map((a: any) => {
        const u = usage.find(u => u.app_id === a.id) || { total_tokens: 0, total_cost: 0 };
        return { ...a, usage: u };
      });
      
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/apps/update", (req, res) => {
    try {
      const { id, monthly_cost_limit, per_task_token_limit, status } = req.body;
      const { organizationId } = req.context!;
      
      // Verify ownership
      const app = db.prepare('SELECT * FROM apps WHERE id = ? AND organization_id = ?').get(id, organizationId);
      if (!app) return res.status(403).json({ error: "Access denied" });

      db.prepare(`
        UPDATE apps 
        SET monthly_cost_limit = ?, per_task_token_limit = ?, status = ?
        WHERE id = ?
      `).run(monthly_cost_limit, per_task_token_limit, status, id);
      res.json({ status: 'ok' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Tool Registry API (Admin)
  app.get("/api/admin/tools", (req, res) => {
    try {
      const tools = db.prepare('SELECT * FROM tools_registry').all();
      res.json(tools);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/tools", (req, res) => {
    try {
      const { name, description, allowed_domains, max_cpu_time, max_memory_mb, allow_network, allow_filesystem, implementation } = req.body;
      
      // Upsert
      const existing = db.prepare('SELECT * FROM tools_registry WHERE name = ?').get(name);
      if (existing) {
        db.prepare(`
          UPDATE tools_registry 
          SET description = ?, allowed_domains = ?, max_cpu_time = ?, max_memory_mb = ?, allow_network = ?, allow_filesystem = ?, implementation = ?
          WHERE name = ?
        `).run(description, JSON.stringify(allowed_domains), max_cpu_time, max_memory_mb, allow_network ? 1 : 0, allow_filesystem ? 1 : 0, implementation, name);
      } else {
        db.prepare(`
          INSERT INTO tools_registry (name, description, allowed_domains, max_cpu_time, max_memory_mb, allow_network, allow_filesystem, implementation)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(name, description, JSON.stringify(allowed_domains), max_cpu_time, max_memory_mb, allow_network ? 1 : 0, allow_filesystem ? 1 : 0, implementation);
      }
      res.json({ status: 'ok' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Tool Logs API (Audit)
  app.get("/api/admin/tool-logs", (req, res) => {
    try {
      const { organizationId } = req.context!;
      const logs = db.prepare('SELECT * FROM tool_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100').all(organizationId);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Knowledge API (LightRAG)
  app.post("/api/knowledge/add", async (req, res) => {
    try {
      const { content, metadata } = req.body;
      const id = await LightRAG.addDocument(content, metadata);
      res.json({ id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
