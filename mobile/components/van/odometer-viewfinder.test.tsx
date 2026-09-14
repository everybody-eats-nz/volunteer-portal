import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";

import { OdometerViewfinder } from "@/components/van/odometer-viewfinder";
import { render } from "@/test-utils/render";

type CameraProps = {
  pictureSize?: string;
  onCameraReady?: () => void;
  onMountError?: (event: { message: string }) => void;
};

// A camera the test can make ready, fail to start, or fail a shot.
const camera = vi.hoisted(() => ({
  props: undefined as CameraProps | undefined,
  permission: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null,
  requestPermission: vi.fn(),
  takePictureAsync: vi.fn(),
  getAvailablePictureSizesAsync: vi.fn(),
}));

vi.mock("expo-camera", async () => {
  const React = await import("react");
  const CameraView = React.forwardRef<unknown, CameraProps>((props, ref) => {
    camera.props = props;
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: camera.takePictureAsync,
      getAvailablePictureSizesAsync: camera.getAvailablePictureSizesAsync,
    }));
    return null;
  });
  CameraView.displayName = "CameraView";
  return {
    CameraView,
    useCameraPermissions: () => [camera.permission, camera.requestPermission],
  };
});
vi.mock("react-native", () => import("@/test-utils/react-native"));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

function renderViewfinder() {
  const onCapture = vi.fn();
  const onUnavailable = vi.fn();
  const tree = render(
    <OdometerViewfinder onCapture={onCapture} onUnavailable={onUnavailable} />
  );
  return { tree, onCapture, onUnavailable };
}

const shutter = (tree: ReturnType<typeof render>) =>
  tree.root.findAllByType(Pressable).find((node) => node.props.testID === "odometer-shutter")!;
const caption = (tree: ReturnType<typeof render>) =>
  tree.root.findAllByType(Text).map((node) => node.props.children).join(" ");

describe("OdometerViewfinder", () => {
  beforeEach(() => {
    camera.props = undefined;
    camera.permission = { granted: true, canAskAgain: true };
    camera.getAvailablePictureSizesAsync.mockResolvedValue(["4000x3000", "2560x1920"]);
    camera.takePictureAsync.mockResolvedValue({
      uri: "file:///shot.jpg",
      width: 2560,
      height: 1920,
      format: "jpg",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("holds the shutter until the camera is ready, then caps the picture size", async () => {
    const { tree } = renderViewfinder();
    expect(shutter(tree).props.disabled).toBe(true);

    await act(async () => {
      camera.props!.onCameraReady!();
    });

    expect(shutter(tree).props.disabled).toBe(false);
    expect(camera.props!.pictureSize).toBe("2560x1920");
  });

  it("hands back the shot on one tap", async () => {
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await act(async () => {
      await shutter(tree).props.onPress();
    });

    expect(onCapture).toHaveBeenCalledWith({
      uri: "file:///shot.jpg",
      mimeType: "image/jpeg",
      fileName: "odometer.jpg",
    });
  });

  it("says so and lets the driver try again when a shot fails", async () => {
    camera.takePictureAsync.mockRejectedValueOnce(new Error("capture failed"));
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await act(async () => {
      await shutter(tree).props.onPress();
    });

    expect(onCapture).not.toHaveBeenCalled();
    expect(caption(tree)).toContain("That didn't take. Try again.");
    expect(shutter(tree).props.disabled).toBe(false);
  });

  it("reports a camera that will not start", () => {
    const { onUnavailable } = renderViewfinder();

    act(() => {
      camera.props!.onMountError!({ message: "Camera could not be started" });
    });

    expect(onUnavailable).toHaveBeenCalledWith("failed");
  });

  it("asks for access once, and reports a refusal", () => {
    camera.permission = { granted: false, canAskAgain: true };
    const { tree, onUnavailable } = renderViewfinder();

    expect(camera.requestPermission).toHaveBeenCalledTimes(1);
    expect(onUnavailable).not.toHaveBeenCalled();

    camera.permission = { granted: false, canAskAgain: false };
    act(() => {
      tree.update(
        <OdometerViewfinder onCapture={vi.fn()} onUnavailable={onUnavailable} />
      );
    });

    expect(camera.requestPermission).toHaveBeenCalledTimes(1);
    expect(onUnavailable).toHaveBeenCalledWith("denied");
  });
});
