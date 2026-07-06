import type { ReactNode } from "react";

type EditorShellProps = {
  header: ReactNode;
  sidebar: ReactNode;
  preview: ReactNode;
};

export function EditorShell({ header, sidebar, preview }: EditorShellProps) {
  return (
    <div className="editor-shell flex h-dvh flex-col bg-editor-bg-base text-editor-fg-primary [--editor-sidebar-width:min(400px,36vw)]">
      <header className="relative z-[100] flex-shrink-0 overflow-visible bg-editor-bg-base">
        {header}
      </header>
      <div className="flex min-h-0 flex-1 max-[900px]:flex-col">
        <aside
          className="flex w-[var(--editor-sidebar-width)] flex-shrink-0 flex-col gap-3 overflow-y-auto bg-editor-bg-base p-4 max-[900px]:max-h-[42vh] max-[900px]:w-full max-[900px]:border-b max-[900px]:border-editor-border"
          aria-label="Map controls"
        >
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 bg-editor-bg-base pb-2 pr-2 max-[900px]:pl-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-editor-lg border border-editor-border bg-editor-bg-primary">
            <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-[inherit]">
              {preview}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
