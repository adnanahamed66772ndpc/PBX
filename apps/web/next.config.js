/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace packages from source so they can be imported
  // directly in the App Router bundle. Note: their package.json `exports`
  // resolve to `dist/*`, so build the packages first (`pnpm -r build`) before
  // `pnpm dev`/`pnpm build` if the dist artifacts are missing.
  transpilePackages: ['@pbx/common', '@pbx/db'],
  experimental: {
    typedRoutes: false,
  },
}

module.exports = nextConfig
