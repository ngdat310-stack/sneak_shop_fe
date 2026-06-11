"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { categoriesApi } from "@/lib/api/categories";
import type { Category } from "@/lib/types";
import { Pencil, Trash2, Plus, RotateCcw } from "lucide-react";

const toSlug = (name: string) =>
  name.toLowerCase()
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");

interface FormState {
  parentId: string;
  name: string;
  slug: string;
  sortOrder: string;
  status: "active" | "inactive";
}

const emptyForm = (): FormState => ({
  parentId: "", name: "", slug: "", sortOrder: "", status: "active",
});

const getDescendantIds = (items: Category[], id: number): number[] => {
  const children = items.filter((i) => i.parentId === id).map((i) => i.id);
  return children.flatMap((cid) => [cid, ...getDescendantIds(items, cid)]);
};

type CategoryNode = Category & { children: CategoryNode[] };

const buildCategoryTree = (items: Category[]): CategoryNode[] => {
  const map = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  const sorted = [...items].sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  sorted.forEach((item) => {
    const node = map.get(item.id);
    if (!node) return;
    if (item.parentId == null) {
      roots.push(node);
      return;
    }
    const parent = map.get(item.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const sortTree = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes
      .sort((a, b) => {
        const ao = a.sortOrder ?? 0;
        const bo = b.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({ ...node, children: sortTree(node.children) }));

  return sortTree(roots);
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    categoriesApi.adminGetAll()
      .then((r) => setCategories(r.data.result))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Vui lòng nhập tên danh mục"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), slug: form.slug,
        parentId: form.parentId ? Number(form.parentId) : null,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
        status: form.status,
      };
      if (editing !== null) { await categoriesApi.adminUpdate(editing, payload); toast.success("Đã cập nhật"); }
      else { await categoriesApi.adminCreate(payload); toast.success("Đã tạo danh mục"); }
      setOpen(false); load();
    } catch { toast.error("Có lỗi xảy ra"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa danh mục này?")) return;
    try { await categoriesApi.adminDelete(id); toast.success("Đã xóa"); load(); }
    catch { toast.error("Không thể xóa"); }
  };

  const handleRestore = async (id: number) => {
    try { await categoriesApi.adminRestore(id); toast.success("Đã khôi phục"); load(); }
    catch { toast.error("Không thể khôi phục"); }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setForm({
      parentId: c.parentId ? String(c.parentId) : "",
      name: c.name, slug: c.slug,
      sortOrder: c.sortOrder != null ? String(c.sortOrder) : "",
      status: c.status === "inactive" ? "inactive" : "active",
    });
    setEditing(c.id);
    setOpen(true);
  };

  const activeCategories = categories.filter((c) => !c.deleted);
  const editingDescendants = editing !== null
    ? new Set<number>([editing, ...getDescendantIds(activeCategories, editing)])
    : new Set<number>();
  const parentOptions = activeCategories.filter((c) => !c.parentId && !editingDescendants.has(c.id));

  const categoryTree = buildCategoryTree(activeCategories);
  const rows: Array<{ node: CategoryNode; depth: number }> = [];
  const pushRows = (nodes: CategoryNode[], depth = 0) => {
    nodes.forEach((node) => {
      rows.push({ node, depth });
      if (node.children.length > 0) pushRows(node.children, depth + 1);
    });
  };
  pushRows(categoryTree);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý danh mục</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openCreate()} className="gap-1">
            <Plus className="w-4 h-4" />Thêm danh mục
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[50%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 text-left">Tên danh mục</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 text-center">STT</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 text-left">Trạng thái</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">Chưa có dữ liệu</td></tr>
            ) : rows.map(({ node: c, depth }) => {
              const isRoot = depth === 0;
              return (
                <tr key={c.id} className={`border-b last:border-0 ${c.deleted ? "bg-red-50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!isRoot && <span className="text-gray-300 select-none" style={{ paddingLeft: `${depth * 16}px` }}>↳</span>}
                      <span className={`font-medium ${isRoot ? "text-gray-900" : "text-gray-700"} ${c.deleted ? "line-through text-red-400" : ""}`}>
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{c.sortOrder ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.deleted ? (
                      <Badge variant="destructive" className="text-xs">Đã xóa</Badge>
                    ) : (
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">
                        {c.status === "active" ? "Hoạt động" : "Ẩn"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {c.deleted ? (
                        <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleRestore(c.id)}>
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(c.id)}><Trash2 className="w-3 h-3" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[56vw] min-w-[720px] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing !== null ? "Sửa danh mục" : "Thêm danh mục"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-sm font-medium mb-1">Danh mục cha <span className="text-gray-400">(không bắt buộc)</span></p>
              <Select value={form.parentId || ""} onValueChange={(v) => setForm((f) => ({ ...f, parentId: v ?? "" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Không chọn danh mục cha" />
                </SelectTrigger>
                <SelectContent>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">
                Để trống thì lưu thành danh mục cha. Chọn một danh mục cha để lưu thành danh mục con.
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-sm font-medium mb-1">Tên danh mục <span className="text-red-500">*</span></p>
              <Input value={form.name} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v, slug: toSlug(v) })); }} required />
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Số thứ tự</p>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} min={1} />
              <p className="text-xs text-gray-400 mt-1">Áp dụng cho cả danh mục cha và danh mục con.</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Trạng thái</p>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v === "inactive" ? "inactive" : "active" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Ẩn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
