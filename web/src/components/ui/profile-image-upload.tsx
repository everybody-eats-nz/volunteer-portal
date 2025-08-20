"use client";

import React, { useState, useRef, useCallback } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-image-crop/dist/ReactCrop.css";
import Image from "next/image";

interface ProfileImageUploadProps {
  currentImage?: string | null;
  onImageChange: (base64Image: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  fallbackText?: string;
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

  // Set canvas size to the desired output size (square)
  const outputSize = Math.min(crop.width * scaleX, maxWidth);
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped image
  ctx.drawImage(
    image,
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
      return getCroppedImage(image, crop, maxWidth, quality - 0.15);
    } else {
      // Try with smaller dimensions
      if (maxWidth > 150) {
        return getCroppedImage(image, crop, maxWidth - 50, 0.75);
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
  toast,
}: ProfileImageUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Add this to force re-renders

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

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast?.({
          title: "File too large",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setIsDialogOpen(true);
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

  const handleCropComplete = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    setIsProcessing(true);
    try {
      const croppedImageUrl = await getCroppedImage(
        imgRef.current,
        completedCrop
      );
      onImageChange(croppedImageUrl);
      setImageKey((prev) => prev + 1); // Force re-render
      setIsDialogOpen(false);
      setImageSrc("");
      setSelectedFile(null);

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
  }, [completedCrop, onImageChange, toast]);

  const handleRemoveImage = useCallback(() => {
    onImageChange(null);
  }, [onImageChange]);

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setImageSrc("");
    setSelectedFile(null);
    setCrop(undefined);
    setCompletedCrop(undefined);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Profile Photo</Label>

      <div className="flex items-center gap-4">
        {/* Avatar Display */}
        <div className="relative">
          <div
            className={cn(
              sizeClasses[size],
              "border-2 border-muted rounded-full overflow-hidden bg-muted flex items-center justify-center"
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
              <span className="text-lg font-semibold text-foreground">
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
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            {currentImage ? "Change Photo" : "Upload Photo"}
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crop Your Profile Photo</DialogTitle>
                <DialogDescription>
                  Adjust the crop area to frame your photo perfectly. The image
                  will be resized to a square format.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {imageSrc && (
                  <div className="flex justify-center">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      minWidth={100}
                      minHeight={100}
                    >
                      <Image
                        ref={imgRef}
                        alt="Crop preview"
                        src={imageSrc}
                        width={800}
                        height={600}
                        style={{ maxHeight: "400px", maxWidth: "100%" }}
                        onLoad={onImageLoad}
                      />
                    </ReactCrop>
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
                  >
                    <Upload className="h-4 w-4" />
                    {isProcessing ? "Processing..." : "Apply Crop"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
            JPG, PNG up to 5MB. Square crop recommended.
          </p>
        </div>
      </div>
    </div>
  );
}
