import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PolicyContentProps {
  content: string;
  className?: string;
  onAgree?: () => void;
  showAgreeButton?: boolean;
}

export function PolicyContent({ 
  content, 
  className = "", 
  onAgree,
  showAgreeButton = false
}: PolicyContentProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll state when component mounts or when dialog opens
  useEffect(() => {
    if (showAgreeButton) {
      setHasScrolledToBottom(false);
      // Reset scroll position to top
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [showAgreeButton]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !showAgreeButton) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
          
          // Only update state if the value actually changed to prevent unnecessary re-renders
          setHasScrolledToBottom(prev => prev !== isAtBottom ? isAtBottom : prev);
          
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial state
    handleScroll();

    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [showAgreeButton]);

  return (
    <div className={`max-w-none ${className} ${showAgreeButton ? 'flex flex-col h-[70vh] max-h-[500px]' : ''}`}>
      <div 
        ref={scrollContainerRef}
        className={showAgreeButton ? "flex-1 overflow-y-auto pr-2 min-h-0" : ""}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-lg font-bold mb-4 text-foreground font-accent">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-semibold mb-3 mt-5 text-foreground font-accent">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-medium mb-2 mt-4 text-foreground font-accent">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                {children}
              </p>
            ),
            li: ({ children }) => (
              <li className="text-sm text-muted-foreground mb-1">
                {children}
              </li>
            ),
            ul: ({ children }) => (
              <ul className="mb-4 ml-4 list-disc space-y-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-4 ml-4 list-decimal space-y-1">
                {children}
              </ol>
            ),
            hr: () => (
              <hr className="my-5 border-border" />
            ),
            strong: ({ children }) => (
              <strong className="text-foreground font-semibold">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="text-muted-foreground italic">
                {children}
              </em>
            ),
          }}
        >
          {content}
        </Markdown>
      </div>
      {showAgreeButton && (
        <div className="flex-shrink-0 mt-6 pt-6 border-t border-border bg-background/80 backdrop-blur-sm">
          <Button
            onClick={onAgree}
            disabled={!hasScrolledToBottom}
            className="w-full h-12 text-base"
            variant="default"
          >
            {hasScrolledToBottom ? "I agree to these terms" : "Please scroll to the bottom to continue"}
          </Button>
          {!hasScrolledToBottom && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              You must scroll to the bottom to read the complete policy before agreeing
            </p>
          )}
        </div>
      )}
    </div>
  );
}
