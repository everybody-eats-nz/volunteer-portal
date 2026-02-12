"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Settings as SettingsIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SiteSetting {
  key: string;
  value: string;
  description: string | null;
  category: string;
  updatedAt: Date;
  updatedBy: string | null;
}

interface SiteSettingsFormProps {
  settings: SiteSetting[];
}

export function SiteSettingsForm({ settings: initialSettings }: SiteSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [settingValues, setSettingValues] = useState<Record<string, string>>(
    initialSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>)
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleSave = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));

    try {
      const value = settingValues[key];

      // Basic URL validation for document URLs
      if (key === "PARENTAL_CONSENT_FORM_URL") {
        if (!value.startsWith("/") && !value.startsWith("http://") && !value.startsWith("https://")) {
          toast.error("URL must be a valid absolute URL or start with /");
          setSaving((prev) => ({ ...prev, [key]: false }));
          return;
        }
      }

      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key,
          value,
        }),
      });

      if (response.ok) {
        const updatedSetting = await response.json();
        setSettings((prev) =>
          prev.map((s) => (s.key === key ? updatedSetting : s))
        );
        toast.success("Setting updated successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update setting");
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      toast.error("Failed to update setting");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleTestLink = (url: string) => {
    window.open(url, "_blank");
  };

  // Group settings by category
  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SiteSetting[]>);

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "DOCUMENTS":
        return "Document URLs";
      case "GENERAL":
        return "General Settings";
      default:
        return category;
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case "DOCUMENTS":
        return "Configure URLs for downloadable documents and forms";
      case "GENERAL":
        return "General site-wide configuration options";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              {getCategoryTitle(category)}
            </CardTitle>
            <CardDescription>{getCategoryDescription(category)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {categorySettings.map((setting) => (
                <div key={setting.key} className="space-y-2">
                  <Label htmlFor={`setting-${setting.key}`}>
                    {setting.description || setting.key}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`setting-${setting.key}`}
                      type="text"
                      value={settingValues[setting.key] || ""}
                      onChange={(e) =>
                        setSettingValues((prev) => ({
                          ...prev,
                          [setting.key]: e.target.value,
                        }))
                      }
                      className="flex-1"
                      placeholder="Enter URL or value"
                    />
                    {setting.key.includes("URL") && settingValues[setting.key] && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestLink(settingValues[setting.key])}
                        title="Test this link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      onClick={() => handleSave(setting.key)}
                      disabled={
                        saving[setting.key] ||
                        settingValues[setting.key] === setting.value
                      }
                      size="sm"
                    >
                      {saving[setting.key] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {setting.updatedBy && (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(setting.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {settings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <SettingsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No settings configured yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
