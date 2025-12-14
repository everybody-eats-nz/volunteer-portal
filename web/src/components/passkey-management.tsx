"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  isPasskeySupported,
  registerPasskey,
  listPasskeys,
  deletePasskey,
  renamePasskey,
  getPasskeyErrorMessage,
} from "@/lib/passkey-client";
import {
  Fingerprint,
  Plus,
  Trash2,
  Smartphone,
  Usb,
  Edit2,
  Key,
} from "lucide-react";
import { motion } from "motion/react";
import { MotionSpinner } from "@/components/motion-spinner";
import { formatDistanceToNow } from "date-fns";

interface Passkey {
  id: string;
  deviceName: string;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

export function PasskeyManagement() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPasskey, setSelectedPasskey] = useState<Passkey | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchPasskeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listPasskeys();
      setPasskeys(data);
    } catch (error) {
      console.error("Error fetching passkeys:", error);
      toast({
        title: "Error",
        description: "Failed to load passkeys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Check passkey support
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = await isPasskeySupported();
      setSupported(isSupported);
      if (isSupported) {
        await fetchPasskeys();
      } else {
        setLoading(false);
      }
    };
    checkSupport();
  }, [fetchPasskeys]);

  async function handleAddPasskey() {
    setIsAdding(true);
    try {
      await registerPasskey(deviceName || undefined);
      toast({
        title: "Passkey added!",
        description: "You can now use this passkey to sign in.",
      });
      setAddDialogOpen(false);
      setDeviceName("");
      await fetchPasskeys();
    } catch (error) {
      console.error("Error adding passkey:", error);
      toast({
        title: "Error",
        description: getPasskeyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRenamePasskey() {
    if (!selectedPasskey) return;

    setIsRenaming(true);
    try {
      await renamePasskey(selectedPasskey.id, deviceName);
      toast({
        title: "Passkey renamed",
        description: "Your passkey has been renamed successfully.",
      });
      setRenameDialogOpen(false);
      setDeviceName("");
      setSelectedPasskey(null);
      await fetchPasskeys();
    } catch (error) {
      console.error("Error renaming passkey:", error);
      toast({
        title: "Error",
        description: getPasskeyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleDeletePasskey() {
    if (!selectedPasskey) return;

    setIsDeleting(true);
    try {
      await deletePasskey(selectedPasskey.id);

      // Get device-specific instructions for removing passkey from device
      const deviceInstructions = getDeviceInstructions();

      toast({
        title: "Passkey removed from server",
        description: deviceInstructions,
      });
      setDeleteDialogOpen(false);
      setSelectedPasskey(null);
      await fetchPasskeys();
    } catch (error) {
      console.error("Error deleting passkey:", error);
      toast({
        title: "Error",
        description: getPasskeyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function getDeviceInstructions(): string {
    const userAgent = navigator.userAgent;

    if (/iPhone|iPad|iPod/.test(userAgent)) {
      return "To remove from this device: Settings → Passwords → Search for this site → Delete passkey";
    } else if (/Mac/.test(userAgent)) {
      return "To remove from this device: System Settings → Passwords → Search for this site → Delete passkey";
    } else if (/Android/.test(userAgent)) {
      return "To remove from this device: Settings → Passwords & accounts → Google → Manage your passkeys → Delete passkey";
    } else if (/Windows/.test(userAgent)) {
      return "To remove from this device: Settings → Accounts → Passkey settings → Delete passkey";
    } else {
      return "Passkey removed. To fully remove from your device, check your password manager settings.";
    }
  }

  function getTransportIcon(transport: string) {
    switch (transport.toLowerCase()) {
      case "usb":
        return <Usb className="w-3 h-3" />;
      case "nfc":
      case "ble":
        return <Smartphone className="w-3 h-3" />;
      case "internal":
        return <Fingerprint className="w-3 h-3" />;
      default:
        return <Key className="w-3 h-3" />;
    }
  }

  if (!supported) {
    return (
      <Card data-testid="passkey-management-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Passkeys are not supported in your current browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To use passkeys, please use a modern browser like Chrome, Safari, or
            Edge.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card data-testid="passkey-management-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Manage your passkeys for passwordless sign-in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <MotionSpinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="passkey-management-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Manage your passkeys for passwordless sign-in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passkeys.length === 0 ? (
            <div className="text-center py-8">
              <Fingerprint className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No passkeys yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add a passkey to sign in faster with your fingerprint, face, or
                device PIN
              </p>
              <Button
                type="button"
                onClick={() => setAddDialogOpen(true)}
                data-testid="add-first-passkey-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Passkey
              </Button>
            </div>
          ) : (
            <motion.div
              className="space-y-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {passkeys.map((passkey) => (
                <motion.div
                  key={passkey.id}
                  variants={staggerItem}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  data-testid={`passkey-item-${passkey.id}`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg mt-1">
                      <Fingerprint className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4
                        className="font-medium"
                        data-testid="passkey-device-name"
                      >
                        {passkey.deviceName}
                      </h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {passkey.transports.map((transport) => (
                          <Badge
                            key={transport}
                            variant="secondary"
                            className="text-xs"
                          >
                            <span className="mr-1">
                              {getTransportIcon(transport)}
                            </span>
                            {transport}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <p>
                          Created{" "}
                          {formatDistanceToNow(new Date(passkey.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                        {passkey.lastUsedAt && (
                          <p>
                            Last used{" "}
                            {formatDistanceToNow(new Date(passkey.lastUsedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPasskey(passkey);
                        setDeviceName(passkey.deviceName);
                        setRenameDialogOpen(true);
                      }}
                      data-testid="rename-passkey-button"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPasskey(passkey);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid="delete-passkey-button"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              <Button
                type="button"
                onClick={() => setAddDialogOpen(true)}
                className="w-full mt-4"
                variant="outline"
                data-testid="add-passkey-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Passkey
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Add Passkey Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="add-passkey-dialog">
          <DialogHeader>
            <DialogTitle>Add Passkey</DialogTitle>
            <DialogDescription>
              Give your passkey a name to help you remember which device
              it&apos;s for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device-name">Device Name (Optional)</Label>
              <Input
                id="device-name"
                placeholder="e.g., iPhone, Work Laptop, YubiKey"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                data-testid="device-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPasskey}
              disabled={isAdding}
              data-testid="confirm-add-passkey-button"
            >
              {isAdding ? (
                <>
                  <MotionSpinner size="sm" className="mr-2" />
                  Adding...
                </>
              ) : (
                "Add Passkey"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Passkey Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent data-testid="rename-passkey-dialog">
          <DialogHeader>
            <DialogTitle>Rename Passkey</DialogTitle>
            <DialogDescription>
              Update the name of your passkey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-device-name">Device Name</Label>
              <Input
                id="rename-device-name"
                placeholder="e.g., iPhone, Work Laptop, YubiKey"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                data-testid="rename-device-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenamePasskey}
              disabled={isRenaming || !deviceName.trim()}
              data-testid="confirm-rename-passkey-button"
            >
              {isRenaming ? (
                <>
                  <MotionSpinner size="sm" className="mr-2" />
                  Renaming...
                </>
              ) : (
                "Rename"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Passkey Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-passkey-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &rdquo;
              {selectedPasskey?.deviceName}&ldquo;? You won&apos;t be able to
              use this passkey to sign in anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePasskey}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="confirm-delete-passkey-button"
            >
              {isDeleting ? (
                <>
                  <MotionSpinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
