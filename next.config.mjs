/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a builtin; keep it external so the bundler doesn't try to inline it.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
