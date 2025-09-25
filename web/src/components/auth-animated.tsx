"use client";

import { motion, AnimatePresence } from "motion/react";
import { fadeVariants, slideUpVariants } from "@/lib/motion";

interface AnimatedProps {
  children: React.ReactNode;
  className?: string;
}

// Animated page container with fade-in
export function AuthPageContainer({ children, className }: AnimatedProps) {
  return (
    <motion.div
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated card for login/register forms
export function AuthCard({ children, className }: AnimatedProps) {
  return (
    <motion.div
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated form step transitions for registration
export function FormStepTransition({ 
  children, 
  currentStep 
}: AnimatedProps & { currentStep: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Animated progress indicator
export function ProgressIndicator({ 
  currentStep, 
  totalSteps 
}: { currentStep: number; totalSteps: number }) {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

// Animated loading spinner
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={className}
    />
  );
}

// Animated step indicator circles
export function StepIndicator({ 
  step, 
  currentStep, 
  completed 
}: { 
  step: number; 
  currentStep: number; 
  completed: boolean;
}) {
  const isActive = step === currentStep;
  const isPast = step < currentStep || completed;
  
  return (
    <motion.div
      initial={false}
      animate={{
        scale: isActive ? 1.1 : 1,
        backgroundColor: isPast ? "var(--primary)" : isActive ? "var(--primary)" : "#e5e7eb"
      }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-center w-10 h-10 rounded-full"
    >
      <span className={`text-sm font-medium ${(isPast || isActive) ? "text-white" : "text-gray-500"}`}>
        {isPast && step < currentStep ? "✓" : step}
      </span>
    </motion.div>
  );
}