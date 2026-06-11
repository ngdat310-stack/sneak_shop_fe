"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Minus, Plus, ShoppingBag, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { productsApi } from "@/lib/api/products";
import { cartApi } from "@/lib/api/cart";
import { reviewsApi } from "@/lib/api/reviews";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { formatRating, formatVND, formatDate } from "@/lib/format";
import type { Product, Review } from "@/lib/types";

type MediaAsset = {
  url: string;
  type: "image" | "video";
};

const inferMediaTypeFromUrl = (url: string): "image" | "video" => {
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(clean)) return "video";
  return "image";
};

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const { setItems } = useCartStore();
  const { user } = useAuthStore();

  const normalizeColor = (value: string) => value.trim().toLowerCase();
  const resolveColorImage = (
    product: Product | null,
    colorName: string,
    currentVariantId?: number,
    currentColorId?: number
  ) => {
    if (!product) return null;
    const key = normalizeColor(colorName);
    if (!key) return null;

    const currentVariant = product.variants.find((variant) => variant.id === currentVariantId);
    const currentColor = currentVariant?.colors.find((color) => color.id === currentColorId);
    if (currentColor?.imageUrl) return currentColor.imageUrl;

    for (const variant of product.variants) {
      for (const color of variant.colors) {
        if (variant.id === currentVariantId && color.id === currentColorId) continue;
        if (normalizeColor(color.color) === key && color.imageUrl) {
          return color.imageUrl;
        }
      }
    }

    return currentColor?.imageUrl ?? null;
  };

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      productsApi.getBySlug(slug),
      reviewsApi.getByProduct(0, { page: 0, size: 10 }),
    ]).then(([pRes]) => {
      const p = pRes.data.result;
      setProduct(p);
      const firstMedia = p.media?.[0];
      setSelectedMedia(
        p.coverImageUrl
          ? { url: p.coverImageUrl, type: "image" }
          : firstMedia
            ? {
                url: firstMedia.imageUrl,
                type: firstMedia.type === "video" ? "video" : inferMediaTypeFromUrl(firstMedia.imageUrl),
              }
            : null
      );
    }).catch(() => {}).finally(() => setLoading(false));

    // Load reviews separately with product id (need id first)
    productsApi.getBySlug(slug).then((r) => {
      const p = r.data.result;
      return reviewsApi.getByProduct(p.id, { page: 0, size: 10 });
    }).then((r) => setReviews(r.data.result.content)).catch(() => {});
  }, [slug]);

  const selectedVariant = product?.variants.find((v) => v.id === selectedVariantId);
  const selectedColor = selectedVariant?.colors.find((c) => c.id === selectedColorId);
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const discountedPrice =
    product && product.discountPercent > 0
      ? price * (1 - product.discountPercent / 100)
      : null;

  const colorOptions = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, {
      key: string;
      color: string;
      imageUrl: string | null;
      stockQuantity: number;
      variantId: number;
      colorId: number;
    }>();

    product.variants.forEach((variant) => {
      variant.colors.forEach((color) => {
        const key = normalizeColor(color.color);
        if (!key) return;
        const existing = map.get(key);
        const nextStock = (existing?.stockQuantity ?? 0) + (color.stockQuantity ?? 0);
        if (!existing) {
          map.set(key, {
            key,
            color: color.color,
            imageUrl: color.imageUrl ?? null,
            stockQuantity: color.stockQuantity ?? 0,
            variantId: variant.id,
            colorId: color.id,
          });
          return;
        }
        map.set(key, {
          ...existing,
          stockQuantity: nextStock,
          imageUrl: existing.imageUrl ?? color.imageUrl ?? null,
        });
      });
    });

    return Array.from(map.values());
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const firstSizeWithColor = product.variants.find((variant) => variant.colors.length > 0);
    if (!firstSizeWithColor) return;

    if (!selectedVariantId || !product.variants.some((variant) => variant.id === selectedVariantId && variant.colors.length > 0)) {
      const firstColor = firstSizeWithColor.colors[0];
      setSelectedVariantId(firstSizeWithColor.id);
      setSelectedColorId(firstColor?.id ?? null);
      const imageUrl = firstColor
        ? resolveColorImage(product, firstColor.color, firstSizeWithColor.id, firstColor.id)
        : null;
      if (imageUrl) setSelectedMedia({ url: imageUrl, type: "image" });
    }
  }, [product, selectedVariantId]);

  useEffect(() => {
    if (!selectedVariant) {
      setSelectedColorId(null);
      return;
    }
    const activeColor = selectedVariant.colors.find((color) => color.id === selectedColorId);
    if (activeColor) return;
    const nextColor = selectedVariant.colors.find((color) => color.stockQuantity > 0) ?? selectedVariant.colors[0];
    setSelectedColorId(nextColor?.id ?? null);
    const imageUrl = nextColor
      ? resolveColorImage(product, nextColor.color, selectedVariant.id, nextColor.id)
      : null;
    if (imageUrl) setSelectedMedia({ url: imageUrl, type: "image" });
  }, [selectedVariant, selectedColorId]);

  const copyProductUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Đã sao chép liên kết sản phẩm");
  };

  const handleAddToCart = async () => {
    if (!product) return;
    if (!user) { toast.error("Vui lòng đăng nhập để thêm vào giỏ"); return; }
    if (product.variants.length > 0 && !selectedVariantId) {
      toast.error("Vui lòng chọn size"); return;
    }
    setAdding(true);
    try {
      await cartApi.addOrUpdate({
        productId: product.id,
        variantId: selectedVariantId ?? undefined,
        colorId: selectedColorId ?? undefined,
        quantity,
      });
      const cartRes = await cartApi.getCart();
      setItems(cartRes.data.result);
      toast.success("Đã thêm vào giỏ hàng!");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (!user) { toast.error("Vui lòng đăng nhập để mua hàng"); return; }
    if (product.variants.length > 0 && !selectedVariantId) {
      toast.error("Vui lòng chọn size"); return;
    }
    if (selectedVariant && selectedVariant.colors.length > 0 && !selectedColorId) {
      toast.error("Vui lòng chọn màu"); return;
    }
    const fallbackImage =
      product.media?.find((item) => item.type !== "video")?.imageUrl ??
      product.coverImageUrl ??
      null;
    const buyNowImage =
      selectedMedia?.type === "image" ? selectedMedia.url : fallbackImage;

    const buyNowItem = {
      productId: product.id,
      variantId: selectedVariantId ?? undefined,
      colorId: selectedColorId ?? undefined,
      quantity,
      productName: product.name,
      variantName: selectedVariant?.size ? `Size ${selectedVariant.size}` : null,
      colorName: selectedColor?.color ?? null,
      productImage: buyNowImage,
      unitPrice: discountedPrice ?? price,
    };

    try {
      setBuying(true);
      sessionStorage.setItem("sneakshop_buy_now_items", JSON.stringify([buyNowItem]));
      window.location.href = "/checkout";
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
        <Skeleton className="aspect-square rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!product) return <div className="text-center py-20 text-gray-400">Không tìm thấy sản phẩm</div>;

  const mediaItems = product.media ?? product.images ?? [];
  const colorImages = (product.variants ?? [])
    .flatMap((variant) => (variant.colors ?? []).map((color) => color.imageUrl))
    .filter((url): url is string => Boolean(url));
  const imageItems: MediaAsset[] = [
    ...(product.coverImageUrl ? [{ url: product.coverImageUrl, type: "image" as const }] : []),
    ...mediaItems
      .filter((item) => Boolean(item.imageUrl))
      .map((item) => ({
        url: item.imageUrl,
        type: item.type === "video" ? "video" : inferMediaTypeFromUrl(item.imageUrl),
      })),
    ...colorImages.map((url) => ({ url, type: "image" as const })),
  ].filter((item, index, arr) => arr.findIndex((x) => x.url === item.url) === index);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid md:grid-cols-2 gap-10">
        {/* Images */}
        <div>
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 mb-3">
            {selectedMedia ? (
              selectedMedia.type === "video" ? (
                <video
                  src={selectedMedia.url}
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  autoPlay
                  muted
                />
              ) : (
                <Image src={selectedMedia.url} alt={product.name} fill className="object-cover" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">👟</div>
            )}
          </div>
          {imageItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imageItems.map((asset, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedMedia(asset)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${
                    selectedMedia?.url === asset.url ? "border-black" : "border-transparent"
                  }`}
                >
                  {asset.type === "video" ? (
                    <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <Image src={asset.url} alt="" fill className="object-cover" />
                  )}
                  {asset.type === "video" && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">Video</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <div className="relative flex-shrink-0">
              <button
                onClick={() => void copyProductUrl()}
                className="p-2 rounded-full border hover:bg-gray-50 transition text-gray-500"
                title="Chia sẻ liên kết"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.ratingAverage) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
              ))}
            </div>
            <span className="text-sm text-gray-500">
              {formatRating(product.ratingAverage)} ({product.reviewCount})
            </span>
            <span className="text-sm text-gray-400">
              Đã bán: {product.soldCount ?? 0}
            </span>
          </div>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-black text-black">
              {formatVND(discountedPrice ?? price)}
            </span>
            {discountedPrice && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatVND(price)}</span>
                <Badge className="bg-red-500 text-white">-{product.discountPercent}%</Badge>
              </>
            )}
          </div>

          {/* Size selection */}
          {product.variants.length > 0 && (
            <div className="mb-4">
              <p className="font-medium text-sm mb-2">Kích cỡ</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    disabled={v.colors.length === 0}
                    onClick={() => {
                      if (v.colors.length === 0) return;
                      const nextColor = v.colors.find((c) => c.stockQuantity > 0) ?? v.colors[0];
                      setSelectedVariantId(v.id);
                      setSelectedColorId(nextColor?.id ?? null);
                      const imageUrl = nextColor
                        ? resolveColorImage(product, nextColor.color, v.id, nextColor.id)
                        : null;
                      if (imageUrl) setSelectedMedia({ url: imageUrl, type: "image" });
                    }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                      selectedVariantId === v.id
                        ? "border-black bg-black text-white"
                        : "border-gray-200 hover:border-gray-400"
                    } ${v.colors.length === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color selection */}
          {colorOptions.length > 0 && (
            <div className="mb-4">
              <p className="font-medium text-sm mb-2">Màu sắc</p>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((c) => {
                  const activeColor = selectedVariant?.colors.find(
                    (color) => normalizeColor(color.color) === c.key
                  ) ?? null;
                  const available = Boolean(activeColor);
                  const disabled = !activeColor || (activeColor.stockQuantity ?? 0) === 0;
                  const selected = activeColor?.id === selectedColorId;
                  return (
                    <button
                      key={c.key}
                      onClick={() => {
                        if (!activeColor || disabled || !selectedVariant) return;
                        setSelectedColorId(activeColor.id);
                        const imageUrl = resolveColorImage(product, activeColor.color, selectedVariant.id, activeColor.id);
                        if (imageUrl) setSelectedMedia({ url: imageUrl, type: "image" });
                      }}
                      disabled={disabled}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                        selected
                          ? "border-black bg-black text-white"
                          : disabled
                            ? "border-dashed border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "border-gray-200 hover:border-gray-400 bg-white text-gray-800"
                      }`}
                    >
                      {c.color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <p className="font-medium text-sm mb-2">Số lượng</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <Button variant="outline" size="icon" onClick={() => setQuantity((q) => q + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-12 text-base font-bold gap-2"
              onClick={handleAddToCart}
              variant="outline"
              disabled={adding || buying}
            >
              <ShoppingBag className="w-5 h-5" />
              {adding ? "Đang thêm..." : "Thêm vào giỏ hàng"}
            </Button>
            <Button
              className="h-12 text-base font-bold"
              onClick={handleBuyNow}
              disabled={adding || buying}
            >
              {buying ? "Đang chuyển..." : "Mua ngay"}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-12 w-full text-base font-bold gap-2"
            onClick={() => void copyProductUrl()}
          >
            <Share2 className="w-5 h-5" />
            Sao chép liên kết
          </Button>
          {product.description && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Mô tả sản phẩm</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {product.sizeGuideNote && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 prose prose-sm max-w-none">
              <p className="font-medium mb-2 text-gray-900">📏 Hướng dẫn chọn size</p>
              <ReactMarkdown>{product.sizeGuideNote}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-14">
        <h2 className="text-xl font-bold mb-6">Đánh giá ({product.reviewCount})</h2>
        {reviews.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Chưa có đánh giá nào</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                    {r.userName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{r.userName}</p>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                  </div>
                  <span className="ml-auto text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                {r.shopReply && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm">
                    <span className="font-medium text-gray-700">Phản hồi shop: </span>
                    <span className="text-gray-600">{r.shopReply}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
