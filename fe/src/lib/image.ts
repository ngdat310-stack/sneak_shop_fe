const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";

const resolveAgainstApi = (path: string) => {
  if (!apiBaseUrl) return path;
  try {
    return new URL(path, apiBaseUrl).toString();
  } catch {
    return path;
  }
};

export const toFrontendImageUrl = (url: string | null | undefined) => {
  if (!url) return "";

  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/images/")) {
      return resolveAgainstApi(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
    return trimmed;
  } catch {
    if (trimmed.startsWith("/images/")) {
      return resolveAgainstApi(trimmed);
    }
    return trimmed;
  }
};
