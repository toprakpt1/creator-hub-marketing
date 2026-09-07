/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    /**
     * Both packages ship large barrel files. Without this, a single
     * `import { Users } from "lucide-react"` pulls the whole icon set into the
     * dev module graph, which is what made first-visit route compiles slow.
     */
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;
