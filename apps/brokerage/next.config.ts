import { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Don't write an AGENTS.md into the app on `next dev`.
  agentRules: false,
  // The dev badge overlaps content inside small dashboard iframes.
  devIndicators: false,
};

export default config;
