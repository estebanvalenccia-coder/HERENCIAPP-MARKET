import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  Plus,
  Tag,
  ShoppingBag,
  Image as ImageIcon,
  Settings,
  Lock,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Calculator,
  Flower2,
  Sparkles,
  DollarSign,
  Layers3,
  CreditCard,
  Brain,
  Truck,
  Activity,
  Rocket,
  Users,
  Building2,
  Boxes,
  Trash2,
  Workflow,
  DatabaseBackup,
  ShoppingCart,
  Megaphone,
  ClipboardCheck,
  History,
  Warehouse,
  ScanLine,
  BarChart3,
  Bot,
  MessageCircleHeart,
  Globe2,
} from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { AdminProducts } from "../components/admin/AdminProducts";
import { AdminAddProduct } from "../components/admin/AdminAddProduct";
import { AdminBulkProductImport } from "../components/admin/AdminBulkProductImport";
import { AdminCollectionsManager } from "../components/admin/AdminCollectionsManager";
import { AdminOffers } from "../components/admin/AdminOffers";
import { AdminPublications } from "../components/admin/AdminPublications";
import { AdminContent } from "../components/admin/AdminContent";
import { AdminSettings } from "../components/admin/AdminSettings";
import { AdminDashboardHome } from "../components/admin/AdminDashboardHome";
import { AdminOrders } from "../components/admin/AdminOrders";
import { AdminSalesCalculator } from "../components/admin/AdminSalesCalculator";
import { AdminFlowerCosts } from "../components/admin/AdminFlowerCosts";
import { AdminBouquetCatalog } from "../components/admin/AdminBouquetCatalog";
import { AdminAIBouquetDesigner } from "../components/admin/AdminAIBouquetDesigner";
import { AdminFinance } from "../components/admin/AdminFinance";
import { AdminPOS } from "../components/admin/AdminPOS";
import { AdminHerenciaNeural } from "../components/admin/AdminHerenciaNeural";
import { AdminDeliveryPanel } from "../components/admin/AdminDeliveryPanel";
import { AdminSystemAudit } from "../components/admin/AdminSystemAudit";
import { AdminBusinessSuite } from "../components/admin/AdminBusinessSuite";
import { AdminCRMClients } from "../components/admin/AdminCRMClients";
import { AdminSuppliersPanel } from "../components/admin/AdminSuppliersPanel";
import { AdminStockControl } from "../components/admin/AdminStockControl";
import { AdminWasteControl } from "../components/admin/AdminWasteControl";
import { AdminAutomationCenter } from "../components/admin/AdminAutomationCenter";
import { AdminBackupCenter } from "../components/admin/AdminBackupCenter";
import { AdminAbandonedCarts } from "../components/admin/AdminAbandonedCarts";
import { AdminMarketingHub } from "../components/admin/AdminMarketingHub";
import { AdminOperationsBoard } from "../components/admin/AdminOperationsBoard";
import { AdminActivityLog } from "../components/admin/AdminActivityLog";
import { AdminInventoryLocations } from "../components/admin/AdminInventoryLocations";
import { AdminInventoryLots } from "../components/admin/AdminInventoryLots";
import { AdminAnalytics } from "../components/admin/AdminAnalytics";
import { AdminHerenciaSales } from "../components/admin/AdminHerenciaSales";
import { AdminCommunity } from "../components/admin/AdminCommunity";
import { AdminInternationalDelivery } from "../components/admin/AdminInternationalDelivery";
import { NeuralTestButton } from "../components/admin/NeuralTestButton"; // <-- new import

type AdminSection =
  | "dashboard"
  | "analytics"
  | "herencia-sales"
  | "products"
  | "add-product"
  | "bulk-product-import"
  | "collections"
  | "pos"
  | "ai-bouquet-designer"
  | "offers"
  | "publications"
  | "orders"
  | "finance"
  | "calculator"
  | "flower-costs"
  | "bouquet-catalog"
  | "content"
  | "community"
  | "international-delivery"
  | "delivery"
  | "neural"
  | "audit"
  | "business-suite"
  | "crm"
  | "suppliers"
  | "stock"
  | "waste"
  | "automations"
  | "backups"
  | "abandoned-carts"
  | "marketing-hub"
  | "operations-board"
  | "activity-log"
  | "inventory-locations"
  | "inventory-lots"
  | "settings";

// ... (rest of the original file unchanged until the header JSX) 

export function AdminDashboard() {
  // ... (all existing hooks and logic remain unchanged)

  return (
    <div className="min-h-screen bg-background flex">
      {/* ... sidebar omitted for brevity ... */}

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-40 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {/* ... existing left side ... */}
              </div>

              <div className="flex items-center gap-3">
                {/* Existing search, notifications, view site buttons */}
                <div className="hidden md:flex relative">
                  {/* ... search input ... */}
                </div>

                <div className="relative">
                  {/* ... notifications button ... */}
                </div>

                {/* NEW Neural Test Button */}
                <NeuralTestButton />

                <button
                  onClick={() => navigate("/")}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg transition-colors text-sm font-medium"
                >
                  Ver Sitio
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ... main content unchanged ... */}
      </div>

      {/* ... overlay for mobile sidebar ... */}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
