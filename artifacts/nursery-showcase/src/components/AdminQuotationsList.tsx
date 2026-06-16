import React, { useState, useEffect, useCallback } from 'react';
import { loadSavedToken } from '@/lib/storage';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { QuotationForm, AdminQuotationRow } from '@/components/QuotationForm';
import {
  Search, Trash2, RotateCcw, Edit2, Plus, Download,
  Loader2, FileText, AlertTriangle, X, ChevronRight,
} from 'lucide-react';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = loadSavedToken();
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'خطأ في الطلب');
  }
  return res.json();
}

async function fetchQuotations(trash = false): Promise<AdminQuotationRow[]> {
  const data = await apiFetch(`/api/admin-quotations${trash ? '?trash=true' : ''}`);
  return data.quotations ?? [];
}
async function deleteQuotation(id: string) { return apiFetch(`/api/admin-quotations/${id}`, { method: 'DELETE' }); }
async function permanentDeleteQuotation(id: string) { return apiFetch(`/api/admin-quotations/${id}?permanent=true`, { method: 'DELETE' }); }
async function restoreQuotation(id: string) { return apiFetch(`/api/admin-quotations/${id}/restore`, { method: 'POST' }); }

const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AdminQuotationsListProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'active' | 'trash';

export function AdminQuotationsList({ open, onClose }: AdminQuotationsListProps) {
  const [tab, setTab] = useState<Tab>('active');
  const [quotations, setQuotations] = useState<AdminQuotationRow[]>([]);
  const [trashQuotations, setTrashQuotations] = useState<AdminQuotationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editQuotation, setEditQuotation] = useState<AdminQuotationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [active, trash] = await Promise.all([fetchQuotations(false), fetchQuotations(true)]);
      setQuotations(active);
      setTrashQuotations(trash);
    } catch { toast.error('فشل تحميل العروض'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleDelete = async (q: AdminQuotationRow) => {
    if (!confirm(`نقل عرض سعر #${q.quotation_number} للمحذوفات؟`)) return;
    try {
      await deleteQuotation(q.id);
      toast.success('تم النقل للمحذوفات');
      load();
    } catch { toast.error('فشل الحذف'); }
  };

  const handleRestore = async (q: AdminQuotationRow) => {
    try {
      await restoreQuotation(q.id);
      toast.success('تمت الاستعادة');
      load();
    } catch { toast.error('فشل الاستعادة'); }
  };

  const handlePermanentDelete = async (q: AdminQuotationRow) => {
    if (!confirm(`حذف عرض سعر #${q.quotation_number} نهائياً؟ لا يمكن التراجع!`)) return;
    try {
      await permanentDeleteQuotation(q.id);
      toast.success('تم الحذف النهائي');
      load();
    } catch { toast.error('فشل الحذف النهائي'); }
  };

  const handleEmptyTrash = async () => {
    if (trashQuotations.length === 0) return;
    if (!confirm(`حذف جميع العروض في المحذوفات نهائياً (${trashQuotations.length})؟ لا يمكن التراجع!`)) return;
    try {
      await Promise.all(trashQuotations.map(q => permanentDeleteQuotation(q.id)));
      toast.success('تم تفريغ سلة المحذوفات');
      load();
    } catch { toast.error('فشل تفريغ السلة'); }
  };

  const handleBackup = async () => {
    try {
      const [active, trash] = await Promise.all([fetchQuotations(false), fetchQuotations(true)]);
      const payload = { version: 1, date: new Date().toISOString(), quotations: active, trash };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alqadri-admin-quotations-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('تم تنزيل النسخة الاحتياطية');
    } catch { toast.error('فشل الباك أب'); }
  };

  const displayed = tab === 'active' ? quotations : trashQuotations;
  const filtered = displayed.filter(q =>
    !search || q.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    q.quotation_number.includes(search)
  );

  if (editQuotation) {
    return (
      <Dialog open onOpenChange={() => setEditQuotation(null)}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto p-4" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditQuotation(null); load(); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ChevronRight className="w-3 h-3" />
                سجل العروض
              </button>
              <span className="text-muted-foreground text-xs">/</span>
              <DialogTitle className="text-right text-sm arabic">
                تعديل عرض #{editQuotation.quotation_number}
              </DialogTitle>
            </div>
          </DialogHeader>
          <QuotationForm
            onClose={() => { setEditQuotation(null); load(); }}
            editQuotation={editQuotation}
            onSaved={() => { load(); }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 gap-0" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b shrink-0">
          <div>
            <h2 className="text-base font-bold arabic text-foreground">سجل عروض الأسعار</h2>
            <p className="text-xs text-muted-foreground arabic">
              {quotations.length} عرض نشط {trashQuotations.length > 0 ? `· ${trashQuotations.length} محذوف` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBackup} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs transition-colors" title="باك أب عروض الأسعار">
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">باك أب</span>
            </button>
            <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm arabic font-medium transition-colors ${tab === 'active' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <FileText className="w-3.5 h-3.5" />
            العروض النشطة
            {quotations.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'active' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600'}`}>{quotations.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('trash')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm arabic font-medium transition-colors ${tab === 'trash' ? 'border-b-2 border-destructive text-destructive bg-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            المحذوفات
            {trashQuotations.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'trash' ? 'bg-destructive text-destructive-foreground' : 'bg-red-100 text-red-600'}`}>{trashQuotations.length}</span>
            )}
          </button>
        </div>

        {/* Search / Actions bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
          <div className="relative flex-1">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم العميل أو رقم العرض..."
              className="w-full bg-background border border-border rounded-lg pr-7 pl-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {tab === 'trash' && trashQuotations.length > 0 && (
            <button onClick={handleEmptyTrash} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors whitespace-nowrap">
              <AlertTriangle className="w-3 h-3" />
              تفريغ السلة
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="text-4xl">{tab === 'trash' ? '🗑️' : '📋'}</div>
              <p className="text-sm arabic">
                {tab === 'trash' ? 'سلة المحذوفات فارغة' : search ? 'لا توجد نتائج' : 'لا توجد عروض أسعار بعد'}
              </p>
              {tab === 'active' && !search && (
                <p className="text-xs arabic text-muted-foreground">ابدأ بإنشاء عرض سعر جديد من الشريط الجانبي</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(q => (
                <div key={q.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors group">
                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                        #{q.quotation_number}
                      </span>
                      <span className="text-sm font-bold arabic text-foreground truncate">{q.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{q.date}</span>
                      <span className="font-semibold text-primary">{fmt(Number(q.grand_total))} د.أ</span>
                      {q.deleted_at && (
                        <span className="text-destructive">محذوف: {new Date(q.deleted_at).toLocaleDateString('ar-JO')}</span>
                      )}
                    </div>
                    {q.notes && (
                      <p className="text-[10px] text-muted-foreground arabic truncate">{q.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {tab === 'active' ? (
                      <>
                        <button
                          onClick={() => setEditQuotation(q)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                          title="تعديل العرض"
                        >
                          <Edit2 className="w-3 h-3" />
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(q)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="نقل للمحذوفات"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(q)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 text-xs font-medium hover:bg-green-100 transition-colors"
                          title="استعادة"
                        >
                          <RotateCcw className="w-3 h-3" />
                          استعادة
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(q)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="حذف نهائي"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
