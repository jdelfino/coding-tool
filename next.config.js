/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude data directory from file watching to prevent HMR during tests
  // Writing to data/*.json files should not trigger hot reload
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = config.watchOptions || {};
      config.watchOptions.ignored = config.watchOptions.ignored || [];
      
      // Add our ignored patterns
      const toIgnore = [
        '**/data/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
      ];
      
      if (Array.isArray(config.watchOptions.ignored)) {
        config.watchOptions.ignored.push(...toIgnore);
      } else {
        config.watchOptions.ignored = toIgnore;
      }
    }
    return config;
  },
}

module.exports = nextConfig
