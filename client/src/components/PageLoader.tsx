/** Full-screen loader shown during initial auth bootstrap */

export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <div className="loader-ring" />
        <p className="text-sm text-text-muted font-mono">Loading VML…</p>
      </div>
    </div>
  );
}
