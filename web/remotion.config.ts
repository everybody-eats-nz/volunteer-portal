import { Config } from "@remotion/cli/config";

// Performance settings
Config.setConcurrency(1); // Conservative for server rendering

// Encoding settings
Config.setCodec("h264"); // Wide compatibility
Config.setVideoImageFormat("jpeg");
Config.setPixelFormat("yuv420p"); // Maximum compatibility
Config.setCrf(18); // High quality (lower = better quality, 18 is visually lossless)
