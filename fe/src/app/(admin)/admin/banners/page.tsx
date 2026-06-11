"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { GripVertical, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { bannersApi } from "@/lib/api/banners";
import type { Banner } from "@/lib/types";
import { toFrontendImageUrl } from "@/lib/image";

const MAX_BANNERS = 9;

const sortBanners = (items: Banner[]) =>
  [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return b.id - a.id;
  });

const moveItem = <T,>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderedBanners = useMemo(() => sortBanners(banners), [banners]);
  const canAdd = orderedBanners.length < MAX_BANNERS;

  const load = async () => {
    setLoading(true);
    try {
      const r = await bannersApi.adminGetAll();
      setBanners(sortBanners(r.data.result ?? []));
    } catch {
      toast.error("Không thể tải danh sách banner");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openPicker = (targetId: number | null = null) => {
    if (targetId === null && !canAdd) {
      toast.error("Chỉ được tối đa 9 banner");
      return;
    }
    setUploadTargetId(targetId);
    fileInputRef.current?.click();
  };

  const persistOrder = async (next: Banner[]) => {
    const normalized = next.map((banner, index) => ({ ...banner, sortOrder: index }));
    setBanners(normalized);
    try {
      await bannersApi.adminReorder(normalized.map((banner) => banner.id));
    } catch {
      toast.error("Không thể lưu thứ tự banner");
      await load();
    } finally {
      setDraggedId(null);
    }
  };

  const handleDropOnBanner = async (targetId: number) => {
    if (draggedId == null || draggedId === targetId) return;
    const fromIndex = orderedBanners.findIndex((banner) => banner.id === draggedId);
    const toIndex = orderedBanners.findIndex((banner) => banner.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    await persistOrder(moveItem(orderedBanners, fromIndex, toIndex));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ nhận file ảnh");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ảnh tối đa 10MB");
      return;
    }

    setBusyId(uploadTargetId ?? -1);
    try {
      const uploaded = await bannersApi.uploadImage(file);
      const imageUrl = uploaded.data.url;

      if (uploadTargetId === null) {
        await bannersApi.adminCreate({
          imageUrl,
          title: null,
          linkUrl: null,
          position: "hero",
          isActive: true,
          sortOrder: orderedBanners.length,
        });
        toast.success("Đã thêm banner");
      } else {
        const current = orderedBanners.find((banner) => banner.id === uploadTargetId);
        await bannersApi.adminUpdate(uploadTargetId, {
          imageUrl,
          title: current?.title ?? null,
          linkUrl: current?.linkUrl ?? null,
          position: current?.position ?? "hero",
          isActive: current?.isActive ?? true,
          sortOrder: current?.sortOrder ?? 0,
        });
        toast.success("Đã đổi ảnh banner");
      }

      await load();
    } catch {
      toast.error("Không thể lưu ảnh banner");
    } finally {
      setBusyId(null);
      setUploadTargetId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa banner này?")) return;
    setBusyId(id);
    try {
      await bannersApi.adminDelete(id);
      toast.success("Đã xóa banner");
      await load();
    } catch {
      toast.error("Không thể xóa banner");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Quản lý Banner</h1>
          <p className="text-sm text-gray-500">
            Chỉ quản lý ảnh, kéo thả để đổi thứ tự, tối đa {MAX_BANNERS} banner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-9 px-3 text-sm">
            {orderedBanners.length}/{MAX_BANNERS}
          </Badge>
          <Button variant="outline" onClick={() => void load()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tải lại
          </Button>
          <Button onClick={() => openPicker(null)} className="gap-2" disabled={!canAdd}>
            <Upload className="h-4 w-4" />
            Tải ảnh mới
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderedBanners.map((banner, index) => (
            <div
              key={banner.id}
              draggable
              onDragStart={() => setDraggedId(banner.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleDropOnBanner(banner.id)}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[16/10] bg-gray-100">
                <Image
                  src={toFrontendImageUrl(banner.imageUrl)}
                  alt={`Banner ${index + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1280px) 100vw, 33vw"
                />

                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                    <GripVertical className="h-3.5 w-3.5" />
                    Kéo thả
                  </span>
                </div>

                <div className="absolute right-3 top-3 flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 rounded-full bg-white/95 shadow-sm"
                    onClick={() => openPicker(banner.id)}
                    disabled={busyId === banner.id}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 rounded-full bg-white/95 text-red-600 shadow-sm hover:text-red-700"
                    onClick={() => void handleDelete(banner.id)}
                    disabled={busyId === banner.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {canAdd && (
            <button
              type="button"
              onClick={() => openPicker(null)}
              className="flex min-h-[18rem] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-gray-400 hover:bg-gray-100"
            >
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                  <ImagePlus className="h-7 w-7" />
                </span>
                <div className="text-center">
                  <p className="font-medium text-gray-900">Thêm banner mới</p>
                  <p className="text-sm text-gray-500">Chỉ cần chọn ảnh</p>
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
