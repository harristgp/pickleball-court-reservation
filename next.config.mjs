/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Receipt screenshots are capped at 5MB by the storage layer; leave headroom
      // for the multipart envelope so a valid upload is never rejected by Next.
      bodySizeLimit: '8mb',
    },
  },
  images: {
    remotePatterns: [
      // STORAGE_DRIVER=uploadthing
      { protocol: 'https', hostname: '**.ufs.sh' },
      { protocol: 'https', hostname: 'utfs.io' },
      // STORAGE_DRIVER=supabase
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
