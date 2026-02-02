# PostHog post-wizard report

The wizard has completed a deep integration of your portfolio site with PostHog analytics. The integration includes both client-side event tracking for user interactions (chat, JD analysis, link clicks, theme changes) and server-side tracking for API requests. Error tracking and exception capture have been enabled to monitor system health. The PostHog provider has been configured with the latest defaults (`2025-11-30`) for optimal pageview and session tracking.

## Events Summary

| Event Name | Description | File |
|------------|-------------|------|
| `chat_modal_opened` | User clicked 'Ask AI' button to open the chat modal | `app/page.tsx` |
| `chat_modal_closed` | User closed the chat modal | `app/page.tsx` |
| `chat_message_sent` | User sent a message in the AI chat | `components/Chat.tsx` |
| `chat_suggested_question_clicked` | User clicked a suggested question | `components/Chat.tsx` |
| `chat_response_received` | AI chat response successfully received | `components/Chat.tsx` |
| `chat_error` | Chat request failed with an error | `components/Chat.tsx` |
| `chat_cleared` | User cleared the chat history | `components/Chat.tsx` |
| `jd_analysis_started` | User submitted a job description for analysis | `components/JDAnalyzer.tsx` |
| `jd_analysis_completed` | Job description analysis completed successfully | `components/JDAnalyzer.tsx` |
| `jd_analysis_error` | Job description analysis failed | `components/JDAnalyzer.tsx` |
| `external_link_clicked` | User clicked external link (LinkedIn, X, Substack, GitHub) | `app/page.tsx` |
| `company_link_clicked` | User clicked a company link in timeline | `components/Timeline.tsx` |
| `activity_sidebar_toggled` | User toggled the activity stream sidebar | `app/page.tsx` |
| `theme_changed` | User changed the site theme (dark/light) | `components/ActivityStream.tsx` |
| `api_chat_request` | Server-side: Chat API endpoint received request | `app/api/chat/route.ts` |
| `api_chat_error` | Server-side: Chat API endpoint error | `app/api/chat/route.ts` |

## Files Modified

- `app/providers.tsx` - Updated PostHog init with `defaults`, `capture_exceptions`, and `debug` options
- `app/page.tsx` - Added tracking for chat modal, external links, sidebar toggle
- `app/api/chat/route.ts` - Added server-side event tracking
- `components/Chat.tsx` - Added comprehensive chat interaction tracking
- `components/JDAnalyzer.tsx` - Added JD analysis funnel tracking
- `components/Timeline.tsx` - Added company link click tracking
- `components/ActivityStream.tsx` - Added theme change tracking
- `lib/posthog-server.ts` - Created server-side PostHog client (new file)
- `.env.local` - Added PostHog environment variables

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/261605/dashboard/1191958) - Your main analytics dashboard

### Insights
- [Chat Engagement Funnel](https://us.posthog.com/project/261605/insights/E3MqG9OJ) - Tracks user journey from opening chat to receiving responses
- [JD Analysis Conversion](https://us.posthog.com/project/261605/insights/A78pErhA) - Tracks job description analysis completion rate
- [External Link Engagement](https://us.posthog.com/project/261605/insights/iXZApoJf) - Shows which external links (LinkedIn, X, etc.) get clicked most
- [Error Rate Monitoring](https://us.posthog.com/project/261605/insights/C8m6zXOe) - Monitors chat and JD analysis errors
- [User Activity Overview](https://us.posthog.com/project/261605/insights/K4aGVCqc) - Overview of all key user interactions

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
