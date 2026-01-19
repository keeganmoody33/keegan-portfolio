# Supabase Deployment Guide

## Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Anthropic API key

## Step 1: Run Schema SQL

1. Go to Supabase Dashboard → SQL Editor
2. Open and run `sql/create_tables.sql`
3. Verify 5 tables created:
   - candidate_profiles
   - experiences
   - skills
   - achievements
   - ai_instructions

## Step 2: Load Data

1. In SQL Editor, open and run `sql/insert_data.sql`
2. Verify counts:
   - candidate_profiles: 1
   - experiences: 7
   - skills: 17
   - achievements: 8
   - ai_instructions: 1

## Step 3: Add Anthropic API Key

1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add secret: `ANTHROPIC_API_KEY` = your-api-key

Or via CLI:
```bash
supabase secrets set ANTHROPIC_API_KEY=your-api-key
```

## Step 4: Deploy Edge Function

```bash
cd /Users/keeganmoody/keegan-portfolio-content
supabase login
supabase link --project-ref cvkcwvmlnghwwvdqudod
supabase functions deploy chat
```

## Step 5: Test the Function

```bash
curl -X POST 'https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/chat' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"question": "What did Keegan do at Mixmax?"}'
```

## Function URL

After deployment:
```
https://cvkcwvmlnghwwvdqudod.supabase.co/functions/v1/chat
```

## Environment Variables Needed for Frontend

```
NEXT_PUBLIC_SUPABASE_URL=https://cvkcwvmlnghwwvdqudod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
