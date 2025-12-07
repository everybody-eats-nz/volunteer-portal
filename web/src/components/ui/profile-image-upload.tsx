"use client";

import React, { useState, useRef, useCallback } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Camera, Upload, X, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-image-crop/dist/ReactCrop.css";
import Image from "next/image";

interface ProfileImageUploadProps {
  currentImage?: string | null;
  onImageChange: (base64Image: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  fallbackText?: string;
  required?: boolean;
  toast?: (options: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}

// Helper function to create a crop centered and with aspect ratio 1:1
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

// Helper function to convert crop data to canvas and get base64
async function getCroppedImage(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation = 0,
  maxWidth = 300,
  quality = 0.75
): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  // Calculate the scale
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // For rotations of 90 or 270 degrees, we need to swap width/height
  const rotRad = (rotation * Math.PI) / 180;
  const isVerticalRotation = rotation === 90 || rotation === 270;

  // Create a temporary canvas for the full rotated image
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  if (!tempCtx) {
    throw new Error("No 2d context for temp canvas");
  }

  // Set temp canvas size based on rotation
  if (isVerticalRotation) {
    tempCanvas.width = image.naturalHeight;
    tempCanvas.height = image.naturalWidth;
  } else {
    tempCanvas.width = image.naturalWidth;
    tempCanvas.height = image.naturalHeight;
  }

  // Apply rotation to temp canvas and draw full image
  tempCtx.save();
  tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
  tempCtx.rotate(rotRad);
  tempCtx.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2
  );
  tempCtx.restore();

  // Now crop from the rotated image
  const outputSize = Math.min(crop.width * scaleX, maxWidth);
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped portion from the rotated temp canvas
  ctx.drawImage(
    tempCanvas,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize
  );

  const base64 = canvas.toDataURL("image/jpeg", quality);

  // Check if the base64 string is too large (> 1MB when encoded)
  // Base64 is roughly 4/3 the size of the original data
  const sizeInBytes = (base64.length * 3) / 4;
  const maxSizeInBytes = 1024 * 1024; // 1MB

  if (sizeInBytes > maxSizeInBytes) {
    // Try with lower quality
    if (quality > 0.3) {
      return getCroppedImage(image, crop, rotation, maxWidth, quality - 0.15);
    } else {
      // Try with smaller dimensions
      if (maxWidth > 150) {
        return getCroppedImage(image, crop, rotation, maxWidth - 50, 0.75);
      } else {
        throw new Error(
          "Image is too large even after compression. Please try a different image."
        );
      }
    }
  }

  return base64;
}

