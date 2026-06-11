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

interface CreateLevelState {
  enabled: boolean;
  id: number | null;
  name: string;
  sortOrder: string;
}

interface CreateFormState {
  status: "active" | "inactive";
  main: CreateLevelState;
  parent: CreateLevelState;
  child: CreateLevelState;
}

const emptyCreateLevel = (enabled = false): CreateLevelState => ({
  enabled,
  id: null,
  name: "",
  sortOrder: "",
});

const categoryToLevel = (category?: Category): CreateLevelState => category
  ? {
      enabled: true,
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder != null ? String(category.sortOrder) : "",
    }
  : emptyCreateLevel(false);

const firstChildOf = (items: Category[], parentId: number) =>
  items
    .filter((item) => !item.deleted && item.parentId === parentId)
    .sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      return orderDiff || a.name.localeCompare(b.name);
    })[0];

const rootAncestorOf = (items: Category[], category: Category) => {
  const byId = new Map(items.map((item) => [item.id, item]));
  let current = category;
  while (current.parentId != null) {
    const parent = byId.get(current.parentId);
    if (!parent || parent.deleted) break;
    current = parent;
  }
  return current;
};

const emptyCreateForm = (): CreateFormState => ({
  status: "active",
  main: emptyCreateLevel(true),
  parent: emptyCreateLevel(false),
  child: emptyCreateLevel(false),
});

const getDescendantIds = (items: Category[], id: number): number[] => {
  const children = items.filter((i) => i.parentId === id).map((i) => i.id);
  return children.flatMap((cid) => [cid, ...getDescendantIds(items, cid)]);
};

