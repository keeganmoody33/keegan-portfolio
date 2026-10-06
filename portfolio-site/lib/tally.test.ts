/**
 * Request tally tests — Node built-in test runner.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/tally.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyUserAgent, isCountablePageRequest, toSnapshot } from './tally.ts'

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

describe('classifyUserAgent', () => {
  const cases: Array<[string, string]> = [
    [CHROME, 'presumed_human'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'presumed_human'],
    ['', 'undeclared'],
    ['-', 'undeclared'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'ai_training_crawler'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'ai_training_crawler'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot', 'ai_assistant_fetch'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)', 'ai_assistant_fetch'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot', 'ai_search_indexer'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', 'ai_search_indexer'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'search_engine_crawler'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36', 'search_engine_crawler'],
    ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'seo_crawler'],
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'link_preview'],
    ['Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'link_preview'],
    ['Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)', 'monitoring'],
    ['curl/8.7.1', 'unattributed_automation'],
    ['python-requests/2.32.3', 'unattributed_automation'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36', 'unattributed_automation'],
    ['SomeNewCrawler/0.1', 'unattributed_automation'],
  ]
  for (const [ua, expected] of cases) {
    it(`${expected}: ${ua.slice(0, 60) || '(empty)'}`, () => {
      assert.equal(classifyUserAgent(ua), expected)
    })
  }
  it('treats a missing header as undeclared', () => {
    assert.equal(classifyUserAgent(null), 'undeclared')
  })
})

describe('isCountablePageRequest', () => {
  const headers = (h: Record<string, string> = {}) => ({ get: (name: string) => h[name.toLowerCase()] ?? null })
  it('counts a plain page GET', () => assert.equal(isCountablePageRequest('GET', '/catalog', headers()), true))
  it('skips non-GET', () => assert.equal(isCountablePageRequest('POST', '/catalog', headers()), false))
  it('skips API routes', () => assert.equal(isCountablePageRequest('GET', '/api/tally', headers()), false))
  it('skips well-known discovery paths', () => assert.equal(isCountablePageRequest('GET', '/.well-known/security.txt', headers()), false))
  it('skips prefetches', () => assert.equal(isCountablePageRequest('GET', '/catalog', headers({ 'next-router-prefetch': '1' })), false))
  it('skips speculative loads', () => assert.equal(isCountablePageRequest('GET', '/catalog', headers({ 'sec-purpose': 'prefetch;prerender' })), false))
  it('skips client data fetches', () => assert.equal(isCountablePageRequest('GET', '/catalog', headers({ rsc: '1' })), false))
})

describe('toSnapshot', () => {
  it('sums automated categories and ignores junk', () => {
    const snap = toSnapshot({ presumed_human: '10', ai_training_crawler: 3, undeclared: '2', junk: 99, monitoring: 'x' }, '2026-10-06T07:00:00.000Z')
    assert.equal(snap.presumedHuman, 10)
    assert.equal(snap.automated, 5)
    assert.equal(snap.byCategory.monitoring, 0)
    assert.equal(snap.since, '2026-10-06T07:00:00.000Z')
  })
  it('returns zeros for an empty store', () => {
    const snap = toSnapshot(null, null)
    assert.equal(snap.presumedHuman + snap.automated, 0)
  })
})
