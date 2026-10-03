// Lets the app import the plain TypeScript helpers in ../../packages/shared
// (business hours, floor-plan markers, table geometry) as @seatmate/shared/*.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, "../../packages/shared");

config.watchFolders = [sharedRoot];
config.resolver.extraNodeModules = {
  "@seatmate/shared": sharedRoot,
};

module.exports = config;
