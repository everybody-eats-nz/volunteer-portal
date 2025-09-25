import { cn } from "@/lib/utils";
import { MotionPageContainer } from "@/components/motion-page-container";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  testid?: string;
  [key: string]: unknown; // Allow arbitrary props like data-testid
}

/**
 * Consistent page container component that provides:
 * - Standard max-width (6xl) and centering
 * - Consistent spacing between sections (space-y-8)
 * - Motion.dev animations instead of CSS animations
 *
 * Usage:
 * <PageContainer>
 *   <PageHeader title="..." />
 *   <section>...</section>
 * </PageContainer>
 */
export function PageContainer({
  children,
  className,
  animate = true,
  testid,
  ...props
}: PageContainerProps) {
  return (
    <MotionPageContainer
      className={cn("space-y-8", className)}
      animate={animate}
      testid={testid}
      {...props}
    >
      {children}
    </MotionPageContainer>
  );
}
