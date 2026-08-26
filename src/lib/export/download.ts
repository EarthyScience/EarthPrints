/** Hand a blob to the browser as a file download, then release the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking synchronously can cancel the download in some browsers, so let the
  // click settle first.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
