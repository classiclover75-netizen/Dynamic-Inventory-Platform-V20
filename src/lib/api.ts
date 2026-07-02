export async function savePageConfig(pageName: string, config: any) {
  return fetch(`/api/pageConfigs/${encodeURIComponent(pageName)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}
