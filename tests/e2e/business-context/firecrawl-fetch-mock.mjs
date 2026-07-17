const originalFetch = globalThis.fetch;

// In-memory counter for fail-once mode (tracks state within this process).
let firecrawlScrapeCount = 0;

const SUCCESSFUL_FIXTURE = {
  success: true,
  creditsUsed: 1,
  data: {
    pages: [
      {
        url: "https://example.com/",
        markdown: "# Lorem\nIpsum dolor sit amet consectetur",
        statusCode: 200,
        title: "Lorem",
      },
      {
        url: "https://example.com/two",
        markdown: "# Amet\nConsectetur adipiscing elit sed",
        statusCode: 200,
        title: "Amet",
      },
    ],
  },
};

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (url === "https://example.com/robots.txt") {
    return new Response("User-agent: *\nAllow: /\n", { status: 200 });
  }

  if (url === "https://example.com/") {
    return new Response("", { status: 200 });
  }

  if (url === "https://api.firecrawl.dev/v1/scrape") {
    const mode = process.env.FIRECRAWL_E2E_MODE;

    if (mode === "fail-once") {
      firecrawlScrapeCount++;
      if (firecrawlScrapeCount === 1) {
        // First scrape: deterministic provider failure (5xx).
        return Response.json(
          {
            success: false,
            creditsUsed: 0,
            error: "Internal server error: provider temporarily unavailable",
          },
          { status: 500 },
        );
      }
    }

    if (mode === "slow") {
      // First scrape: delay long enough for outer job to be observable in
      // `running` state. Worker is blocked on this fetch; test can observe
      // running, kill the worker, then let replacement pick up the stall.
      firecrawlScrapeCount++;
      if (firecrawlScrapeCount === 1) {
        await new Promise((r) => setTimeout(r, 30_000));
        return Response.json(SUCCESSFUL_FIXTURE);
      }
    }

    // Default / subsequent scrapes: return successful fixture.
    return Response.json(SUCCESSFUL_FIXTURE);
  }

  return originalFetch(input, init);
};
