<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI/UX reference

Follow the Lovable design reference in every UX/UI detail when implementing this app's interface — spacing, color, motion, component behavior, and layout should match it precisely rather than approximating it.

Lovable reference files (exported/saved pages, e.g. "Remix of ... Lovable.html" and its `_files/` folder) are for local visual reference only. Never commit them to the repo — they are gitignored; keep them that way.

# Commit authorship

Commits are authored by the repo owner only. Do NOT add a `Co-Authored-By: Claude` (or any AI assistant) trailer to commit messages, and do not set the author/committer to an AI identity. Leave git's configured user as the sole author.
