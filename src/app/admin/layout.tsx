import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/etl", label: "ETL" },
  { href: "/admin/models", label: "Models" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/config", label: "Config" },
] as const;

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6">
        <aside className="w-56 shrink-0">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Admin
            </div>
            <nav aria-label="Admin">
              <ul className="flex flex-col gap-1 text-sm">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      className="block rounded-md px-3 py-2 text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
        <main className="flex-1">
          <div className="h-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
