"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Banner } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toFrontendImageUrl } from "@/lib/image";

export default function HomeHeroCarousel({ banners }: { banners: Banner[] }) {
  const slides = useMemo(() => {
    return banners.slice(0, 3).map((banner) => ({
      id: banner.id,
      imageUrl: toFrontendImageUrl(banner.imageUrl),
    }));
  }, [banners]);

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const active = slides[current] ?? slides[0];

  if (!active) return null;

  const goTo = (next: number) => setCurrent((next + slides.length) % slides.length);

  return (
    <section className="relative w-full overflow-hidden bg-[#0b1f20] text-white">
      <div className="relative h-[60vh] min-h-[520px] w-full">
        <Image
          src={active.imageUrl}
          alt="Banner trang chủ"
          fill
          priority
          unoptimized
          className="object-cover"
          sizes="100vw"
        />

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,27,29,0.96)_0%,rgba(6,27,29,0.9)_34%,rgba(6,27,29,0.52)_62%,rgba(6,27,29,0.18)_100%)]" />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => goTo(current - 1)}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 border-white/30 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black"
          aria-label="Slide trước"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => goTo(current + 1)}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 border-white/30 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black"
          aria-label="Slide sau"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrent(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === current ? "w-8 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"
              }`}
              aria-label={`Chuyển đến slide ${index + 1}`}
            />
          ))}
          </div>
        )}
      </div>
    </section>
  );
}
