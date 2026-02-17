import { ReactNode } from "react";
import DashboardNav from "@/react-app/components/DashboardNav";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardNav />

      <div className="flex-1 max-w-[1200px] mx-auto px-6 py-8 w-full">
        {children}
      </div>
    </div>
  );
}
