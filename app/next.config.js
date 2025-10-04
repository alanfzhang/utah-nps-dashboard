/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Let production builds succeed even with ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
