import { Router } from "express";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();
const dbReady = (async () => {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
      photo TEXT, job_title TEXT NOT NULL DEFAULT '', salary NUMERIC NOT NULL DEFAULT 0,
      additions JSONB NOT NULL DEFAULT '[]', deductions JSONB NOT NULL DEFAULT '[]',
      attendance JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      month TEXT NOT NULL, base_salary NUMERIC NOT NULL, additions NUMERIC NOT NULL DEFAULT 0,
      deductions NUMERIC NOT NULL DEFAULT 0, net_salary NUMERIC NOT NULL, details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(employee_id, month)
    )`);
  } finally { client.release(); }
})().catch(e => console.error("Employee DB init error:", e));

const asNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const id = () => `emp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

router.get("/employees", async (_req, res) => {
  try { await dbReady; const { rows } = await pool.query("SELECT * FROM employees ORDER BY created_at DESC"); res.json(rows); }
  catch { res.status(500).json({ error: "تعذر تحميل الموظفين" }); }
});

router.post("/employees", async (req, res) => {
  try {
    await dbReady;
    const { name, phone = "", photo = null, jobTitle = "", salary = 0, additions = [], deductions = [], attendance = [] } = req.body ?? {};
    if (!String(name ?? "").trim()) { res.status(400).json({ error: "اسم الموظف مطلوب" }); return; }
    const employeeId = id();
    const { rows: [employee] } = await pool.query(
      `INSERT INTO employees (id,name,phone,photo,job_title,salary,additions,deductions,attendance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [employeeId, String(name).trim(), phone, photo, jobTitle, asNumber(salary), JSON.stringify(additions), JSON.stringify(deductions), JSON.stringify(attendance)]
    );
    res.status(201).json(employee); return;
  } catch (e) { console.error(e); res.status(500).json({ error: "تعذر حفظ الموظف" }); }
});

router.put("/employees/:id", async (req, res) => {
  try {
    await dbReady;
    const { name, phone = "", photo = null, jobTitle = "", salary = 0, additions = [], deductions = [], attendance = [] } = req.body ?? {};
    const { rows: [employee] } = await pool.query(
      `UPDATE employees SET name=$1,phone=$2,photo=$3,job_title=$4,salary=$5,additions=$6,deductions=$7,attendance=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [String(name ?? "").trim(), phone, photo, jobTitle, asNumber(salary), JSON.stringify(additions), JSON.stringify(deductions), JSON.stringify(attendance), req.params.id]
    );
    if (!employee) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
    res.json(employee); return;
  } catch { res.status(500).json({ error: "تعذر تحديث الموظف" }); }
});

router.delete("/employees/:id", async (req, res) => {
  try { await dbReady; await pool.query("DELETE FROM employees WHERE id=$1", [req.params.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "تعذر حذف الموظف" }); }
});

router.post("/employees/:id/payroll", async (req, res) => {
  try {
    await dbReady;
    const { rows: [employee] } = await pool.query("SELECT * FROM employees WHERE id=$1", [req.params.id]);
    if (!employee) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
    const month = String(req.body?.month || new Date().toISOString().slice(0, 7));
    const additions = (Array.isArray(employee.additions) ? employee.additions : []).reduce((s: number, x: any) => s + asNumber(x.amount), 0);
    const deductions = (Array.isArray(employee.deductions) ? employee.deductions : []).reduce((s: number, x: any) => s + asNumber(x.amount), 0);
    const baseSalary = asNumber(employee.salary);
    const netSalary = Math.max(0, baseSalary + additions - deductions);
    const details = { employeeName: employee.name, phone: employee.phone, jobTitle: employee.job_title, attendance: employee.attendance, additions: employee.additions, deductions: employee.deductions };
    const { rows: [run] } = await pool.query(
      `INSERT INTO payroll_runs (id,employee_id,month,base_salary,additions,deductions,net_salary,details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (employee_id,month) DO UPDATE SET
       base_salary=$4,additions=$5,deductions=$6,net_salary=$7,details=$8,created_at=NOW() RETURNING *`,
      [id(), employee.id, month, baseSalary, additions, deductions, netSalary, JSON.stringify(details)]
    );
    res.json({ ...run, employee }); return;
  } catch (e) { console.error(e); res.status(500).json({ error: "تعذر حساب الراتب" }); }
});

router.get("/employees/:id/payroll", async (req, res) => {
  try { await dbReady; const { rows } = await pool.query("SELECT * FROM payroll_runs WHERE employee_id=$1 ORDER BY month DESC", [req.params.id]); res.json(rows); }
  catch { res.status(500).json({ error: "تعذر تحميل كشوف الرواتب" }); }
});

export default router;