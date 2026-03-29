import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@beyond/design-system", "reveal.js"],
  serverExternalPackages: ["canvas"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
