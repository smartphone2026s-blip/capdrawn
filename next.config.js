/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['cloudinary', 'bcryptjs', 'jsonwebtoken', 'formidable'],
  images: {
    domains: ['res.cloudinary.com'],
  },
}

module.exports = nextConfig
