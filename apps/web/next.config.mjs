/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully client-rendered dashboard → static export. Deploys as plain static
  // files (no SSR runtime, no Next.js framework detection needed on Vercel).
  output: "export",
  images: { unoptimized: true },
  transpilePackages: [
    "confidia-config",
    "confidia-sdk",
    "confidia-ui",
  ],
};

export default nextConfig;
