// Remotion CLI config for the volunteer "Year in mahi" video
// (npm run video:studio / video:render). Not used by Next.js.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/remotion/index.ts");
// Clear of the Next.js dev servers on 3000 and 3100.
Config.setStudioPort(3200);
// Instagram-friendly output: H.264 MP4 with broadly compatible pixel format.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
// Music and sound effects only: 128k AAC is plenty, and keeps the MP4 small.
Config.setAudioBitrate("128k");
