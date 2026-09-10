const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
export async function api(path, options = {}) {
  const r = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
