import {
  BarChart3,
  LayoutDashboard,
  ListFilter,
  Mail,
  Megaphone,
  Radar,
  Send,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional badge count resolved at render time. */
  countKey?: "creators" | "rising";
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/creators", labelKey: "nav.creators", icon: Users, countKey: "creators" },
  { href: "/discover", labelKey: "nav.discover", icon: Radar },
  { href: "/lists", labelKey: "nav.lists", icon: ListFilter },
  { href: "/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
  { href: "/outreach", labelKey: "nav.outreach", icon: Send },
  { href: "/templates", labelKey: "nav.templates", icon: Mail },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
];
