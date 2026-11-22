# BrainBox

**BrainBox** is an AI-powered personal productivity and second-brain web app that unifies task management, structured notes, and an intelligent AI assistant in one cloud workspace.

**Live App:** [https://vercel.app](https://vercel.app)

---

## Features

- **Gemini AI Assistant:** Summarize notes, brainstorm ideas, and generate action items via server-side Google Gemini API routes.
- **My Tasks:** Create, prioritize, schedule, and track tasks in real time.
- **Knowledge Vault:** Organize categorized, tagged notes with instant search.
- **Cloud Auth & Sync:** Email/password authentication and private per-user PostgreSQL storage powered by Supabase Row-Level Security (RLS), with local storage fallback.

---

## Architecture & Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **AI Layer:** Next.js API Routes + Google Gemini API (`GEMINI_API_KEY`)
- **Database & Auth:** Supabase PostgreSQL (`tasks` & `notes` tables with RLS)
- **Hosting & CI/CD:** GitHub + Vercel

---

## Quick Setup

1. **Clone & Install:**
   ```bash
   git clone https://github.com && cd brainbox && npm install
   ```
2. **Add `.env.local`:**
   ```env
   GEMINI_API_KEY=your_gemini_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. **Run Locally:**
   ```bash
   npm run dev
   ```
