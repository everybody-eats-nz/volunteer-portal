/**
 * Motion.dev animation utilities and variants
 * Replaces Tailwind CSS animations and custom CSS keyframes
 */

import { Variants } from "motion/react";

// Common easing curves
export const easing = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: { type: "spring", damping: 15, stiffness: 300 },
  bouncy: { type: "spring", damping: 10, stiffness: 400 },
} as const;

// Common transitions
export const transitions = {
  fast: { duration: 0.2, ease: easing.easeOut },
  medium: { duration: 0.3, ease: easing.easeInOut },
  slow: { duration: 0.5, ease: easing.easeInOut },
  spring: easing.spring,
  bouncy: easing.bouncy,
} as const;

// Fade animations
export const fadeVariants: Variants = {
  hidden: { 
    opacity: 0,
  },
  visible: { 
    opacity: 1,
    transition: transitions.medium,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  }
};

// Slide up animations (replaces animate-slide-up)
export const slideUpVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: transitions.medium,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: transitions.fast,
  }
};

// Slide in from different directions
export const slideVariants = {
  fromTop: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: transitions.medium },
    exit: { opacity: 0, y: -10, transition: transitions.fast }
  },
  fromBottom: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: transitions.medium },
    exit: { opacity: 0, y: 10, transition: transitions.fast }
  },
  fromLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: transitions.medium },
    exit: { opacity: 0, x: -10, transition: transitions.fast }
  },
  fromRight: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: transitions.medium },
    exit: { opacity: 0, x: 10, transition: transitions.fast }
  }
} as const;

// Scale animations for modals/dropdowns
export const scaleVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: transitions.medium,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.fast,
  }
};

// Combined fade + scale for dropdowns/modals
export const dropdownVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: -5,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: transitions.medium,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -2,
    transition: transitions.fast,
  }
};

// Card hover effects
export const cardHoverVariants: Variants = {
  rest: { 
    y: 0, 
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  },
  hover: { 
    y: -2, 
    boxShadow: "0 10px 25px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    transition: transitions.fast,
  }
};

// Button hover effects
export const buttonHoverVariants: Variants = {
  rest: { y: 0 },
  hover: { 
    y: -1,
    transition: transitions.fast,
  },
  tap: {
    y: 0,
    transition: transitions.fast,
  }
};

// Stagger animation for lists/grids
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};

// Individual stagger items
export const staggerItem: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: transitions.medium,
  }
};

// Loading spinner animation
export const spinVariants: Variants = {
  spin: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    }
  }
};

// Progress bar animation
export const progressVariants: Variants = {
  initial: { width: 0 },
  animate: (width: number) => ({
    width: `${width}%`,
    transition: { duration: 0.5, ease: easing.easeOut }
  })
};

// Notification animations
export const notificationVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: 300,
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    x: 300,
    scale: 0.95,
    transition: transitions.fast,
  }
};

// Achievement unlock animation
export const achievementVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    y: 50,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: transitions.bouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: transitions.fast,
  }
};

// Page transition variants
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: easing.easeOut,
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: easing.easeIn,
    }
  }
};

// Helper function to create custom stagger delays
export function createStagger(baseDelay: number = 0.1) {
  return {
    visible: {
      transition: {
        staggerChildren: baseDelay,
        delayChildren: 0,
      }
    }
  };
}

// Helper function for reduced motion preferences
export function getReducedMotionVariants(variants: Variants): Variants {
  const reducedVariants: Variants = {};
  
  Object.keys(variants).forEach(key => {
    const variant = variants[key];
    if (typeof variant === 'object' && variant !== null) {
      reducedVariants[key] = {
        ...variant,
        transition: { duration: 0 }
      };
    } else {
      reducedVariants[key] = variant;
    }
  });
  
  return reducedVariants;
}

// Preset configurations for common components
export const presets = {
  card: {
    initial: "rest",
    animate: "rest",
    whileHover: "hover",
    variants: cardHoverVariants,
  },
  button: {
    initial: "rest",
    animate: "rest", 
    whileHover: "hover",
    whileTap: "tap",
    variants: buttonHoverVariants,
  },
  slideUp: {
    initial: "hidden",
    animate: "visible",
    exit: "exit",
    variants: slideUpVariants,
  },
  fade: {
    initial: "hidden",
    animate: "visible", 
    exit: "exit",
    variants: fadeVariants,
  },
  dropdown: {
    initial: "hidden",
    animate: "visible",
    exit: "exit",
    variants: dropdownVariants,
  },
  spinner: {
    animate: "spin",
    variants: spinVariants,
  }
} as const;