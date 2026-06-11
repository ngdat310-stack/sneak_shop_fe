"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, GripVertical, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoriesApi } from "@/lib/api/categories";
import { imagesApi } from "@/lib/api/images";
import { productsApi } from "@/lib/api/products";
import { formatVND } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

const MAX_GALLERY = 10;
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

const toSlug = (name: string) => {
  if (!name.trim()) return "";
  return name.toLowerCase()
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");
};
const normalizeColor = (value: string) => value.trim().toLowerCase();

interface MediaDraft  { localId: string; url: string; type: "image" | "video"; }
interface ColorDraft  { localId: string; color: string; stockQuantity: string; imageUrl: string; }
interface VariantDraft { localId: string; size: string; price: string; colors: ColorDraft[]; }

const emptyColor   = (): ColorDraft   => ({ localId: uid("c"), color: "", stockQuantity: "0", imageUrl: "" });
const emptyVariant = (): VariantDraft => ({ localId: uid("v"), size: "", price: "", colors: [emptyColor()] });
const inferMediaTypeFromFile = (file: File): "image" | "video" => file.type.startsWith("video/") ? "video" : "image";
const inferMediaTypeFromUrl = (url: string): "image" | "video" => {
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(clean)) return "video";
  return "image";
};

const mapVariants = (items: Product["variants"]): VariantDraft[] => {
  if (!items?.length) return [emptyVariant()];
  return items.map((v, i) => ({
    localId: `variant-${v.id ?? i}`,
    size: v.size ?? "",
    price: String(v.price ?? ""),
    colors: v.colors?.length
      ? v.colors.map((c, ci) => ({
          localId: `color-${v.id ?? i}-${c.id ?? ci}`,
          color: c.color ?? "",
          stockQuantity: String(c.stockQuantity ?? 0),
          imageUrl: c.imageUrl ?? "",
        }))
      : [emptyColor()],
  }));
};

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const coverInputRef      = useRef<HTMLInputElement>(null);
  const galleryInputRef    = useRef<HTMLInputElement>(null);
  const sizeGuideImgRef    = useRef<HTMLInputElement>(null);
  const sizeGuideTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState({
    name: "", description: "",
    coverImageUrl: "", sizeGuideNote: "",
    status: "active", categoryIds: [] as number[],
    discountPercent: 0,
  });
  const [sizeGuidePreview, setSizeGuidePreview] = useState(false);
  const [media,    setMedia]    = useState<MediaDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving,          setSaving]          = useState(false);
  const [loading,         setLoading]         = useState(!isNew);
  const [uploadingCover,     setUploadingCover]     = useState(false);
  const [uploadingGallery,   setUploadingGallery]   = useState(false);
  const [uploadingSizeImg,   setUploadingSizeImg]   = useState(false);
  const [dragIndex,       setDragIndex]       = useState<number | null>(null);

  const minPrice = Number(variants[0]?.price) || 0;
  const selectedCategoryId = form.categoryIds[0] ?? null;
  const selectedCategory = selectedCategoryId ? categories.find((c) => c.id === selectedCategoryId) : null;
  const selectedCategoryLabel = selectedCategory
    ? (selectedCategory.parentName
        ? `${selectedCategory.sortOrder}. ${selectedCategory.parentName} / ${selectedCategory.name}`
        : `${selectedCategory.sortOrder}. ${selectedCategory.name}`)
    : "Chọn danh mục";

  const sortedCategoryOptions = (() => {
    const roots = categories.filter((c) => !c.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const result: Category[] = [];
    roots.forEach((root) => {
      result.push(root);
      categories
        .filter((c) => c.parentId === root.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .forEach((child) => result.push(child));
    });
    return result;
  })();

  useEffect(() => {
    categoriesApi.getAll().then((r) => setCategories(r.data.result)).catch(() => {});
    if (isNew) return;
    productsApi.getById(Number(id))
      .then((r) => {
        const p: Product = r.data.result;
        setForm({
          name: p.name, description: p.description ?? "",
          coverImageUrl: p.coverImageUrl ?? "", sizeGuideNote: p.sizeGuideNote ?? "",
          status: p.status, categoryIds: p.categories.map((c) => c.id),
          discountPercent: p.discountPercent ?? 0,
        });
        setMedia((p.media ?? p.images ?? [])
          .filter((img) => Boolean(img?.imageUrl?.trim()))
          .map((img, idx) => ({
            localId: `media-${img.id ?? idx}`,
            url: img.imageUrl.trim(),
            type: img.type === "video" ? "video" : inferMediaTypeFromUrl(img.imageUrl.trim()),
          })));
        setVariants(mapVariants(p.variants));
      })
      .catch(() => toast.error("Không tải được sản phẩm"))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const setField = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ── Gallery helpers ── */
  const addToGallery = (url: string) => {
    const safeUrl = url.trim();
    if (!safeUrl) return;
    setMedia((curr) => {
      if (curr.length >= MAX_GALLERY || curr.some((m) => m.url === safeUrl)) return curr;
      return [...curr, { localId: uid("media"), url: safeUrl, type: "image" }];
    });
  };

  const findSharedColorImage = (targetColor: string, skipVariantId?: string, skipColorId?: string) => {
    const key = normalizeColor(targetColor);
    if (!key) return "";
    for (const variant of variants) {
      for (const color of variant.colors) {
        if (skipVariantId && skipColorId && variant.localId === skipVariantId && color.localId === skipColorId) continue;
        if (normalizeColor(color.color) === key && color.imageUrl) {
          return color.imageUrl;
        }
      }
    }
    return "";
  };

  const syncColorImageByName = (targetColor: string, imageUrl: string) => {
    const key = normalizeColor(targetColor);
    if (!key) return;
    setVariants((curr) => curr.map((variant) => ({
      ...variant,
      colors: variant.colors.map((color) =>
        normalizeColor(color.color) === key ? { ...color, imageUrl } : color
      ),
    })));
  };

  const clearColorImageByName = (targetColor: string) => {
    const key = normalizeColor(targetColor);
    if (!key) return;
    setVariants((curr) => curr.map((variant) => ({
      ...variant,
      colors: variant.colors.map((color) =>
        normalizeColor(color.color) === key ? { ...color, imageUrl: "" } : color
      ),
    })));
  };

  const uploadOne = async (file: File) => imagesApi.upload(file);

  const handleSizeGuideImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSizeImg(true);
    try {
      const url = await uploadOne(file);
      const ta = sizeGuideTextareaRef.current;
      const insert = `\n![](${url})\n`;
      if (ta) {
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        const current = form.sizeGuideNote;
        const next = current.slice(0, start) + insert + current.slice(end);
        setForm((f) => ({ ...f, sizeGuideNote: next }));
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
          ta.focus();
        }, 0);
      } else {
        setForm((f) => ({ ...f, sizeGuideNote: f.sizeGuideNote + insert }));
      }
      toast.success("Đã chèn ảnh");
    } catch { toast.error("Không tải được ảnh"); }
    finally {
      setUploadingSizeImg(false);
      e.target.value = "";
    }
  };

  const handleCoverDrop = async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadOne(file);
      setForm((f) => ({ ...f, coverImageUrl: url }));
      toast.success("Đã tải ảnh bìa");
    } catch { toast.error("Không tải được ảnh bìa"); }
    finally { setUploadingCover(false); }
  };

  const handleGalleryDrop = async (files: FileList | File[]) => {
    const mediaFiles = Array.from(files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!mediaFiles.length) return;
    setUploadingGallery(true);
    try {
      const uploaded = mediaFiles.length === 1
        ? [{ url: await uploadOne(mediaFiles[0]), type: inferMediaTypeFromFile(mediaFiles[0]) }]
        : await Promise.all(mediaFiles.map(async (file) => ({
            url: await uploadOne(file),
            type: inferMediaTypeFromFile(file),
          })));
      setMedia((curr) => {
        const remaining = MAX_GALLERY - curr.length;
        if (remaining <= 0) { toast.error(`Tối đa ${MAX_GALLERY} ảnh thật`); return curr; }
        const toAdd = uploaded
          .map((item) => ({ url: item.url.trim(), type: item.type }))
          .filter((item) => Boolean(item.url))
          .slice(0, remaining)
          .filter((item) => !curr.some((m) => m.url === item.url));
        return [...curr, ...toAdd.map((item) => ({ localId: uid("media"), url: item.url, type: item.type }))];
      });
      toast.success("Đã thêm media sản phẩm");
    } catch { toast.error("Không tải được ảnh sản phẩm"); }
    finally { setUploadingGallery(false); }
  };

  const moveMedia = (from: number, to: number) => {
    if (from === to) return;
    setMedia((curr) => {
      const next = [...curr];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
  };

  /* ── Variant / Color helpers ── */
  const setVariantField = (vi: number, key: "size" | "price") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setVariants((curr) => curr.map((row, i) => i === vi ? { ...row, [key]: e.target.value } : row));

  const setColorField = (vi: number, ci: number, key: "color" | "stockQuantity") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setVariants((curr) => curr.map((v, i) =>
        i !== vi ? v : {
          ...v,
          colors: v.colors.map((c, j) => j === ci ? { ...c, [key]: e.target.value } : c),
        }
      ));

  const addColor = (vi: number) => {
    setVariants((curr) => curr.map((v, i) =>
      i !== vi ? v : { ...v, colors: [...v.colors, emptyColor()] }
    ));
  };

  const removeColor = (vi: number, ci: number) => {
    setVariants((curr) => curr.map((v, i) => {
      if (i !== vi) return v;
      const next = v.colors.filter((_, j) => j !== ci);
      return { ...v, colors: next.length ? next : [emptyColor()] };
    }));
  };

  const uploadColorImage = async (vi: number, ci: number, file?: File) => {
    if (!file) return;
    try {
      const url = await uploadOne(file);
      const targetColor = variants[vi]?.colors[ci]?.color ?? "";
      syncColorImageByName(targetColor, url);
      addToGallery(url);
      toast.success("Đã tải ảnh màu");
    } catch { toast.error("Không tải được ảnh màu"); }
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (minPrice <= 0) { toast.error("Vui lòng nhập giá ít nhất một size"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        coverImageUrl: form.coverImageUrl || null,
        price: minPrice,
        discountPercent: form.discountPercent,
        media: media
          .map((item) => ({ url: item.url.trim(), type: item.type }))
          .filter((item) => Boolean(item.url)),
        variants: variants
          .filter((v) => v.size.trim() && Number(v.price) > 0)
          .map((v) => ({
            size: v.size.trim(),
            price: Number(v.price),
            colors: v.colors
              .filter((c) => c.color.trim())
              .map((c) => ({
                color: c.color.trim(),
                stockQuantity: Number(c.stockQuantity) || 0,
                imageUrl: c.imageUrl || undefined,
              })),
          })),
      };
      if (isNew) {
        await productsApi.create(payload);
        toast.success("Đã tạo sản phẩm");
      } else {
        await productsApi.update(Number(id), payload);
        toast.success("Đã cập nhật sản phẩm");
      }
      router.push("/admin/products");
    } catch { toast.error("Có lỗi xảy ra"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{isNew ? "Thêm sản phẩm" : "Sửa sản phẩm"}</h1>
          <p className="text-sm text-gray-500">Ảnh bìa, gallery, size, màu và giá theo size.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Thông tin cơ bản ── */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Thông tin cơ bản</h2>

          <div className="space-y-1">
            <p className="text-sm font-medium">Tên sản phẩm</p>
            <Input value={form.name} onChange={setField("name")} required />
            {form.name && (
              <p className="text-xs text-gray-400 mt-1">
                Slug: <span className="font-mono text-gray-500">{toSlug(form.name)}</span>
              </p>
            )}
          </div>


          <div className="space-y-1">
            <p className="text-sm font-medium">Mô tả</p>
            <Textarea rows={4} value={form.description} onChange={setField("description")} />
          </div>

          {/* Ghi chú size — Markdown */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Ghi chú size (Markdown)</p>
              <div className="flex items-center gap-1">
                {!sizeGuidePreview && (
                  <>
                    <input ref={sizeGuideImgRef} type="file" accept="image/*" className="hidden" onChange={handleSizeGuideImageUpload} />
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => sizeGuideImgRef.current?.click()}
                      disabled={uploadingSizeImg}
                      className="gap-1 text-gray-500"
                    >
                      <ImagePlus className="w-4 h-4" />
                      {uploadingSizeImg ? "Đang tải..." : "Chèn ảnh"}
                    </Button>
                  </>
                )}
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => setSizeGuidePreview((v) => !v)}
                  className="gap-1 text-gray-500"
                >
                  {sizeGuidePreview ? <><EyeOff className="w-4 h-4" />Sửa</> : <><Eye className="w-4 h-4" />Xem trước</>}
                </Button>
              </div>
            </div>
            {sizeGuidePreview ? (
              <div className="min-h-20 rounded-lg border bg-gray-50 px-4 py-3 prose prose-sm max-w-none text-sm">
                {form.sizeGuideNote
                  ? <ReactMarkdown>{form.sizeGuideNote}</ReactMarkdown>
                  : <span className="text-gray-400 italic">Chưa có nội dung</span>
                }
              </div>
            ) : (
              <>
                <Textarea
                  ref={sizeGuideTextareaRef}
                  rows={5}
                  maxLength={2000}
                  value={form.sizeGuideNote}
                  onChange={setField("sizeGuideNote")}
                  className={`font-mono text-sm ${form.sizeGuideNote.length > 1900 ? "border-orange-400 focus-visible:border-orange-400" : ""}`}
                />
                <p className={`text-xs text-right ${form.sizeGuideNote.length > 1900 ? "text-orange-500" : "text-gray-400"}`}>
                  {form.sizeGuideNote.length}/2000
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Trạng thái</p>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v ?? "active" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Đang bán</SelectItem>
                  <SelectItem value="inactive">Ẩn</SelectItem>
                  <SelectItem value="out_of_stock">Hết hàng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Danh mục</p>
              <Select
                value={form.categoryIds[0] ? String(form.categoryIds[0]) : ""}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryIds: v ? [Number(v)] : [] }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedCategoryLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortedCategoryOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.parentId
                        ? `↳ ${c.sortOrder}. ${c.name}`
                        : `${c.sortOrder}. ${c.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Giảm giá (%)</p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.discountPercent}
                className="w-40"
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  setForm((f) => ({ ...f, discountPercent: v }));
                }}
              />
            </div>
          </div>
        </section>

        {/* ── Ảnh bìa ── */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-700">Ảnh bìa</h2>
              <p className="text-sm text-gray-500">Ảnh chính hiển thị trên danh sách sản phẩm.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
              <Upload className="w-4 h-4 mr-2" />{uploadingCover ? "Đang tải..." : "Chọn ảnh"}
            </Button>
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCoverDrop([f]); e.currentTarget.value = ""; }} />
          <div
            className="flex min-h-48 items-center justify-center rounded-xl border border-dashed bg-gray-50 p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void handleCoverDrop(e.dataTransfer.files); }}
          >
            {form.coverImageUrl ? (
              <div className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-white">
                <div className="relative aspect-[16/10]">
                  <Image src={form.coverImageUrl} alt="Ảnh bìa" fill className="object-cover" />
                </div>
                <div className="flex justify-end border-t px-4 py-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, coverImageUrl: "" }))}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => coverInputRef.current?.click()} className="flex flex-col items-center gap-3 text-gray-400">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-white">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <span className="text-sm">Kéo thả hoặc bấm để chọn ảnh bìa</span>
              </button>
            )}
          </div>
        </section>

        {/* ── Ảnh sản phẩm (gallery) ── */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-700">Ảnh sản phẩm</h2>
              <p className="text-sm text-gray-500">
                Tối đa {MAX_GALLERY} media. Ảnh màu upload ở phía dưới cũng được tính vào đây.
                <span className="ml-2 font-medium text-gray-700">{media.filter((item) => item.url.trim()).length}/{MAX_GALLERY}</span>
              </p>
            </div>
            <Button type="button" variant="outline"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGallery || media.filter((item) => item.url.trim()).length >= MAX_GALLERY}
            >
              <Plus className="w-4 h-4 mr-2" />{uploadingGallery ? "Đang tải..." : "Thêm media"}
            </Button>
          </div>
          <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={(e) => { const files = e.target.files; if (files?.length) void handleGalleryDrop(files); e.currentTarget.value = ""; }} />

          <div
            className="rounded-xl border border-dashed bg-gray-50 p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (media.filter((item) => item.url.trim()).length < MAX_GALLERY) void handleGalleryDrop(e.dataTransfer.files); }}
          >
            {media.filter((item) => item.url.trim()).length === 0 ? (
              <div className="flex min-h-24 items-center justify-center text-sm text-gray-400">
                Thả ảnh/video vào đây hoặc dùng nút thêm media
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {media
                  .filter((item) => item.url.trim())
                  .map((item, index) => (
                  <div key={item.localId} draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null) { moveMedia(dragIndex, index); setDragIndex(null); } }}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-white"
                  >
                    {item.type === "video" ? (
                      <video
                        src={item.url.trim()}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <Image src={item.url.trim()} alt={`Ảnh ${index + 1}`} fill className="object-cover" />
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {item.type === "video" ? "Video" : "Ảnh"}
                    </span>
                    <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/30 transition">
                      <GripVertical className="w-4 h-4 text-white" />
                      <button type="button" onClick={() => setMedia((m) => m.filter((_, i) => i !== index))}
                        className="rounded-full bg-red-500 p-1 text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">Chính</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Biến thể ── */}
        <section className="rounded-xl border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-700">Kích cỡ, màu và giá</h2>
              <p className="text-sm text-gray-500">Mỗi size có giá riêng. Mỗi màu có tồn kho và một ảnh riêng.</p>
            </div>
            <Button type="button" variant="outline" size="sm"
              onClick={() => setVariants((curr) => [...curr, emptyVariant()])}>
              <Plus className="w-4 h-4 mr-1" />Thêm size
            </Button>
          </div>

          <div className="space-y-4">
            {variants.map((variant, vi) => (
              <div key={variant.localId} className="rounded-xl border bg-gray-50 p-4 space-y-3">
                {/* Size + Giá */}
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600">Kích cỡ</p>
                    <Input
                      value={variant.size}
                      onChange={setVariantField(vi, "size")}
                      onBlur={() => {
                        const val = variant.size.trim().toLowerCase();
                        if (!val) return;
                        const dup = variants.some((v, i) => i !== vi && v.size.trim().toLowerCase() === val);
                        if (dup) {
                          toast.error(`Size "${variant.size.trim()}" đã tồn tại`);
                          setVariants((curr) => curr.map((v, i) => i === vi ? { ...v, size: "" } : v));
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-600">Giá (VND)</p>
                    <Input type="number" value={variant.price} onChange={setVariantField(vi, "price")} />
                    {form.discountPercent > 0 && Number(variant.price) > 0 && (
                      <p className="text-xs text-red-500 font-medium">
                        → {formatVND(Math.round(Number(variant.price) * (100 - form.discountPercent) / 100))}
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-red-400 hover:text-red-600"
                    onClick={() => setVariants((curr) =>
                      curr.length === 1 ? [emptyVariant()] : curr.filter((_, i) => i !== vi)
                    )}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Màu */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Màu sắc</p>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => {
                        const existing = variant.colors.map((c) => c.color.trim().toLowerCase()).filter(Boolean);
                        addColor(vi);
                        // just adds empty slot; duplicate check is on blur/submit
                      }}>
                      <Plus className="w-4 h-4 mr-1" />Thêm màu
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {variant.colors.map((color, ci) => (
                      <div key={color.localId} className="rounded-lg border bg-white p-3">
                        <div className="grid grid-cols-[1.5fr_0.8fr_1.2fr_auto] gap-3 items-end">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">Tên màu</p>
                            <Input
                              value={color.color}
                              onChange={setColorField(vi, ci, "color")}
                              onBlur={() => {
                                const name = color.color.trim().toLowerCase();
                                if (!name) return;
                                const dup = variant.colors.some((c, j) => j !== ci && c.color.trim().toLowerCase() === name);
                                if (dup) {
                                  toast.error(`Màu "${color.color}" đã tồn tại trong size này`);
                                  setVariants((curr) => curr.map((v, i) =>
                                    i !== vi ? v : {
                                      ...v,
                                      colors: v.colors.map((c, j) => j === ci ? { ...c, color: "" } : c),
                                    }
                                  ));
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">Tồn kho</p>
                            <Input type="number" value={color.stockQuantity}
                              onChange={setColorField(vi, ci, "stockQuantity")} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">Ảnh màu</p>
                            {(() => {
                              const sharedImageUrl = color.imageUrl || findSharedColorImage(color.color, variant.localId, color.localId);
                              return sharedImageUrl ? (
                              <div className="relative h-16 rounded-lg overflow-hidden border group">
                                <Image src={sharedImageUrl} alt={color.color || "color"} fill className="object-cover" />
                                <button type="button"
                                  onClick={() => clearColorImageByName(color.color)}
                                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100">
                                  <X className="w-3 h-3" />
                                </button>
                                {color.imageUrl ? null : (
                                  <div className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                                    Ảnh dùng chung
                                  </div>
                                )}
                              </div>
                              ) : (
                              <label className="flex h-16 cursor-pointer items-center justify-center rounded-lg border border-dashed text-xs text-gray-400 hover:bg-gray-50">
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={(e) => { void uploadColorImage(vi, ci, e.target.files?.[0]); e.currentTarget.value = ""; }} />
                                <Upload className="w-4 h-4 mr-1" />Upload
                              </label>
                              );
                            })()}
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-red-400"
                            onClick={() => removeColor(vi, ci)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="min-w-32">
            {saving ? "Đang lưu..." : isNew ? "Tạo sản phẩm" : "Lưu thay đổi"}
          </Button>
          <Link href="/admin/products">
            <Button type="button" variant="outline">Hủy</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
