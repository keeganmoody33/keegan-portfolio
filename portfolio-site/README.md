# Keegan Moody Portfolio Site

AI-queryable portfolio site powered by Next.js and Supabase.

## Prerequisites

Before running this site, you need:
1. Supabase project with tables created (see `../supabase/DEPLOYMENT.md`)
2. Data loaded into Supabase tables
3. Edge function deployed

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

3. **Run development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Project Structure

```
portfolio-site/
├── app/
│   ├── page.tsx          # Landing page with chat
│   ├── layout.tsx        # Root layout
│   ├── globals.css       # Global styles
│   └── api/chat/route.ts # API route → Supabase edge function
├── components/
│   └── Chat.tsx          # Chat interface component
├── lib/
│   └── supabase.ts       # Supabase client
└── package.json
```

## How It Works

1. User types a question in the chat interface
2. Question sent to `/api/chat` (Next.js API route)
3. API route calls Supabase Edge Function (`/functions/v1/chat`)
4. Edge function:
   - Fetches portfolio data from Supabase tables
   - Builds context from experiences, skills, achievements
   - Calls Claude API with context + question + AI instructions
   - Returns response
5. Chat interface displays the answer

## Test Questions

- "What did Keegan do at Mixmax?"
- "Has Keegan ever been fired?"
- "What are Keegan's top skills?"
- "What's Keegan's ideal work environment?"
- "Tell me about the Orlando Health deal"
