"use client";

import React from "react";
import { LOCATIONS } from "@/lib/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";

export interface ShiftTemplate {
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  notes: string;
  shiftTypeId: string; // Each template should be associated with a shift type
  location?: string; // Optional location for template specificity
}

interface ShiftType {
  id: string;
  name: string;
}

interface ShiftTemplateManagerProps {
  initialTemplates: Record<string, ShiftTemplate>;
  shiftTypes: ShiftType[];
  onTemplateClick?: (template: ShiftTemplate) => void;
}

export function ShiftTemplateManager({ initialTemplates, shiftTypes, onTemplateClick }: ShiftTemplateManagerProps) {
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [editingTemplate, setEditingTemplate] = React.useState<{ id: string; template: ShiftTemplate & { id: string } } | null>(null);
  const [deletingTemplate, setDeletingTemplate] = React.useState<string | null>(null);
  const [newTemplate, setNewTemplate] = React.useState<ShiftTemplate>({
    name: "",
    startTime: "",
    endTime: "",
    capacity: 1,
    notes: "",
    shiftTypeId: "",
    location: "", // Add location field
  });
  const [isAddingNew, setIsAddingNew] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Refresh templates from the server
  const refreshTemplates = async () => {
    try {
      const response = await fetch('/api/admin/shift-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      
      const dbTemplates = await response.json();
      const templatesObject = Object.fromEntries(
        dbTemplates.map((template: {
          id: string;
          name: string;
          startTime: string;
          endTime: string;
          capacity: number;
          notes: string | null;
          shiftTypeId: string;
          location: string;
        }) => [
          template.name,
          {
            name: template.name,
            startTime: template.startTime,
            endTime: template.endTime,
            capacity: template.capacity,
            notes: template.notes || "",
            shiftTypeId: template.shiftTypeId,
            location: template.location,
            id: template.id, // Include the database ID
          }
        ])
      );
      setTemplates(templatesObject);
    } catch (error) {
      console.error('Failed to refresh templates:', error);
      setError('Failed to load templates');
    }
  };

  const handleEditTemplate = (key: string) => {
    const template = templates[key];
    if (template && 'id' in template) {
      setEditingTemplate({ 
        id: template.id as string, 
        template: { ...template, id: template.id as string }
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/shift-templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTemplate.template.name,
          startTime: editingTemplate.template.startTime,
          endTime: editingTemplate.template.endTime,
          capacity: editingTemplate.template.capacity,
          notes: editingTemplate.template.notes,
          shiftTypeId: editingTemplate.template.shiftTypeId,
          location: editingTemplate.template.location,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update template');
      }

      await refreshTemplates();
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to update template:', error);
      setError(error instanceof Error ? error.message : 'Failed to update template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (key: string) => {
    const template = templates[key];
    if (!template || !('id' in template)) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/shift-templates/${template.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      await refreshTemplates();
      setDeletingTemplate(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = async () => {
    if (!newTemplate.name.trim() || !newTemplate.location || !newTemplate.location.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/shift-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }

      await refreshTemplates();
      setNewTemplate({
        name: "",
        startTime: "",
        endTime: "",
        capacity: 1,
        notes: "",
        shiftTypeId: "",
        location: "",
      });
      setIsAddingNew(false);
    } catch (error) {
      console.error('Failed to create template:', error);
      setError(error instanceof Error ? error.message : 'Failed to create template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = (template: ShiftTemplate) => {
    onTemplateClick?.(template);
  };

  return (
    <div className="space-y-3" data-testid="shift-templates-section">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          Quick Templates
        </h3>
        <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="add-template-button">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Template</DialogTitle>
              <DialogDescription>
                Create a new shift template with default times and capacity.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Morning Setup"
                  data-testid="template-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-location">Location *</Label>
                  <Select value={newTemplate.location} onValueChange={(value) => setNewTemplate(prev => ({ ...prev, location: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-start-time">Start Time *</Label>
                  <Input
                    type="time"
                    id="template-start-time"
                    value={newTemplate.startTime}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, startTime: e.target.value }))}
                    data-testid="template-start-time-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-end-time">End Time *</Label>
                  <Input
                    type="time"
                    id="template-end-time"
                    value={newTemplate.endTime}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, endTime: e.target.value }))}
                    data-testid="template-end-time-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-capacity">Capacity *</Label>
                <Input
                  type="number"
                  id="template-capacity"
                  min="1"
                  value={newTemplate.capacity}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                  placeholder="Number of volunteers"
                  data-testid="template-capacity-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-shift-type">Shift Type *</Label>
                <Select
                  value={newTemplate.shiftTypeId}
                  onValueChange={(value) => setNewTemplate(prev => ({ ...prev, shiftTypeId: value }))}
                >
                  <SelectTrigger id="template-shift-type" data-testid="template-shift-type-select">
                    <SelectValue placeholder="Choose shift type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-notes">Notes (optional)</Label>
                <Textarea
                  id="template-notes"
                  value={newTemplate.notes}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Description of the shift..."
                  rows={3}
                  data-testid="template-notes-textarea"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingNew(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddNew}
                disabled={isLoading || !newTemplate.name.trim() || !newTemplate.location || !newTemplate.startTime || !newTemplate.endTime || !newTemplate.shiftTypeId}
                data-testid="save-template-button"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                {isLoading ? 'Adding...' : 'Add Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(templates).map(([name, template]) => (
          <div key={name} className="group relative">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-auto p-4 text-left justify-start cursor-pointer hover:bg-primary/10 transition-colors pr-16 min-h-[3rem] relative"
              onClick={() => handleTemplateClick(template)}
              data-testid={`template-${name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex flex-col items-start">
                <div className="font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">
                  {template.startTime}-{template.endTime} • {template.capacity} volunteers
                </div>
              </div>
            </Button>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditTemplate(name);
                }}
                data-testid={`edit-template-${name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <EditIcon className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingTemplate(name);
                }}
                data-testid={`delete-template-${name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Click a template to fill the form with its values. Hover to edit or delete templates.
      </p>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Modify the template settings.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          {editingTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-template-name">Template Name *</Label>
                <Input
                  id="edit-template-name"
                  value={editingTemplate.template.name}
                  onChange={(e) => setEditingTemplate(prev => 
                    prev ? { ...prev, template: { ...prev.template, name: e.target.value } } : null
                  )}
                  placeholder="e.g., Morning Setup"
                  data-testid="edit-template-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-template-location">Location *</Label>
                  <Select 
                    value={editingTemplate.template.location || ""} 
                    onValueChange={(value) => setEditingTemplate(prev => 
                      prev ? { ...prev, template: { ...prev.template, location: value } } : null
                    )}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-template-start-time">Start Time *</Label>
                  <Input
                    type="time"
                    id="edit-template-start-time"
                    value={editingTemplate.template.startTime}
                    onChange={(e) => setEditingTemplate(prev => 
                      prev ? { ...prev, template: { ...prev.template, startTime: e.target.value } } : null
                    )}
                    data-testid="edit-template-start-time-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-template-end-time">End Time *</Label>
                  <Input
                    type="time"
                    id="edit-template-end-time"
                    value={editingTemplate.template.endTime}
                    onChange={(e) => setEditingTemplate(prev => 
                      prev ? { ...prev, template: { ...prev.template, endTime: e.target.value } } : null
                    )}
                    data-testid="edit-template-end-time-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template-capacity">Capacity *</Label>
                <Input
                  type="number"
                  id="edit-template-capacity"
                  min="1"
                  value={editingTemplate.template.capacity}
                  onChange={(e) => setEditingTemplate(prev => 
                    prev ? { ...prev, template: { ...prev.template, capacity: parseInt(e.target.value) || 1 } } : null
                  )}
                  placeholder="Number of volunteers"
                  data-testid="edit-template-capacity-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template-shift-type">Shift Type *</Label>
                <Select
                  value={editingTemplate.template.shiftTypeId}
                  onValueChange={(value) => setEditingTemplate(prev => 
                    prev ? { ...prev, template: { ...prev.template, shiftTypeId: value } } : null
                  )}
                >
                  <SelectTrigger id="edit-template-shift-type" data-testid="edit-template-shift-type-select">
                    <SelectValue placeholder="Choose shift type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-template-notes">Notes (optional)</Label>
                <Textarea
                  id="edit-template-notes"
                  value={editingTemplate.template.notes}
                  onChange={(e) => setEditingTemplate(prev => 
                    prev ? { ...prev, template: { ...prev.template, notes: e.target.value } } : null
                  )}
                  placeholder="Description of the shift..."
                  rows={3}
                  data-testid="edit-template-notes-textarea"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={isLoading || !editingTemplate?.template.name.trim() || !editingTemplate?.template.location || !editingTemplate?.template.startTime || !editingTemplate?.template.endTime || !editingTemplate?.template.shiftTypeId}
              data-testid="save-edit-template-button"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={() => setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template &quot;{deletingTemplate}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplate && handleDeleteTemplate(deletingTemplate)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}