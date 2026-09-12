# Vercel blank-page fix

Production returned `index.html` successfully, but the frontend could fail before React mounted when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` were absent from the Vercel build environment. `src/lib/supabase.ts` still called `createClient('', '')`, which can throw during module initialization and leave only the empty `<div id="root"></div>` visible.

The fix makes the browser boot fail-soft: a syntactically valid inert Supabase endpoint/key is used only when the public Supabase variables are missing, while a warning is emitted. This does **not** enable Supabase or bypass authentication; data/auth features remain unavailable until the real Vercel environment variables are configured.
