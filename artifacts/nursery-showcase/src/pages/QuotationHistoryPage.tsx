import { useState } from "react";
import { navigate } from "@/App";
import { FileText, Calendar, User, Search, Hash, Trash2, Plus, ArrowRight, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { useQuotations, useDeleteQuotation } from "@/hooks/use-quotations-v2";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function QuotationHistoryPage() {
  const { data: quotations, isLoading, error } = useQuotations();
  const deleteMutation = useDeleteQuotation();
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => { toast.success("تم حذف عرض السعر"); setConfirmId(null); },
      onError: () => { toast.error("خطأ في الحذف"); setConfirmId(null); },
    });
  };

  const filtered = (quotations || []).filter((q: any) =>
    q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.quotation_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1 text-sm font-medium">
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">سجل العروض</h1>
            <p className="text-slate-400 text-xs">تصفح وتعديل جميع عروض الأسعار</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/old-quotation")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a2744] text-white font-bold text-sm hover:bg-[#1e2f50] transition-colors">
            <Plus className="w-4 h-4" />
            عرض قادري
          </button>
          <button onClick={() => navigate("/create-quotation")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-700 text-white font-bold text-sm hover:bg-green-800 transition-colors">
            <Plus className="w-4 h-4" />
            عرض جديد
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border-2 border-slate-200 pl-4 pr-10 py-2.5 rounded-xl focus:border-green-500 focus:outline-none transition-all"
            placeholder="ابحث بالاسم أو الرقم..." />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">جاري التحميل...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">خطأ في تحميل البيانات</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700">لا توجد عروض أسعار</h3>
            <p className="text-slate-400 mt-2 mb-6">
              {search ? "لا توجد نتائج مطابقة للبحث" : "لم تقم بإنشاء أي عروض أسعار حتى الآن"}
            </p>
            {!search && (
              <button onClick={() => navigate("/create-quotation")} className="px-6 py-2.5 rounded-xl bg-green-700 text-white font-bold hover:bg-green-800 transition-colors">
                إنشاء أول عرض سعر
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((quote: any) => {
              const isExpanded = expandedId === quote.id;
              return (
                <div key={quote.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-200">
                  {/* Card Header */}
                  <div className="p-4 flex items-center gap-3">
                    <div className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 flex-shrink-0">
                      <Hash className="w-3.5 h-3.5" />
                      {quote.quotation_number}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{quote.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-xs mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-green-500" />
                        <span>{format(new Date(quote.date || quote.created_at), "dd MMMM yyyy", { locale: ar })}</span>
                        <span className="text-slate-300">·</span>
                        <span>{quote.items?.length || 0} أصناف</span>
                      </div>
                    </div>

                    <div className="text-left flex-shrink-0">
                      <div className="text-xl font-black text-slate-800">
                        {Number(quote.grand_total).toLocaleString()}
                        <span className="text-xs font-normal text-slate-400 mr-1">د.أ</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Edit */}
                      <button
                        onClick={() => navigate(`/create-quotation?edit=${quote.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-bold"
                        title="تعديل العرض"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        تعديل
                      </button>

                      {/* Delete */}
                      {confirmId === quote.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-500 font-bold">تأكيد؟</span>
                          <button onClick={() => handleDelete(quote.id)} disabled={deleteMutation.isPending}
                            className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            {deleteMutation.isPending ? "..." : "نعم"}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg">لا</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(quote.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="حذف العرض">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Expand */}
                      <button onClick={() => setExpandedId(isExpanded ? null : quote.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Items */}
                  {isExpanded && Array.isArray(quote.items) && quote.items.length > 0 && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-800 text-white">
                              <th className="p-2">#</th>
                              <th className="p-2">الاسم</th>
                              <th className="p-2">الوصف</th>
                              <th className="p-2 text-center">الكمية</th>
                              <th className="p-2 text-center">السعر</th>
                              <th className="p-2 text-center">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.items.map((item: any, idx: number) => (
                              <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="p-2 text-slate-500">{idx + 1}</td>
                                <td className="p-2 font-semibold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    {item.image_url && <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded object-cover border border-slate-200 flex-shrink-0" />}
                                    {item.name}
                                  </div>
                                </td>
                                <td className="p-2 text-slate-500">{item.description || "—"}</td>
                                <td className="p-2 text-center font-bold text-slate-700">{item.quantity}</td>
                                <td className="p-2 text-center text-slate-700">{Number(item.price).toLocaleString()}</td>
                                <td className="p-2 text-center font-black text-green-700">{Number(item.total).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900 text-white">
                              <td colSpan={5} className="p-2 font-bold text-sm">المجموع الكلي</td>
                              <td className="p-2 text-center font-black text-green-300">{Number(quote.grand_total).toLocaleString()} د.أ</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {quote.notes && (
                        <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-200">
                          <span className="font-bold text-slate-700">ملاحظات: </span>{quote.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
