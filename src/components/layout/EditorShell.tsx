import type { ReactNode } from "react";

type EditorShellProps = {
  header: ReactNode;
  sidebar: ReactNode;
  preview: ReactNode;
};

export function EditorShell({ header, sidebar, preview }: EditorShellProps) {
  return (
    <div className="editor-shell">
      <header className="editor-header">{header}</header>
      <div className="editor-body">
        <aside className="editor-sidebar" aria-label="Map controls">
          {sidebar}
        </aside>
        <div className="editor-preview">
          <div className="editor-preview-frame">
            <div className="editor-preview-stage">{preview}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
