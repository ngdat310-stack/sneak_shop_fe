import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRating, formatVND } from "@/lib/format";
import type { Product } from "@/lib/types";

const inferMediaTypeFromUrl = (url: string): "image" | "video" => {
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(clean)) return "video";
  return "image";
};

export default function ProductCard({ product }: { product: Product }) {
  const discounted =
    product.discountPercent > 0
      ? product.price * (1 - product.discountPercent / 100)
      : null;
  const primaryMedia =
    product.media?.find((item) => item.imageUrl && item.type !== "video") ??
    product.media?.[0] ??
    null;
  const displayUrl =
    primaryMedia?.imageUrl ||
    product.coverImageUrl ||
    product.variants.flatMap((variant) => variant.colors.map((color) => color.imageUrl)).find(Boolean) ||
    null;
  const displayType =
    primaryMedia?.type === "video"
      ? "video"
      : displayUrl
        ? inferMediaTypeFromUrl(displayUrl)
        : "image";

  return (
    <Link href={`/products/${product.slug}`}>
      <div className="group rounded-xl border bg-white overflow-hidden hover:shadow-lg transition-all duration-200">
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {displayUrl ? (
            displayType === "video" ? (
              <video
                src={displayUrl}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <Image
                src={displayUrl}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
              👟
            </div>
          )}
          {displayType === "video" && (
            <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              Video
            </span>
          )}
          {product.discountPercent > 0 && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white">
              -{product.discountPercent}%
            </Badge>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-2 text-gray-900 mb-1">
            {product.name}
          </h3>
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-500">
              {formatRating(product.ratingAverage)} ({product.reviewCount})
            </span>
          </div>
          <p className="mb-2 text-[11px] text-gray-400">
            Đã bán: {product.soldCount ?? 0}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black text-sm">
              {formatVND(discounted ?? product.price)}
            </span>
            {discounted && (
              <span className="text-gray-400 text-xs line-through">
                {formatVND(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
