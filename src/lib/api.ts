export async function savePageConfig(pageName: string, config: any) {
  return fetch(`/api/pageConfigs/${encodeURIComponent(pageName)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
}
export async function patchRow(pageName: string, rowId: any, updates: any, force = false) {
  return fetch(`/api/pageRows/${encodeURIComponent(pageName)}/${encodeURIComponent(rowId)}${force ? "?force=true" : ""}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
}
export async function deleteRow(pageName: string, rowId: any) {
  return fetch(`/api/pageRows/${encodeURIComponent(pageName)}/${encodeURIComponent(rowId)}`, {
    method: "DELETE",
  });
}
export async function putRows(pageName: string, rows: any[], skipImageProcessing = false) {
  return fetch(`/api/pageRows/${encodeURIComponent(pageName)}${skipImageProcessing ? "?skipImageProcessing=true" : ""}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
}
export async function appendPageRows(pageName: string, rows: any[], force = false, skipImageProcessing = false) {
  const q = new URLSearchParams(); if(force) q.set("force", "true"); if(skipImageProcessing) q.set("skipImageProcessing", "true"); const qs = q.toString() ? "?" + q.toString() : ""; return fetch(`/api/pageRows/${encodeURIComponent(pageName)}/append${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
}
export async function bulkPatchRows(pageName: string, body: any, skipImageProcessing = false) {
  const q = new URLSearchParams(); if(skipImageProcessing) q.set("skipImageProcessing", "true"); const qs = q.toString() ? "?" + q.toString() : ""; return fetch(`/api/pageRows/${encodeURIComponent(pageName)}/bulk${qs}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
