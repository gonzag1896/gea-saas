"use client";

import { useEffect, useRef } from "react";

export function SidebarMarginAdjuster({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateMargin = () => {
      const aside = document.querySelector("aside");
      if (!aside || !containerRef.current) return;
      const sidebarWidth = aside.offsetWidth;
      containerRef.current.style.marginLeft = `${sidebarWidth}px`;
    };

    updateMargin();
    const observer = new ResizeObserver(updateMargin);
    const aside = document.querySelector("aside");
    if (aside) observer.observe(aside);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-1 flex-col transition-[margin-left] duration-150"
    >
      {children}
    </div>
  );
}