export function ProfileImageUpload({
  currentImage,
  onImageChange,
  disabled = false,
  size = "md",
  fallbackText = "?",
  required = false,
  toast,
}: ProfileImageUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Add this to force re-renders
  const [rotation, setRotation] = useState(0); // Rotation in degrees: 0, 90, 180, 270

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast?.({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        toast?.({
          title: "File too large",
          description: "Image must be less than 4MB. Please compress your image before uploading.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setIsLoadingImage(true);
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setIsLoadingImage(false);
        setIsDialogOpen(true);
      };
      reader.onerror = () => {
        setIsLoadingImage(false);
        toast?.({
          title: "Error loading image",
          description: "Please try again with a different image",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, 1));
    },
    []
  );

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleChangePhoto = useCallback(() => {
    if (currentImage) {
      // Load existing photo into dialog for rotation/cropping
      setImageSrc(currentImage);
      setIsDialogOpen(true);
    } else {
      // No existing photo, prompt for upload
      fileInputRef.current?.click();
    }
  }, [currentImage]);

  const handleUploadNewFromDialog = useCallback(() => {
    // Trigger file input while keeping dialog open
    fileInputRef.current?.click();
  }, []);

  const handleCropComplete = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    setIsProcessing(true);
    try {
      const croppedImageUrl = await getCroppedImage(
        imgRef.current,
        completedCrop,
        rotation
      );
      onImageChange(croppedImageUrl);
      setImageKey((prev) => prev + 1); // Force re-render
      setIsDialogOpen(false);
      setImageSrc("");
      setSelectedFile(null);
      setRotation(0);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error cropping image:", error);
      toast?.({
        title: "Error processing image",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, rotation, onImageChange, toast]);

  const handleRemoveImage = useCallback(() => {
    onImageChange(null);
  }, [onImageChange]);

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setImageSrc("");
    setSelectedFile(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsLoadingImage(false);
    setRotation(0);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="space-y-3" data-testid="profile-image-upload">
      <div className="flex items-center gap-4">
        {/* Avatar Display */}
        <div className="relative">
          <div
            className={cn(
              sizeClasses[size],
              "border-2 rounded-full overflow-hidden bg-muted flex items-center justify-center",
              required && !currentImage 
                ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20"
                : "border-muted"
            )}
          >
            {currentImage ? (
              <Image
                key={`profile-img-${imageKey}`}
                src={currentImage}
                alt="Profile"
                width={96}
                height={96}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error("Failed to load profile image");
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className={cn(
                "text-lg font-semibold",
                required && !currentImage 
                  ? "text-red-600 dark:text-red-400"
                  : "text-foreground"
              )}>
                {fallbackText}
              </span>
            )}
          </div>

          {currentImage && !disabled && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full px-0 py-0"
              onClick={handleRemoveImage}
              title="Remove photo"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isLoadingImage}
            onClick={handleChangePhoto}
            className="gap-2"
          >
            {isLoadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {isLoadingImage ? "Loading..." : currentImage ? "Change Photo" : "Upload Photo"}
          </Button>

          {/* Crop and Rotate Dialog */}
          <ResponsiveDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <ResponsiveDialogContent className="max-w-2xl" data-testid="crop-dialog">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>
                  {currentImage ? "Edit Profile Photo" : "Upload Profile Photo"}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {currentImage
                    ? "Adjust the crop area and rotation, or upload a new photo."
                    : "Upload a photo and adjust the crop area to frame it perfectly."}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              <div className="space-y-6">
                {/* Image Preview Area */}
                {imageSrc && (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex justify-center overflow-auto max-h-[450px]">
                        <ReactCrop
                          crop={crop}
                          onChange={(_, percentCrop) => setCrop(percentCrop)}
                          onComplete={(c) => setCompletedCrop(c)}
                          aspect={1}
                          minWidth={100}
                          minHeight={100}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={imgRef}
                            alt="Crop preview"
                            src={imageSrc}
                            style={{
                              maxHeight: "400px",
                              maxWidth: "100%",
                              height: "auto",
                              width: "auto",
                              display: "block",
                              transform: `rotate(${rotation}deg)`,
                              transformOrigin: "center center",
                              transition: "transform 0.2s ease"
                            }}
                            onLoad={onImageLoad}
                          />
                        </ReactCrop>
                      </div>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Drag to adjust the crop area for your profile photo
                    </p>
                  </div>
                )}

                {/* Controls Section */}
                {currentImage && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium">Rotation:</span>
                        <span className="text-sm text-muted-foreground">{rotation}°</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRotateLeft}
                          disabled={isProcessing || !imageSrc}
                          className="gap-2"
                          data-testid="rotate-left-button"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="hidden sm:inline">Left</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRotateRight}
                          disabled={isProcessing || !imageSrc}
                          className="gap-2"
                          data-testid="rotate-right-button"
                        >
                          <RotateCw className="h-4 w-4" />
                          <span className="hidden sm:inline">Right</span>
                        </Button>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleUploadNewFromDialog}
                        disabled={isProcessing}
                        className="w-full gap-2"
                        data-testid="upload-new-photo-button"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Different Photo
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDialogClose}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCropComplete}
                    disabled={!completedCrop || isProcessing}
                    className="gap-2"
                    data-testid="apply-crop-button"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isProcessing ? "Processing..." : "Apply Crop"}
                  </Button>
                </div>
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />

          <p className="text-xs text-muted-foreground">
            JPG, PNG up to 4MB. Square crop recommended.
          </p>
        </div>
      </div>
    </div>
  );
}
