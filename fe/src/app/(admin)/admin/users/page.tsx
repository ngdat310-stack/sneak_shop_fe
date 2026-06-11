"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usersApi } from "@/lib/api/users";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";
import { Search, Lock, Trash2, Unlock } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", fullName: "", password: "", phone: "", role: "user" });
  const [creating, setCreating] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<User | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [locking, setLocking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await usersApi.getAll({ keyword: keyword || undefined, role: role || undefined, page, size: 20 });
      setUsers(r.data.result.content);
      setTotalPages(r.data.result.totalPages);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [role, page]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(0); load(); };

  const handleLock = (user: User) => {
    if (user.locked) {
      void (async () => {
        try {
          await usersApi.unlock(user.id);
          toast.success("Đã mở khóa tài khoản");
          load();
        } catch {
          toast.error("Thao tác thất bại");
        }
      })();
      return;
    }
    setLockTarget(user);
    setLockReason("");
    setLockOpen(true);
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Xóa tài khoản ${user.fullName}?`)) return;
    try {
      await usersApi.delete(user.id);
      toast.success("Đã xóa tài khoản");
      load();
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  const submitLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockTarget) return;
    if (!lockReason.trim()) {
      toast.error("Vui lòng nhập lý do khóa");
      return;
    }
    setLocking(true);
    try {
      await usersApi.lock(lockTarget.id, { reason: lockReason.trim() });
      toast.success("Đã khóa tài khoản");
      setLockOpen(false);
      setLockTarget(null);
      setLockReason("");
      load();
    } catch {
      toast.error("Thao tác thất bại");
    } finally {
      setLocking(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await usersApi.create(createForm);
      toast.success("Tạo tài khoản thành công");
      setCreateOpen(false);
      load();
    } catch { toast.error("Có lỗi xảy ra"); }
    setCreating(false);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCreateForm((f) => ({ ...f, [k]: e.target.value }));

  const roleLabel = (value: string) => {
    if (value === "admin") return "Quản trị";
    if (value === "user") return "Người dùng";
    return value;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
        <Button onClick={() => setCreateOpen(true)}>+ Tạo tài khoản</Button>
      </div>

      <div className="flex gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Button type="submit" size="icon" variant="outline"><Search className="w-4 h-4" /></Button>
        </form>
        <Select value={role || "all"} onValueChange={(v) => { setRole(!v || v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-36 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="user">Người dùng</SelectItem>
            <SelectItem value="admin">Quản trị</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["ID", "Họ tên", "Email", "SĐT", "Vai trò", "Trạng thái", "Ngày tạo", ""].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Không tìm thấy</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{user.id}</td>
                  <td className="px-4 py-3 font-medium">{user.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3 text-gray-500">{user.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-xs">{roleLabel(user.role)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.enabled === false ? (
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-xs">Đã xóa</Badge>
                        {user.lockReason && (
                          <p className="max-w-xs whitespace-pre-wrap break-words text-xs text-gray-500">
                            Lý do: {user.lockReason}
                          </p>
                        )}
                        {user.lockedAt && (
                          <p className="text-[11px] text-gray-400">
                            Thời gian xóa: {formatDate(user.lockedAt)}
                          </p>
                        )}
                      </div>
                    ) : user.locked ? (
                      <div className="space-y-1">
                        <Badge variant="destructive" className="text-xs">Đã khóa</Badge>
                        {user.lockReason && (
                          <p className="max-w-xs whitespace-pre-wrap break-words text-xs text-red-500">
                            Lý do: {user.lockReason}
                          </p>
                        )}
                        {user.lockedAt && (
                          <p className="text-[11px] text-gray-400">
                            Thời gian khóa: {formatDate(user.lockedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Hoạt động</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleLock(user)} className="gap-1" disabled={user.enabled === false}>
                        {user.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {user.locked ? "Mở khóa" : "Khóa"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-red-600 hover:text-red-700"
                        onClick={() => void handleDelete(user)}
                        disabled={user.enabled === false}
                      >
                        <Trash2 className="w-3 h-3" />
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Trước</Button>
          <span className="flex items-center px-3 text-sm">{page + 1}/{totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Tiếp</Button>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tạo tài khoản mới</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {[
              { id: "fullName", label: "Họ tên", type: "text" },
              { id: "email", label: "Email", type: "email" },
              { id: "phone", label: "SĐT", type: "tel" },
              { id: "password", label: "Mật khẩu", type: "password" },
            ].map(({ id, label, type }) => (
              <div key={id}>
                <p className="text-sm font-medium mb-1">{label}</p>
                <Input type={type} value={createForm[id as keyof typeof createForm]} onChange={set(id)} required={id !== "phone"} />
              </div>
            ))}
            <div>
              <p className="text-sm font-medium mb-1">Vai trò</p>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v ?? "user" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Người dùng</SelectItem>
                  <SelectItem value="admin">Quản trị</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={creating}>{creating ? "Đang tạo..." : "Tạo"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khóa tài khoản</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitLock} className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Người dùng</p>
              <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                {lockTarget?.fullName} <span className="text-gray-400">({lockTarget?.email})</span>
              </div>
            </div>
            {lockTarget?.lockedAt && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Đang khóa từ</p>
                <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                  {formatDate(lockTarget.lockedAt)}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">Lý do khóa</p>
              <Textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setLockOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={locking}>{locking ? "Đang khóa..." : "Khóa tài khoản"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
