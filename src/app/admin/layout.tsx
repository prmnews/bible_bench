"use client";

import type { ReactNode } from "react";
import { AdminSidebar, AdminSidebarMobileTrigger } from "@/components/admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b px-4 lg:px-6">
          <AdminSidebarMobileTrigger />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto h-full w-full max-w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
