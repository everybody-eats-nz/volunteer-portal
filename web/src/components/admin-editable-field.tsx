"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Edit2, X, Check, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AdminEditableFieldProps {
  userId: string;
  fieldName: "email" | "dateOfBirth";
  currentValue: string | null;
  displayValue: string;
  onUpdate: (newValue: string) => void;
}

export function AdminEditableField({
  userId,
  fieldName,
  currentValue,
  displayValue,
  onUpdate,
}: AdminEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentValue || "");
  const [loading, setLoading] = useState(false);
  const [dobOpen, setDobOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!value || value === currentValue) {
      setIsEditing(false);
      setValue(currentValue || "");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [fieldName]: value }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update field");
      }

      await response.json();
      toast({
        title: "Updated successfully",
        description: `${fieldName === "email" ? "Email address" : "Date of birth"} has been updated.`,
      });

      onUpdate(value);
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error updating field",
        description:
          error instanceof Error ? error.message : "Failed to update field",
        variant: "destructive",
      });
      setValue(currentValue || "");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(currentValue || "");
    setIsEditing(false);
    setDobOpen(false);
  };

  const selectedDate = value ? new Date(value) : undefined;

  if (!isEditing) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 dark:bg-muted/30 rounded-lg group">
        <div className="flex-1 space-y-1">
          {fieldName === "email" && currentValue ? (
            <a
              href={`mailto:${currentValue}`}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {displayValue}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">{displayValue}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`edit-${fieldName}-button`}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 dark:bg-muted/30 rounded-lg border-2 border-primary">
      <div className="flex-1">
        {fieldName === "email" ? (
          <Input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="email@example.com"
            disabled={loading}
            className="h-9"
            data-testid={`${fieldName}-input`}
            autoFocus
          />
        ) : (
          <Popover open={dobOpen} onOpenChange={setDobOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={loading}
                data-testid={`${fieldName}-input`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP")
                ) : (
                  <span>Select date of birth</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setValue(format(date, "yyyy-MM-dd"));
                    setDobOpen(false);
                  }
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date >= today || loading;
                }}
                captionLayout="dropdown"
                fromYear={1900}
                toYear={new Date().getFullYear()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSave}
        disabled={loading}
        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
        data-testid={`save-${fieldName}-button`}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        disabled={loading}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
        data-testid={`cancel-${fieldName}-button`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
