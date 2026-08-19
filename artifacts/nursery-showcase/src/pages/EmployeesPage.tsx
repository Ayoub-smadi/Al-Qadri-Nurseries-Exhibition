import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Download, ImagePlus, Minus, Pencil, Plus, Trash2, UserPlus, Users, WalletCards } from "lucide-react";
import { navigate } from "@/App";
import { loadSavedToken } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Entry = { label: string; amount: number };
type Attendance = { date: string; status: "حاضر" | "إجازة" | "غياب" };
type Employee = {
  id: string; name: string; phone: string; photo?: string; job_title: string; salary: string | number;
  additions: Entry[]; deductions: Entry[]; attendance: Attendance[];
};
type Draft = Omit<Employee, "id" | "salary"> & { salary: string };
const emptyDraft: Draft = { name: "", phone: "", photo: "", job_title: "", salary: "", additions: [], deductions: [], attendance: [] };
const api = (path: string) => `/api${path}`;
const money = (v: number | string) => `${Number(v || 0).toLocaleString("ar-JO")} د.أ`;

function normalize(e: any): Employee {
  return { ...e, additions: Array.isArray(e.additions) ? e.additions : [], deductions: Array.isArray(e.deductions) ? e.deductions : [], attendance: Array.isArray(e.attendance) ? e.attendance : [] };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const token = loadSavedToken();
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const load = async () => {
    setLoading(true);
    try { const r = await fetch(api("/employees"), { headers }); if (!r.ok) throw new Error(); setEmployees((await r.json()).map(normalize)); }
    catch { toast.error("تعذر تحميل بيانات الموظفين"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const total = useMemo(() => employees.reduce((s, e) => s + Number(e.salary || 0), 0), [employees]);
  const openNew = () => { setEditing(null); setDraft(emptyDraft); setSelected(null); };
  const edit = (e: Employee) => { setEditing(e.id); setDraft({ name: e.name, phone: e.phone, photo: e.photo || "", job_title: e.job_title, salary: String(e.salary || ""), additions: e.additions, deductions: e.deductions, attendance: e.attendance }); setSelected(null); };
  const save = async () => {
    if (!draft.name.trim()) { toast.error("اكتب اسم الموظف"); return; }
    setSaving(true);
    try {
      const r = await fetch(api(editing ? `/employees/${editing}` : "/employees"), { method: editing ? "PUT" : "POST", headers, body: JSON.stringify({ ...draft, salary: Number(draft.salary) || 0, jobTitle: draft.job_title }) });
      if (!r.ok) throw new Error();
      toast.success(editing ? "تم تحديث الموظف" : "تمت إضافة الموظف"); openNew(); await load();
    } catch { toast.error("تعذر حفظ البيانات"); } finally { setSaving(false); }
  };
  const remove = async (e: Employee) => {
    if (!confirm(`حذف الموظف ${e.name}؟`)) return;
    await fetch(api(`/employees/${e.id}`), { method: "DELETE", headers }); setSelected(null); await load(); toast.success("تم حذف الموظف");
  };
  const addEntry = (key: "additions" | "deductions") => setDraft(d => ({ ...d, [key]: [...d[key], { label: "", amount: 0 }] }));
  const addAttendance = () => setDraft(d => ({ ...d, attendance: [...d.attendance, { date: new Date().toISOString().slice(0, 10), status: "حاضر" }] }));
  const choosePhoto = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => setDraft(d => ({ ...d, photo: String(reader.result) })); reader.readAsDataURL(file); };
  const payroll = async (e: Employee) => {
    try { const r = await fetch(api(`/employees/${e.id}/payroll`), { method: "POST", headers, body: JSON.stringify({ month }) }); if (!r.ok) throw new Error(); const run = await r.json(); printPayroll(run, month); toast.success("تم حساب كشف الراتب"); }
    catch { toast.error("تعذر حساب الراتب"); }
  };

  return <main dir="rtl" className="min-h-screen bg-background text-foreground p-4 sm:p-8 font-sans">
    <div className="max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3"><Button variant="outline" size="icon" onClick={() => navigate("/")}><ArrowRight /></Button><div><p className="text-sm text-primary font-bold">لوحة التحكم</p><h1 className="text-3xl font-black">إدارة الموظفين</h1><p className="text-muted-foreground mt-1">الموظفون، الحضور، الإضافات والخصومات والرواتب</p></div></div>
        <Button onClick={openNew} className="gap-2"><UserPlus className="w-4 h-4" /> إضافة موظف</Button>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat icon={<Users />} label="إجمالي الموظفين" value={String(employees.length)} />
        <Stat icon={<WalletCards />} label="مجموع الرواتب الأساسية" value={money(total)} />
        <Stat icon={<CalendarDays />} label="كشوف هذا الشهر" value={month} />
      </div>
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="space-y-3">
          {loading ? <div className="text-center py-16 text-muted-foreground">جارٍ تحميل البيانات...</div> : employees.length === 0 ? <div className="rounded-2xl border border-dashed p-14 text-center"><Users className="mx-auto mb-3 text-muted-foreground" /><h2 className="font-bold">لا يوجد موظفون بعد</h2><p className="text-sm text-muted-foreground mt-1">أضف أول موظف للبدء بإدارة الرواتب.</p></div> : employees.map(e => <EmployeeCard key={e.id} e={e} onEdit={() => edit(e)} onDelete={() => remove(e)} onSelect={() => setSelected(e)} onPayroll={() => payroll(e)} />)}
        </div>
        <aside className="rounded-2xl border bg-card p-5 sticky top-5">
          <h2 className="font-bold text-lg mb-4">{editing ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</h2>
          <div className="flex items-center gap-3 mb-4">
            <label className="w-16 h-16 rounded-2xl bg-muted overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-border">{draft.photo ? <img src={draft.photo} className="w-full h-full object-cover" /> : <ImagePlus className="text-muted-foreground" />}<input type="file" accept="image/*" className="hidden" onChange={e => choosePhoto(e.target.files?.[0])} /></label>
            <span className="text-xs text-muted-foreground">صورة الموظف<br />اختياري</span>
          </div>
          <div className="space-y-3">
            <Field label="الاسم الكامل"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="مثال: أحمد محمد" /></Field>
            <Field label="رقم الهاتف"><Input dir="ltr" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="07XXXXXXXX" /></Field>
            <Field label="المسمى الوظيفي"><Input value={draft.job_title} onChange={e => setDraft({ ...draft, job_title: e.target.value })} placeholder="مثال: مشرف مشتَل" /></Field>
            <Field label="الراتب الأساسي (د.أ)"><Input type="number" min="0" value={draft.salary} onChange={e => setDraft({ ...draft, salary: e.target.value })} /></Field>
            <EntryEditor title="الإضافات" icon={<Plus />} entries={draft.additions} onAdd={() => addEntry("additions")} onChange={v => setDraft({ ...draft, additions: v })} />
            <EntryEditor title="الخصومات" icon={<Minus />} entries={draft.deductions} onAdd={() => addEntry("deductions")} onChange={v => setDraft({ ...draft, deductions: v })} />
            <div><div className="flex justify-between items-center mb-2"><label className="text-sm font-bold">الحضور والإجازات</label><button className="text-xs text-primary font-bold" onClick={addAttendance}>+ تسجيل يوم</button></div>{draft.attendance.map((a, i) => <div className="flex gap-2 mb-2" key={i}><Input type="date" value={a.date} onChange={e => setDraft({ ...draft, attendance: draft.attendance.map((x,j) => j===i ? {...x,date:e.target.value}:x) })} /><select className="border rounded-md bg-background px-2 text-sm" value={a.status} onChange={e => setDraft({ ...draft, attendance: draft.attendance.map((x,j) => j===i ? {...x,status:e.target.value as Attendance["status"]}:x) })}><option>حاضر</option><option>إجازة</option><option>غياب</option></select></div>)}</div>
          </div>
          <div className="flex gap-2 mt-5"><Button className="flex-1" disabled={saving} onClick={save}>{saving ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "حفظ الموظف"}</Button>{editing && <Button variant="outline" onClick={openNew}>إلغاء</Button>}</div>
        </aside>
      </section>
      {selected && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}><div className="bg-card rounded-2xl w-full max-w-lg p-6 shadow-xl" onClick={e => e.stopPropagation()}><div className="flex justify-between items-start mb-5"><div className="flex gap-3 items-center">{selected.photo ? <img src={selected.photo} className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center"><Users /></div>}<div><h2 className="font-black text-xl">{selected.name}</h2><p className="text-sm text-muted-foreground">{selected.job_title || "بدون مسمى وظيفي"} · {selected.phone || "لا يوجد هاتف"}</p></div></div><Button variant="ghost" onClick={() => setSelected(null)}>إغلاق</Button></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="p-3 rounded-xl bg-muted"><span className="text-muted-foreground">الراتب الأساسي</span><strong className="block mt-1">{money(Number(selected.salary))}</strong></div><div className="p-3 rounded-xl bg-muted"><span className="text-muted-foreground">الحضور المسجل</span><strong className="block mt-1">{selected.attendance.length} يوم</strong></div></div><div className="flex gap-2 mt-5"><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /><Button className="gap-2" onClick={() => payroll(selected)}><Download className="w-4 h-4" /> إصدار كشف PDF</Button></div></div></div>}
    </div>
  </main>;
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border bg-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><strong className="text-lg">{value}</strong></div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="text-xs font-bold block mb-1">{label}</span>{children}</label>; }
function EntryEditor({ title, icon, entries, onAdd, onChange }: { title: string; icon: ReactNode; entries: Entry[]; onAdd: () => void; onChange: (v: Entry[]) => void }) { return <div><div className="flex justify-between items-center mb-2"><label className="text-sm font-bold flex gap-1 items-center">{icon}{title}</label><button className="text-xs text-primary font-bold" onClick={onAdd}>+ إضافة</button></div>{entries.map((x, i) => <div className="flex gap-2 mb-2" key={i}><Input placeholder="البيان" value={x.label} onChange={e => onChange(entries.map((a,j) => j===i ? {...a,label:e.target.value}:a))} /><Input className="w-28" type="number" placeholder="المبلغ" value={x.amount} onChange={e => onChange(entries.map((a,j) => j===i ? {...a,amount:Number(e.target.value)}:a))} /></div>)}</div>; }
function EmployeeCard({ e, onEdit, onDelete, onSelect, onPayroll }: { e: Employee; onEdit: () => void; onDelete: () => void; onSelect: () => void; onPayroll: () => void }) { const adds = e.additions.reduce((s,x)=>s+Number(x.amount||0),0); const deductions = e.deductions.reduce((s,x)=>s+Number(x.amount||0),0); return <div className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-4 hover:border-primary/50 transition-colors"><button className="flex items-center gap-3 text-right flex-1 min-w-[220px]" onClick={onSelect}>{e.photo ? <img src={e.photo} className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Users /></div>}<span><strong className="block">{e.name}</strong><small className="text-muted-foreground">{e.job_title || "بدون مسمى"} · {e.phone || "لا يوجد هاتف"}</small></span></button><div className="text-sm text-center"><span className="text-muted-foreground block">الأساسي</span><b>{money(Number(e.salary))}</b></div><div className="text-xs text-center"><span className="text-emerald-600 block">إضافات +{adds}</span><span className="text-red-500">خصومات -{deductions}</span></div><div className="flex gap-1"><Button variant="outline" size="icon" title="تعديل" onClick={onEdit}><Pencil className="w-4 h-4" /></Button><Button variant="outline" size="icon" title="كشف PDF" onClick={onPayroll}><Download className="w-4 h-4" /></Button><Button variant="outline" size="icon" className="text-destructive" onClick={onDelete}><Trash2 className="w-4 h-4" /></Button></div></div>; }
function printPayroll(run: any, month: string) { const d = run.employee || {}; const html = `<html dir="rtl"><head><meta charset="utf-8"><title>كشف راتب - ${d.name || ""}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#172b24}h1{text-align:center;color:#1b5e20}table{width:100%;border-collapse:collapse;margin-top:25px}td,th{border:1px solid #ccc;padding:12px;text-align:right}th{background:#eaf4ea}.total{font-size:22px;font-weight:bold;color:#1b5e20}</style></head><body><h1>كشف راتب موظف</h1><p><b>الموظف:</b> ${d.name || ""}</p><p><b>الهاتف:</b> ${d.phone || ""} &nbsp; <b>الشهر:</b> ${month}</p><table><tr><th>البيان</th><th>المبلغ</th></tr><tr><td>الراتب الأساسي</td><td>${money(run.base_salary)}</td></tr><tr><td>الإضافات</td><td>${money(run.additions)}</td></tr><tr><td>الخصومات</td><td>-${money(run.deductions)}</td></tr><tr><td class="total">صافي الراتب</td><td class="total">${money(run.net_salary)}</td></tr></table><p style="margin-top:60px">توقيع الموظف: ____________________ &nbsp;&nbsp;&nbsp; توقيع الإدارة: ____________________</p><script>window.onload=()=>window.print()</script></body></html>`; const w=window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); } }