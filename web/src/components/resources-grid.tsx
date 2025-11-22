"use client";

import { ResourceType, ResourceCategory } from "@prisma/client";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  ExternalLink,
  Video,
  Download,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatFileSize } from "@/lib/storage";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: ResourceType;
  category: ResourceCategory;
  tags: string[];
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  url: string | null;
  createdAt: Date;
  uploader: {
    firstName: string | null;
    lastName: string | null;
  };
}

interface ResourcesGridProps {
  resources: Resource[];
}

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  PDF: <FileText className="h-5 w-5" />,
  IMAGE: <ImageIcon className="h-5 w-5" />,
  DOCUMENT: <FileSpreadsheet className="h-5 w-5" />,
  LINK: <ExternalLink className="h-5 w-5" />,
  VIDEO: <Video className="h-5 w-5" />,
};

const TYPE_COLORS: Record<ResourceType, string> = {
  PDF: "bg-red-100 text-red-800 border-red-200",
  IMAGE: "bg-blue-100 text-blue-800 border-blue-200",
  DOCUMENT: "bg-green-100 text-green-800 border-green-200",
  LINK: "bg-purple-100 text-purple-800 border-purple-200",
  VIDEO: "bg-orange-100 text-orange-800 border-orange-200",
};

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  TRAINING: "Training",
  POLICIES: "Policies",
  FORMS: "Forms",
  GUIDES: "Guides",
  RECIPES: "Recipes",
  SAFETY: "Safety",
  GENERAL: "General",
};

export function ResourcesGrid({ resources }: ResourcesGridProps) {
  const handleResourceClick = (resource: Resource) => {
    if (resource.type === "LINK" || resource.type === "VIDEO") {
      window.open(resource.url!, "_blank");
    } else if (resource.fileUrl) {
      window.open(resource.fileUrl, "_blank");
    }
  };

  if (resources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-lg font-medium">No resources found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => (
        <Card
          key={resource.id}
          className="group cursor-pointer transition-all hover:shadow-lg"
          onClick={() => handleResourceClick(resource)}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className={`rounded-lg p-2 ${TYPE_COLORS[resource.type]}`}>
                {TYPE_ICONS[resource.type]}
              </div>
              <Badge variant="outline" className="text-xs">
                {CATEGORY_LABELS[resource.category]}
              </Badge>
            </div>
            <CardTitle className="line-clamp-2">{resource.title}</CardTitle>
            {resource.description && (
              <CardDescription className="line-clamp-3">
                {resource.description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent>
            {resource.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {resource.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {resource.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{resource.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {resource.fileSize
                ? formatFileSize(resource.fileSize)
                : resource.type === "LINK"
                ? "External Link"
                : "Video"}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="group-hover:bg-primary group-hover:text-primary-foreground"
            >
              {resource.type === "LINK" || resource.type === "VIDEO" ? (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  View
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
