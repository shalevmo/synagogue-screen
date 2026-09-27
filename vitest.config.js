import { defineConfig } from 'vitest/config';

// Every test anchors wall-clock times in Israel (new Date(y, m, d, h) means
// Netivot local time). Set it here, before workers start, so they inherit it
// regardless of the machine's zone (CI runs UTC).
process.env.TZ = 'Asia/Jerusalem';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // The golden year sweep takes a few seconds on a slow runner.
    testTimeout: 60_000,
  },
});
