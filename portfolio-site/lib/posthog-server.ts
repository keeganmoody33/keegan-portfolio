import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

const noop = {
  capture: (_: unknown) => { },
};

export function getPostHogClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key.trim() === '') {
    return noop as PostHog;
  }
  if (!posthogClient) {
    const client = new PostHog(key, {
      // Server calls go straight to PostHog; the managed proxy is for browsers.
      host: 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0
    });
    // Label server-side events with the same site property the browser registers.
    const capture = client.capture.bind(client);
    client.capture = (message) =>
      capture({ ...message, properties: { site: 'lecturesfrom', ...message.properties } });
    posthogClient = client;
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
