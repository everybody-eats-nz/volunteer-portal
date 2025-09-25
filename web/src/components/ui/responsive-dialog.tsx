"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MotionDialog as Dialog,
  MotionDialogClose as DialogClose,
  MotionDialogContent as DialogContent,
  MotionDialogDescription as DialogDescription,
  MotionDialogHeader as DialogHeader,
  MotionDialogTitle as DialogTitle,
  MotionDialogTrigger as DialogTrigger,
} from "@/components/motion-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface BaseProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ResponsiveDialogProps extends BaseProps {
  children: React.ReactNode;
}

interface ResponsiveDialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogTriggerProps {
  className?: string;
  children: React.ReactNode;
  asChild?: boolean;
}

interface ResponsiveDialogCloseProps {
  className?: string;
  children: React.ReactNode;
  asChild?: boolean;
}

const ResponsiveDialog = ({ children, ...props }: ResponsiveDialogProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <Dialog {...props}>{children}</Dialog>;
  }

  return <Drawer {...props}>{children}</Drawer>;
};

const ResponsiveDialogTrigger = ({
  className,
  children,
  ...props
}: ResponsiveDialogTriggerProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogTrigger className={className} {...props}>
        {children}
      </DialogTrigger>
    );
  }

  return (
    <DrawerTrigger className={className} {...props}>
      {children}
    </DrawerTrigger>
  );
};

const ResponsiveDialogClose = ({
  className,
  children,
  ...props
}: ResponsiveDialogCloseProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogClose className={className} {...props}>
        {children}
      </DialogClose>
    );
  }

  return (
    <DrawerClose className={className} {...props}>
      {children}
    </DrawerClose>
  );
};

const ResponsiveDialogContent = ({
  className,
  children,
  ...props
}: ResponsiveDialogContentProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogContent className={className} {...props}>
        {children}
      </DialogContent>
    );
  }

  return (
    <DrawerContent className={className} {...props}>
      {children}
    </DrawerContent>
  );
};

const ResponsiveDialogHeader = ({
  className,
  children,
}: ResponsiveDialogHeaderProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <DialogHeader className={className}>{children}</DialogHeader>;
  }

  return <DrawerHeader className={className}>{children}</DrawerHeader>;
};

const ResponsiveDialogTitle = ({
  className,
  children,
  ...props
}: ResponsiveDialogTitleProps & React.HTMLAttributes<HTMLHeadingElement>) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogTitle className={className} {...props}>
        {children}
      </DialogTitle>
    );
  }

  return (
    <DrawerTitle className={className} {...props}>
      {children}
    </DrawerTitle>
  );
};

const ResponsiveDialogDescription = ({
  className,
  children,
  ...props
}: ResponsiveDialogDescriptionProps &
  React.HTMLAttributes<HTMLParagraphElement>) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <DialogDescription className={className} {...props}>
        {children}
      </DialogDescription>
    );
  }

  return (
    <DrawerDescription className={className} {...props}>
      {children}
    </DrawerDescription>
  );
};

const ResponsiveDialogFooter = ({
  className,
  children,
}: ResponsiveDialogFooterProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <div className={className}>{children}</div>;
  }

  return <DrawerFooter className={className}>{children}</DrawerFooter>;
};

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
