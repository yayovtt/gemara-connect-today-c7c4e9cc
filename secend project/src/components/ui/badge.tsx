import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-all shadow-sm",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy text-white hover:bg-navy-light",
        secondary: "border-transparent bg-gold text-navy hover:bg-gold-dark shadow-md",
        destructive: "border-transparent bg-navy text-white hover:bg-navy-light",
        outline: "text-navy border-gold hover:bg-gold/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
