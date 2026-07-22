/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a builtin; keep it external so the bundler doesn't try to inline it.
  // node-tikzjax loads its WASM TeX engine + texlive dump from its own package
  // directory at runtime — bundling would break those file paths.
  serverExternalPackages: ["node:sqlite", "node-tikzjax"],
  // Better tree-shaking / per-route chunking for libs we only use a slice of.
  experimental: {
    optimizePackageImports: ["react-markdown", "cytoscape"],
  },
};

export default nextConfig;
