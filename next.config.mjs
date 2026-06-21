/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a builtin; keep it external so the bundler doesn't try to inline it.
  serverExternalPackages: ["node:sqlite"],
  // Better tree-shaking / per-route chunking for libs we only use a slice of.
  experimental: {
    optimizePackageImports: ["react-markdown", "cytoscape"],
  },
};

export default nextConfig;
