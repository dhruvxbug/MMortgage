/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-contracts",
    "@mezo-org/orangekit-smart-account",
    "@mezo-org/passport",
  ],
  webpack: (config, { isServer }) => {
    // Handle extension aliases
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };

    // Fix for React Native modules in browser environment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // These are React Native modules that MetaMask SDK tries to import
        "@react-native-async-storage/async-storage": false,
        "react-native": false,
        "react-native-web": false,
        "pino-pretty": false,
        // Optional: add more if needed
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ignore warnings from these modules (optional)
    config.ignoreWarnings = [
      { module: /@react-native-async-storage/ },
      { module: /pino-pretty/ },
      { module: /react-native/ },
    ];

    return config;
  },
};

export default nextConfig;
