"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Edit2, 
  Save, 
  X, 
  Trash2,
  MessageSquare,
  Clock,
  User,
  AlertTriangle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface AdminNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface AdminNotesManagerProps {
  volunteerId: string;
}

export function AdminNotesManager({ volunteerId }: AdminNotesManagerProps) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/admin-notes?volunteerId=${volunteerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to load admin notes');
    } finally {
      setLoading(false);
    }
  }, [volunteerId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Add new note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      const response = await fetch('/api/admin/admin-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          volunteerId,
          content: newNoteContent.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const newNote = await response.json();
      setNotes([newNote, ...notes]);
      setNewNoteContent("");
      setIsAddingNote(false);
      setError(null);
    } catch (error) {
      console.error('Error creating note:', error);
      setError('Failed to create note');
    }
  };

  // Update note
  const handleUpdateNote = async (noteId: string) => {
    if (!editNoteContent.trim()) return;

    try {
      const response = await fetch(`/api/admin/admin-notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editNoteContent.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const updatedNote = await response.json();
      setNotes(notes.map(note => note.id === noteId ? updatedNote : note));
      setEditingNoteId(null);
      setEditNoteContent("");
      setError(null);
    } catch (error) {
      console.error('Error updating note:', error);
      setError('Failed to update note');
    }
  };

  // Delete note
  const handleDeleteNote = async () => {
    if (!noteToDelete) return;

    try {
      const response = await fetch(`/api/admin/admin-notes/${noteToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNotes(notes.filter(note => note.id !== noteToDelete));
      setError(null);
      setDeleteConfirmOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      setError('Failed to delete note');
      setDeleteConfirmOpen(false);
      setNoteToDelete(null);
    }
  };

  // Open delete confirmation
  const openDeleteConfirm = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteConfirmOpen(true);
  };

  // Close delete confirmation
  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setNoteToDelete(null);
  };

  // Start editing
  const startEditing = (note: AdminNote) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditNoteContent("");
  };

  // Cancel adding
  const cancelAdding = () => {
    setIsAddingNote(false);
    setNewNoteContent("");
  };

  // Get creator name
  const getCreatorName = (creator: AdminNote['creator']) => {
    return creator.name || 
           `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || 
           'Admin';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse bg-muted/50 rounded-lg h-20"></div>
        <div className="animate-pulse bg-muted/50 rounded-lg h-16"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-notes-manager">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add New Note */}
      {!isAddingNote ? (
        <Button
          onClick={() => setIsAddingNote(true)}
          variant="outline"
          size="sm"
          className="w-full border-dashed border-orange-200 text-orange-600 hover:bg-orange-50"
          data-testid="add-note-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Admin Note
        </Button>
      ) : (
        <Card className="border-orange-200">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Enter admin note for this volunteer..."
                className="min-h-20 resize-none"
                data-testid="new-note-textarea"
              />
              <div className="flex justify-end gap-2">
                <Button
                  onClick={cancelAdding}
                  variant="outline"
                  size="sm"
                  data-testid="cancel-add-button"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={handleAddNote}
                  size="sm"
                  disabled={!newNoteContent.trim()}
                  data-testid="save-note-button"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Note
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-6" data-testid="no-notes-message">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No admin notes yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Admin notes are only visible to administrators
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="notes-list">
          {notes.map((note) => (
            <Card 
              key={note.id} 
              className={cn(
                "transition-all duration-200",
                editingNoteId === note.id && "border-orange-200 shadow-sm"
              )}
              data-testid={`note-${note.id}`}
            >
              <CardContent className="pt-4">
                {editingNoteId === note.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <Textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      className="min-h-20 resize-none"
                      data-testid={`edit-note-textarea-${note.id}`}
                    />
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Editing note...
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          size="sm"
                          data-testid={`cancel-edit-button-${note.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleUpdateNote(note.id)}
                          size="sm"
                          disabled={!editNoteContent.trim()}
                          data-testid={`save-edit-button-${note.id}`}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed" data-testid={`note-content-${note.id}`}>
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getCreatorName(note.creator)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(note.createdAt), 'MMM d, yyyy • h:mma')}
                        </div>
                        {note.updatedAt !== note.createdAt && (
                          <Badge variant="outline" className="text-xs">
                            Edited
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => startEditing(note)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-orange-600"
                          data-testid={`edit-note-button-${note.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => openDeleteConfirm(note.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                          data-testid={`delete-note-button-${note.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Admin Note
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              onClick={closeDeleteConfirm}
              variant="outline"
              data-testid="delete-cancel-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteNote}
              variant="destructive"
              data-testid="delete-confirm-button"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}