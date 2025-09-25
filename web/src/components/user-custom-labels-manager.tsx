"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, X, Tags } from "lucide-react";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { useToast } from "@/hooks/use-toast";
import { type CustomLabel } from "@prisma/client";

type UserCustomLabel = {
  label: CustomLabel;
};

interface UserCustomLabelsManagerProps {
  userId: string;
  currentLabels: UserCustomLabel[];
  onChange?: () => void;
}

export function UserCustomLabelsManager({
  userId,
  currentLabels,
  onChange,
}: UserCustomLabelsManagerProps) {
  const [labels, setLabels] = useState<UserCustomLabel[]>(currentLabels);
  const [availableLabels, setAvailableLabels] = useState<CustomLabel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLabels(currentLabels);
  }, [currentLabels]);

  const fetchAvailableLabels = async () => {
    try {
      const response = await fetch("/api/admin/custom-labels");
      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data);
      }
    } catch (error) {
      console.error("Error fetching available labels:", error);
    }
  };

  const handleAddLabel = async (labelId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/labels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ labelId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add label");
      }

      const newLabel = await response.json();
      setLabels(prev => [...prev, { label: newLabel }]);
      
      toast({
        title: "Success",
        description: "Label added to user",
      });
      
      setDialogOpen(false);
      onChange?.();
    } catch (error) {
      toast({
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to add label",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLabel = async (labelId: string) => {
    if (!confirm("Remove this label from the user?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/labels`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ labelId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove label");
      }

      setLabels(prev => prev.filter(ul => ul.label.id !== labelId));
      
      toast({
        title: "Success",
        description: "Label removed from user",
      });
      
      onChange?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove label",
        variant: "destructive",
      });
    }
  };

  const availableToAdd = availableLabels.filter(
    label => !labels.some(ul => ul.label.id === label.id)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Custom Labels
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchAvailableLabels}
                data-testid="add-label-button"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Label
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Label</DialogTitle>
              </DialogHeader>
              <Command>
                <CommandInput placeholder="Search labels..." />
                <CommandList>
                  <CommandEmpty>No labels found.</CommandEmpty>
                  <CommandGroup>
                    {availableToAdd.map((label) => (
                      <CommandItem
                        key={label.id}
                        onSelect={() => handleAddLabel(label.id)}
                        disabled={isLoading}
                        className="cursor-pointer"
                        data-testid={`add-label-${label.id}`}
                      >
                        <CustomLabelBadge label={label} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {labels.length === 0 ? (
          <div className="text-center py-4 text-slate-500">
            <Tags className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No custom labels assigned</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((userLabel) => (
              <div 
                key={userLabel.label.id} 
                className="relative group"
                data-testid={`user-label-${userLabel.label.id}`}
              >
                <CustomLabelBadge label={userLabel.label} />
                <button
                  onClick={() => handleRemoveLabel(userLabel.label.id)}
                  className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  data-testid={`remove-label-${userLabel.label.id}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}