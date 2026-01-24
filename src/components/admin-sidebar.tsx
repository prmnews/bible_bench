"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  X,
  House,
  Gear,
  Database,
  Robot,
  PlayCircle,
  FlagBanner,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: House },
  { href: "/admin/campaigns", label: "Campaigns", icon: FlagBanner },
  { href: "/admin/etl", label: "ETL", icon: Database },
  { href: "/admin/explorer", label: "Explorer", icon: MagnifyingGlass },
  { href: "/admin/models", label: "Models", icon: Robot },
  { href: "/admin/runs", label: "Runs", icon: PlayCircle },
  { href: "/admin/config", label: "Config", icon: Gear },
] as const;

interface AdminSidebarProps {
  className?: string;
}

function NavContent({ 
  mobile = false, 
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
}: { 
  mobile?: boolean;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className={cn("flex flex-col h-full", mobile && "pt-6")}>
      <div className={cn("px-4 py-3", mobile && "px-6")}>
        <div className="flex items-center justify-between">
          <h2 className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground", isCollapsed && !mobile && "hidden")}>
            Admin
          </h2>
          {!mobile && onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleCollapse}
            >
              {isCollapsed ? (
                <List className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <nav className="p-2" aria-label="Admin navigation">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground border-l-2 border-accent"
                        : "text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground",
                      isCollapsed && !mobile && "justify-center px-2"
                    )}
                    onClick={onNavigate}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {(!isCollapsed || mobile) && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </ScrollArea>
    </div>
  );
}

export function AdminSidebarMobileTrigger() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9"
          aria-label="Toggle sidebar"
        >
          <List className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <NavContent mobile onNavigate={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Load collapsed state from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("admin-sidebar-collapsed", JSON.stringify(newState));
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      <NavContent 
        isCollapsed={isCollapsed} 
        onToggleCollapse={toggleCollapse}
      />
    </aside>
  );
}