type CategoryNode = Category & { children: CategoryNode[] };
const PARENT_DATALIST_ID = "category-parent-options";

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
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm());
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
    if (!createForm.main.name.trim()) { toast.error("Vui lòng nhập danh mục chính"); return; }
    if (createForm.child.enabled && createForm.child.name.trim() && !createForm.parent.name.trim()) {
      toast.error("Danh mục con cần có danh mục cha");
      return;
    }

    setSaving(true);
    try {
      const createCategory = async (name: string, parentId: number | null, sortOrder: string) =>
        categoriesApi.adminCreate({
          name: name.trim(),
          slug: toSlug(name.trim()),
          parentId,
          sortOrder: sortOrder ? Number(sortOrder) : 0,
          status: createForm.status,
        });

      if (editing !== null) {
        const payload = {
          name: createForm.main.name.trim(),
          slug: toSlug(createForm.main.name.trim()),
          parentId: null,
          sortOrder: createForm.main.sortOrder ? Number(createForm.main.sortOrder) : 0,
          status: createForm.status,
        };
        await categoriesApi.adminUpdate(editing, payload);

        const parentName = createForm.parent.name.trim();
        let parentId: number | null = null;
        if (createForm.parent.enabled && parentName) {
          const parentRes = createForm.parent.id !== null
            ? await categoriesApi.adminUpdate(createForm.parent.id, {
                name: parentName,
                slug: toSlug(parentName),
                parentId: editing,
                sortOrder: createForm.parent.sortOrder ? Number(createForm.parent.sortOrder) : 0,
                status: createForm.status,
              })
            : await createCategory(parentName, editing, createForm.parent.sortOrder);
          parentId = parentRes.data.result.id;
        }

        if (createForm.child.enabled && createForm.child.name.trim()) {
          const childName = createForm.child.name.trim();
          if (createForm.child.id !== null) {
            await categoriesApi.adminUpdate(createForm.child.id, {
              name: childName,
              slug: toSlug(childName),
              parentId: parentId ?? editing,
              sortOrder: createForm.child.sortOrder ? Number(createForm.child.sortOrder) : 0,
              status: createForm.status,
            });
          } else {
            await createCategory(childName, parentId ?? editing, createForm.child.sortOrder);
          }
        }
        toast.success("Đã cập nhật");
      }

      if (editing === null) {
        const mainRes = await createCategory(createForm.main.name, null, createForm.main.sortOrder);
        const mainId = mainRes.data.result.id;
        const parentName = createForm.parent.name.trim();
        let parentId: number | null = null;

        if (createForm.parent.enabled && parentName) {
          const parentRes = await createCategory(parentName, mainId, createForm.parent.sortOrder);
          parentId = parentRes.data.result.id;
        }

        if (createForm.child.enabled && createForm.child.name.trim()) {
          await createCategory(
            createForm.child.name,
            parentId ?? mainId,
            createForm.child.sortOrder
          );
        }
        toast.success("Đã tạo danh mục");
      }
      setOpen(false); load();
    } catch { toast.error("Có lỗi xảy ra"); }
    finally {
      setSaving(false);
    }
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
    setCreateForm(emptyCreateForm());
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: Category, depth = 0) => {
    const root = rootAncestorOf(categories, c);
    const parent = depth === 0
      ? firstChildOf(categories, root.id)
      : depth === 1
        ? c
        : categories.find((item) => item.id === c.parentId);
    const child = depth === 0
      ? (parent ? firstChildOf(categories, parent.id) : undefined)
      : depth === 1
        ? firstChildOf(categories, c.id)
        : c;

    setCreateForm({
      status: root.status === "inactive" ? "inactive" : "active",
      main: categoryToLevel(root),
      parent: categoryToLevel(parent),
      child: categoryToLevel(child),
    });
    setEditing(root.id);
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
                        isRoot ? (
                          <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleRestore(c.id)}>
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        ) : null
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(c, depth)}><Pencil className="w-3 h-3" /></Button>
                          {isRoot && (
                            <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(c.id)}><Trash2 className="w-3 h-3" /></Button>
                          )}
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
          <form onSubmit={handleSave} className="space-y-5">
            <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Danh mục chính <span className="text-red-500">*</span></p>
                <span className="text-xs text-gray-400">Bắt buộc</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium mb-1">Tên danh mục chính</p>
                  <Input
                    value={createForm.main.name}
                    onChange={(e) => setCreateForm((f) => ({
                      ...f,
                      main: { ...f.main, name: e.target.value },
                    }))}
                    required
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">STT</p>
                  <Input
                    type="number"
                    min={1}
                    value={createForm.main.sortOrder}
                    onChange={(e) => setCreateForm((f) => ({
                      ...f,
                      main: { ...f.main, sortOrder: e.target.value },
                    }))}
                  />
                </div>
              </div>
            </div>

            {createForm.parent.enabled ? (
              <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Danh mục cha</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreateForm((f) => ({
                      ...f,
                      parent: emptyCreateLevel(false),
                      child: emptyCreateLevel(false),
                    }))}
                  >
                    Bỏ
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-1">Tên danh mục cha</p>
                    <Input
                      list={PARENT_DATALIST_ID}
                      value={createForm.parent.name}
                      onChange={(e) => setCreateForm((f) => ({
                        ...f,
                        parent: { ...f.parent, name: e.target.value },
                      }))}
                      placeholder="Gõ để chọn hoặc nhập"
                    />
                    <datalist id={PARENT_DATALIST_ID}>
                      {parentOptions.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">STT</p>
                    <Input
                      type="number"
                      min={1}
                      value={createForm.parent.sortOrder}
                      onChange={(e) => setCreateForm((f) => ({
                        ...f,
                        parent: { ...f.parent, sortOrder: e.target.value },
                      }))}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateForm((f) => ({ ...f, parent: emptyCreateLevel(true) }))}
              >
                Thêm danh mục cha
              </Button>
            )}

            {createForm.child.enabled ? (
              <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Danh mục con</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreateForm((f) => ({ ...f, child: emptyCreateLevel(false) }))}
                  >
                    Bỏ
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-1">Tên danh mục con</p>
                    <Input
                      value={createForm.child.name}
                      onChange={(e) => setCreateForm((f) => ({
                        ...f,
                        child: { ...f.child, name: e.target.value },
                      }))}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">STT</p>
                    <Input
                      type="number"
                      min={1}
                      value={createForm.child.sortOrder}
                      onChange={(e) => setCreateForm((f) => ({
                        ...f,
                        child: { ...f.child, sortOrder: e.target.value },
                      }))}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateForm((f) => ({
                  ...f,
                  parent: f.parent.enabled ? f.parent : emptyCreateLevel(true),
                  child: emptyCreateLevel(true),
                }))}
              >
                Thêm danh mục con
              </Button>
            )}

            <div className="rounded-xl border bg-white p-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium mb-1">Trạng thái</p>
                <Select
                  value={createForm.status}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, status: v === "inactive" ? "inactive" : "active" }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hoạt động</SelectItem>
                    <SelectItem value="inactive">Ẩn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : editing !== null ? "Cập nhật" : "Lưu"}</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
