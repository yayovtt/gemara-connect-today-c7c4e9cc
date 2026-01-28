import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-gold bg-white px-4 py-2 text-base text-navy ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-navy placeholder:text-navy/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:border-gold disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-sm transition-all",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
