/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Every route in this app is a client-rendered dashboard backed by
  // localStorage, so there is nothing server-side for Vercel to configure.
  // The default output target deploys as-is.
};

export default nextConfig;
