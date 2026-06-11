export const toFrontendImageUrl = (url: string | null | undefined) => {
  if (!url) return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/images/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
};
