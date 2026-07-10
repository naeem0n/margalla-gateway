import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Search, Plus, Trash2, Edit3, Download, TrendingUp, Wallet, Package, RefreshCw, BarChart2, Home, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api-client";
import { downloadManualAssetsPDF, downloadApartmentAssetsPDF, downloadInventoryStockPDF } from "@/lib/pdf";

export const Route = createFileRoute("/admin/assets-inventory")({
  component: AssetsInventoryPage,
});

type ManualAsset = {
  id?: number;
  asset_code: string;
  asset_name: string;
  category: string;
  purchase_rate: number;
  current_manual_rate: number;
  remarks: string | null;
};

type ApartmentAsset = {
  id?: number;
  asset_code: string;
  apartment_no: string;
  asset_name: string;
  category: string;
  purchase_rate: number;
  current_manual_rate: number;
  remarks: string | null;
};

type InventoryItem = {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
};

type ApartmentOption = {
  id: string;
  number: string;
};

// Connected Apartment Inventory List Component
export function ApartmentInventoryList({ searchResults, loading }: { searchResults: any; loading: boolean }) {
  return (
    <div className="w-full overflow-x-auto">
      {/* Total connected value summary layout banner */}
      <div className="mb-6 bg-slate-950 p-6 rounded-lg border border-amber-500/30 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-500" />
            Total Connected Apartment Wealth
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Aggregated manual valuations of all registered assets in units</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-amber-500 font-mono">
            PKR {Number(searchResults?.grand_inventory_rate || 0).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="border border-border/40 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="p-3 pl-4">Apartment No</th>
              <th className="p-3">Item / Inventory Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Manual Valuation</th>
              <th className="p-3 pl-6">Location / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Searching interconnected stock...
                </td>
              </tr>
            ) : !searchResults?.results || searchResults.results.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No interconnected assets matched the search.
                </td>
              </tr>
            ) : (
              searchResults.results.map((item: any) => (
                <tr key={item.AssetID} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 pl-4 font-semibold text-amber-500 font-mono">Apt {item.ApartmentNo}</td>
                  <td className="p-3 font-medium">{item.ItemName}</td>
                  <td className="p-3 text-xs">
                    <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground font-semibold border border-border/50">
                      {item.Category}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-success font-mono">PKR {Number(item.CurrentRate).toLocaleString()}</td>
                  <td className="p-3 pl-6 text-muted-foreground text-xs">{item.StatusRemarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssetsInventoryPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"company-assets" | "apartment-assets" | "inventory">("company-assets");
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Apartment Sub-tab state
  const [aptSubView, setAptSubView] = useState<"manage" | "connected-search">("manage");

  // Apartments options for dropdown
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);

  // Company Assets state
  const [companyAssets, setCompanyAssets] = useState<ManualAsset[]>([]);
  const [loadingCompanyAssets, setLoadingCompanyAssets] = useState(true);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompanyAsset, setEditingCompanyAsset] = useState<ManualAsset | null>(null);
  
  const [companyForm, setCompanyForm] = useState({
    asset_code: "",
    asset_name: "",
    category: "Furniture",
    quantity: "1",
    purchase_rate: "",
    current_manual_rate: "",
    remarks: "",
  });

  // Apartment Assets state
  const [apartmentAssets, setApartmentAssets] = useState<ApartmentAsset[]>([]);
  const [loadingApartmentAssets, setLoadingApartmentAssets] = useState(true);
  const [apartmentDialogOpen, setApartmentDialogOpen] = useState(false);
  const [editingApartmentAsset, setEditingApartmentAsset] = useState<ApartmentAsset | null>(null);

  const [apartmentForm, setApartmentForm] = useState({
    asset_code: "",
    apartment_no: "",
    asset_name: "",
    category: "Appliances",
    quantity: "1",
    purchase_rate: "",
    current_manual_rate: "",
    remarks: "",
  });

  // Interconnected search state
  const [aptSearchVal, setAptSearchVal] = useState("");
  const [aptSearchResults, setAptSearchResults] = useState<{ results: any[]; grand_inventory_rate: number } | null>(null);
  const [loadingAptSearch, setLoadingAptSearch] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null);

  const [inventoryForm, setInventoryForm] = useState({
    item_id: "",
    item_name: "",
    quantity: "0",
    unit_cost: "0",
  });

  // Adjust stock state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "subtract">("add");

  // Load company assets
  const loadCompanyAssets = async () => {
    setLoadingCompanyAssets(true);
    try {
      const { data, error } = await supabase.from("manual_assets" as any).select("*");
      if (error) throw error;
      setCompanyAssets((data || []) as ManualAsset[]);
    } catch (e: any) {
      console.error("Failed to load company assets:", e);
      toast.error("Failed to load company assets: " + e.message);
    } finally {
      setLoadingCompanyAssets(false);
    }
  };

  // Load apartment assets
  const loadApartmentAssets = async () => {
    setLoadingApartmentAssets(true);
    try {
      const { data, error } = await supabase.from("apartment_manual_assets" as any).select("*");
      if (error) throw error;
      setApartmentAssets((data || []) as ApartmentAsset[]);
    } catch (e: any) {
      console.error("Failed to load apartment assets:", e);
      toast.error("Failed to load apartment assets: " + e.message);
    } finally {
      setLoadingApartmentAssets(false);
    }
  };

  // Load inventory
  const loadInventory = async () => {
    setLoadingInventory(true);
    try {
      const { data, error } = await supabase.from("inventory_stock" as any).select("*");
      if (error) throw error;
      setInventory((data || []) as InventoryItem[]);
    } catch (e: any) {
      console.error("Failed to load inventory stock:", e);
      toast.error("Failed to load inventory stock: " + e.message);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Load apartments options
  const loadApartments = async () => {
    try {
      const res = await apiFetch<{ apartments: any[] }>("/apartments");
      if (res && res.apartments) {
        setApartments(res.apartments.map(a => ({
          id: a.id,
          number: a.number
        })).sort((a, b) => (a.number || "").localeCompare(b.number || "")));
      }
    } catch (e) {
      console.error("Failed to load apartments options:", e);
    }
  };

  // Run interconnected global search
  const triggerInterconnectedSearch = async (queryVal: string) => {
    setLoadingAptSearch(true);
    try {
      const res = await apiFetch<any>(`/apartments/inventory-search?q=${encodeURIComponent(queryVal)}`);
      setAptSearchResults(res);
    } catch (e: any) {
      console.error("Interconnected search failed:", e);
      toast.error("Search failed: " + e.message);
    } finally {
      setLoadingAptSearch(false);
    }
  };

  useEffect(() => {
    loadCompanyAssets();
    loadApartmentAssets();
    loadInventory();
    loadApartments();
    triggerInterconnectedSearch("");
  }, []);

  // Compute stats for company assets
  const companyStats = useMemo(() => {
    const totalOriginalCost = companyAssets.reduce((sum, a) => sum + Number(a.purchase_rate || 0), 0);
    const totalCurrentValue = companyAssets.reduce((sum, a) => sum + Number(a.current_manual_rate || 0), 0);
    const totalDepreciation = Math.max(0, totalOriginalCost - totalCurrentValue);
    return {
      count: companyAssets.length,
      originalCost: totalOriginalCost,
      currentValue: totalCurrentValue,
      depreciation: totalDepreciation,
    };
  }, [companyAssets]);

  // Compute stats for apartment assets
  const aptStats = useMemo(() => {
    const totalOriginalCost = apartmentAssets.reduce((sum, a) => sum + Number(a.purchase_rate || 0), 0);
    const totalCurrentValue = apartmentAssets.reduce((sum, a) => sum + Number(a.current_manual_rate || 0), 0);
    const totalDepreciation = Math.max(0, totalOriginalCost - totalCurrentValue);
    return {
      count: apartmentAssets.length,
      originalCost: totalOriginalCost,
      currentValue: totalCurrentValue,
      depreciation: totalDepreciation,
    };
  }, [apartmentAssets]);

  // Compute stats for inventory
  const inventoryStats = useMemo(() => {
    const totalQty = inventory.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    const totalVal = inventory.reduce((sum, i) => sum + Number(i.total_value || 0), 0);
    return {
      typesCount: inventory.length,
      totalQuantity: totalQty,
      valuation: totalVal,
    };
  }, [inventory]);

  // Filtered Company Assets
  const filteredCompanyAssets = useMemo(() => {
    return companyAssets.filter((a) => {
      const matchesSearch = 
        a.asset_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.remarks || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === "all" || a.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [companyAssets, searchQuery, categoryFilter]);

  // Filtered Apartment Assets
  const filteredApartmentAssets = useMemo(() => {
    return apartmentAssets.filter((a) => {
      const matchesSearch = 
        a.asset_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.apartment_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.remarks || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === "all" || a.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [apartmentAssets, searchQuery, categoryFilter]);

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((i) => {
      return (
        i.item_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [inventory, searchQuery]);

  // Handle open dialogs for Company Assets
  const openAddCompanyAsset = () => {
    setEditingCompanyAsset(null);
    const nextIdNum = companyAssets.length > 0
      ? Math.max(...companyAssets.map(a => {
          const match = a.asset_code.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })) + 1
      : 101;
    const formattedId = `AST-${nextIdNum}`;

    setCompanyForm({
      asset_code: formattedId,
      asset_name: "",
      category: "Furniture",
      purchase_rate: "",
      current_manual_rate: "",
      remarks: "",
    });
    setCompanyDialogOpen(true);
  };

  const openEditCompanyAsset = (asset: ManualAsset) => {
    setEditingCompanyAsset(asset);
    setCompanyForm({
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      category: asset.category,
      purchase_rate: String(asset.purchase_rate),
      current_manual_rate: String(asset.current_manual_rate),
      remarks: asset.remarks || "",
    });
    setCompanyDialogOpen(true);
  };

  // Handle open dialogs for Apartment Assets
  const openAddApartmentAsset = () => {
    setEditingApartmentAsset(null);
    const nextIdNum = apartmentAssets.length > 0
      ? Math.max(...apartmentAssets.map(a => {
          const match = a.asset_code.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        })) + 1
      : 101;
    
    const defaultAptNo = apartments[0]?.number || "";
    const formattedId = `APT-${defaultAptNo}-${nextIdNum}`;

    setApartmentForm({
      asset_code: formattedId,
      apartment_no: defaultAptNo,
      asset_name: "",
      category: "Appliances",
      purchase_rate: "",
      current_manual_rate: "",
      remarks: "",
    });
    setApartmentDialogOpen(true);
  };

  const openEditApartmentAsset = (asset: ApartmentAsset) => {
    setEditingApartmentAsset(asset);
    setApartmentForm({
      asset_code: asset.asset_code,
      apartment_no: asset.apartment_no,
      asset_name: asset.asset_name,
      category: asset.category,
      purchase_rate: String(asset.purchase_rate),
      current_manual_rate: String(asset.current_manual_rate),
      remarks: asset.remarks || "",
    });
    setApartmentDialogOpen(true);
  };

  // Update asset code in form when apartment number changes
  const handleAptNoChange = (aptNo: string) => {
    const nextIdNum = apartmentAssets.length > 0
      ? Math.max(...apartmentAssets.map(a => {
          const match = a.asset_code.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        })) + 1
      : 101;
    setApartmentForm((prev) => ({
      ...prev,
      apartment_no: aptNo,
      asset_code: `APT-${aptNo}-${nextIdNum}`
    }));
  };

  // Handle open dialogs for Inventory
  const openAddInventory = () => {
    setEditingInventory(null);
    const nextIdNum = inventory.length > 0
      ? Math.max(...inventory.map(i => {
          const match = i.item_id.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })) + 1
      : 1;
    const formattedId = `INV-${String(nextIdNum).padStart(3, "0")}`;

    setInventoryForm({
      item_id: formattedId,
      item_name: "",
      quantity: "0",
      unit_cost: "0",
    });
    setInventoryDialogOpen(true);
  };

  const openEditInventory = (item: InventoryItem) => {
    setEditingInventory(item);
    setInventoryForm({
      item_id: item.item_id,
      item_name: item.item_name,
      quantity: String(item.quantity),
      unit_cost: String(item.unit_cost),
    });
    setInventoryDialogOpen(true);
  };

  const openAdjustStock = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustQty("");
    setAdjustType("add");
    setAdjustDialogOpen(true);
  };

  // Submit Company Asset CRUD
  const saveCompanyAsset = async () => {
    if (!companyForm.asset_code || !companyForm.asset_name || !companyForm.purchase_rate || !companyForm.current_manual_rate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const payload = {
      asset_code: companyForm.asset_code.trim(),
      asset_name: companyForm.asset_name.trim(),
      category: companyForm.category,
      purchase_rate: Number(companyForm.purchase_rate),
      current_manual_rate: Number(companyForm.current_manual_rate),
      remarks: companyForm.remarks.trim() || null,
    };

    try {
      if (editingCompanyAsset) {
        const { error } = await supabase
          .from("manual_assets" as any)
          .update(payload)
          .eq("id", editingCompanyAsset.id);
        if (error) throw error;
        toast.success("Company asset updated successfully");
      } else {
        const qty = Math.max(1, Number(companyForm.quantity) || 1);
        const payloads = Array(qty).fill(null).map((_, i) => ({
          ...payload,
          asset_code: qty > 1 ? `${payload.asset_code}-${i + 1}` : payload.asset_code,
        }));
        const { error } = await supabase
          .from("manual_assets" as any)
          .insert(payloads);
        if (error) throw error;

        // Post purchase cost to ledger
        const totalCost = Number(payload.purchase_rate) * qty;
        if (totalCost > 0) {
          try {
            await apiFetch("/ledger", {
              method: "POST",
              body: JSON.stringify({
                user_id: "system",
                entry_date: new Date().toISOString().slice(0, 10),
                entry_type: "other",
                description: `[Company Asset Purchase] ${qty}x ${companyForm.asset_name} (${companyForm.category}) - Code: ${payload.asset_code}`,
                debit: totalCost,
                credit: 0
              })
            });
          } catch (e2) {
            console.error("Ledger post failed for asset:", e2);
          }
        }

        toast.success(`Company asset(s) added successfully (${qty} items)`);
      }
      setCompanyDialogOpen(false);
      loadCompanyAssets();
    } catch (e: any) {
      console.error("Failed to save company asset:", e);
      toast.error("Failed to save company asset: " + e.message);
    }
  };

  const deleteCompanyAsset = async (id: number) => {
    if (!confirm("Are you sure you want to delete this company asset?")) return;
    try {
      const { error } = await supabase
        .from("manual_assets" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Company asset deleted successfully");
      loadCompanyAssets();
    } catch (e: any) {
      console.error("Failed to delete company asset:", e);
      toast.error("Failed to delete company asset: " + e.message);
    }
  };

  // Submit Apartment Asset CRUD
  const saveApartmentAsset = async () => {
    if (!apartmentForm.asset_code || !apartmentForm.apartment_no || !apartmentForm.asset_name || !apartmentForm.purchase_rate || !apartmentForm.current_manual_rate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const payload = {
      asset_code: apartmentForm.asset_code.trim(),
      apartment_no: apartmentForm.apartment_no,
      asset_name: apartmentForm.asset_name.trim(),
      category: apartmentForm.category,
      purchase_rate: Number(apartmentForm.purchase_rate),
      current_manual_rate: Number(apartmentForm.current_manual_rate),
      remarks: apartmentForm.remarks.trim() || null,
    };

    try {
      if (editingApartmentAsset) {
        const { error } = await supabase
          .from("apartment_manual_assets" as any)
          .update(payload)
          .eq("id", editingApartmentAsset.id);
        if (error) throw error;
        toast.success("Apartment asset updated successfully");
      } else {
        const qty = Math.max(1, Number(apartmentForm.quantity) || 1);
        const payloads = Array(qty).fill(null).map((_, i) => ({
          ...payload,
          asset_code: qty > 1 ? `${payload.asset_code}-${i + 1}` : payload.asset_code,
        }));
        const { error } = await supabase
          .from("apartment_manual_assets" as any)
          .insert(payloads);
        if (error) throw error;

        // Post purchase cost to ledger
        const totalCost = Number(payload.purchase_rate) * qty;
        if (totalCost > 0) {
          try {
            await apiFetch("/ledger", {
              method: "POST",
              body: JSON.stringify({
                user_id: "system",
                entry_date: new Date().toISOString().slice(0, 10),
                entry_type: "other",
                description: `[Apartment Asset Purchase] ${qty}x ${apartmentForm.asset_name} for Apt ${apartmentForm.apartment_no} (${apartmentForm.category}) - Code: ${payload.asset_code}`,
                debit: totalCost,
                credit: 0
              })
            });
          } catch (e2) {
            console.error("Ledger post failed for apartment asset:", e2);
          }
        }

        toast.success(`Apartment asset(s) added successfully (${qty} items)`);
      }
      setApartmentDialogOpen(false);
      loadApartmentAssets();
      triggerInterconnectedSearch(aptSearchVal);
    } catch (e: any) {
      console.error("Failed to save apartment asset:", e);
      toast.error("Failed to save apartment asset: " + e.message);
    }
  };

  const deleteApartmentAsset = async (id: number) => {
    if (!confirm("Are you sure you want to delete this apartment asset?")) return;
    try {
      const { error } = await supabase
        .from("apartment_manual_assets" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Apartment asset deleted successfully");
      loadApartmentAssets();
      triggerInterconnectedSearch(aptSearchVal);
    } catch (e: any) {
      console.error("Failed to delete apartment asset:", e);
      toast.error("Failed to delete apartment asset: " + e.message);
    }
  };

  // Submit inventory CRUD
  const saveInventory = async () => {
    if (!inventoryForm.item_id || !inventoryForm.item_name) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const payload = {
      item_id: inventoryForm.item_id.trim(),
      item_name: inventoryForm.item_name.trim(),
      quantity: Number(inventoryForm.quantity),
      unit_cost: Number(inventoryForm.unit_cost),
    };

    try {
      if (editingInventory) {
        const { error } = await supabase
          .from("inventory_stock" as any)
          .update(payload)
          .eq("item_id", editingInventory.item_id);
        if (error) throw error;
        toast.success("Inventory item updated successfully");
      } else {
        const { error } = await supabase
          .from("inventory_stock" as any)
          .insert(payload);
        if (error) throw error;
        toast.success("Inventory item added successfully");
      }
      setInventoryDialogOpen(false);
      loadInventory();
    } catch (e: any) {
      console.error("Failed to save inventory item:", e);
      toast.error("Failed to save inventory item: " + e.message);
    }
  };

  const adjustStock = async () => {
    if (!adjustItem || !adjustQty) return;
    const qtyChange = Number(adjustQty);
    if (isNaN(qtyChange) || qtyChange <= 0) {
      toast.error("Please enter a valid positive quantity.");
      return;
    }

    const newQty = adjustType === "add"
      ? adjustItem.quantity + qtyChange
      : Math.max(0, adjustItem.quantity - qtyChange);

    try {
      const { error } = await supabase
        .from("inventory_stock" as any)
        .update({ quantity: newQty })
        .eq("item_id", adjustItem.item_id);
      if (error) throw error;
      toast.success(`Stock adjusted successfully. New Qty: ${newQty}`);
      setAdjustDialogOpen(false);
      loadInventory();
    } catch (e: any) {
      console.error("Failed to adjust stock:", e);
      toast.error("Failed to adjust stock: " + e.message);
    }
  };

  const deleteInventory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inventory item?")) return;
    try {
      const { error } = await supabase
        .from("inventory_stock" as any)
        .delete()
        .eq("item_id", id);
      if (error) throw error;
      toast.success("Inventory item deleted successfully");
      loadInventory();
    } catch (e: any) {
      console.error("Failed to delete inventory:", e);
      toast.error("Failed to delete inventory: " + e.message);
    }
  };

  // Export reports
  const exportCompanyAssetsReport = () => {
    downloadManualAssetsPDF(companyAssets);
    toast.success("Company assets report downloaded");
  };

  const exportApartmentAssetsReport = () => {
    downloadApartmentAssetsPDF(apartmentAssets);
    toast.success("Apartment assets report downloaded");
  };

  const exportInventoryReport = () => {
    downloadInventoryStockPDF(inventory);
    toast.success("Inventory stock report downloaded");
  };

  const fmt = (n: number) => "PKR " + n.toLocaleString();

  return (
    <AdminLayout title="Fixed Assets & Inventory">
      {/* Tab Selector */}
      <div className="flex border-b border-border/60 mb-6 gap-2 flex-wrap">
        <button
          onClick={() => { setActiveTab("company-assets"); setSearchQuery(""); setCategoryFilter("all"); }}
          className={`px-4 py-2.5 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === "company-assets"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Company Fixed Assets
        </button>
        <button
          onClick={() => { setActiveTab("apartment-assets"); setSearchQuery(""); setCategoryFilter("all"); }}
          className={`px-4 py-2.5 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === "apartment-assets"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="h-4 w-4" />
          Apartment Manual Assets
        </button>
        <button
          onClick={() => { setActiveTab("inventory"); setSearchQuery(""); setCategoryFilter("all"); }}
          className={`px-4 py-2.5 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === "inventory"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Boxes className="h-4 w-4" />
          Maintenance Inventory Stock
        </button>
      </div>

      {/* Stats Cards */}
      {activeTab === "company-assets" ? (
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={TrendingUp} label="Total Original Cost" value={fmt(companyStats.originalCost)} accent="primary" />
          <StatCard icon={Wallet} label="Net Book Value (Current)" value={fmt(companyStats.currentValue)} accent="success" />
          <StatCard icon={Trash2} label="Accumulated Value Adjustment" value={fmt(companyStats.depreciation)} accent="destructive" />
        </div>
      ) : activeTab === "apartment-assets" ? (
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={TrendingUp} label="Apt Assets Cost" value={fmt(aptStats.originalCost)} accent="primary" />
          <StatCard icon={Wallet} label="Current Evaluation" value={fmt(aptStats.currentValue)} accent="success" />
          <StatCard icon={Trash2} label="Accumulated Difference" value={fmt(aptStats.depreciation)} accent="destructive" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={Package} label="Total Unique Items" value={String(inventoryStats.typesCount)} accent="primary" />
          <StatCard icon={Boxes} label="Total Units in Stock" value={Number(inventoryStats.totalQuantity).toLocaleString()} accent="success" />
          <StatCard icon={Wallet} label="Total Stock Valuation" value={fmt(inventoryStats.valuation)} accent="primary" />
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-card border border-border/60 rounded-lg p-6">
        {/* Apartment sub-tabs toggle */}
        {activeTab === "apartment-assets" && (
          <div className="flex bg-muted/60 p-1 rounded-md mb-6 w-fit border border-border/40">
            <button
              onClick={() => setAptSubView("manage")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition ${
                aptSubView === "manage"
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Manage & Add Assets
            </button>
            <button
              onClick={() => { setAptSubView("connected-search"); triggerInterconnectedSearch(aptSearchVal); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition ${
                aptSubView === "connected-search"
                  ? "bg-card text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Connected Inventory Search & Wealth
            </button>
          </div>
        )}

        {/* Controls Toolbar */}
        {!(activeTab === "apartment-assets" && aptSubView === "connected-search") ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    activeTab === "company-assets" ? "Search asset by code, name, remarks..." :
                    activeTab === "apartment-assets" ? "Search by code, apt #, name, remarks..." :
                    "Search stock by ID or name..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full bg-input/40"
                />
              </div>
              {activeTab === "company-assets" && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Furniture">Furniture</SelectItem>
                    <SelectItem value="Fixture">Fixture</SelectItem>
                    <SelectItem value="Appliance">Appliance</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {activeTab === "apartment-assets" && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Furniture">Furniture</SelectItem>
                    <SelectItem value="Appliances">Appliances</SelectItem>
                    <SelectItem value="Sanitary">Sanitary</SelectItem>
                    <SelectItem value="Fittings">Fittings</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {activeTab === "company-assets" ? (
                <>
                  <Button onClick={openAddCompanyAsset}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Company Asset
                  </Button>
                  <Button variant="outline" onClick={exportCompanyAssetsReport}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download Report
                  </Button>
                </>
              ) : activeTab === "apartment-assets" ? (
                <>
                  <Button onClick={openAddApartmentAsset}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Apartment Asset
                  </Button>
                  <Button variant="outline" onClick={exportApartmentAssetsReport}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download Report
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={openAddInventory}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Stock Item
                  </Button>
                  <Button variant="outline" onClick={exportInventoryReport}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download Report
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Connected Search Toolbar */
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search connected inventory by flat #, item name, or category..."
                  value={aptSearchVal}
                  onChange={(e) => {
                    setAptSearchVal(e.target.value);
                    triggerInterconnectedSearch(e.target.value);
                  }}
                  className="pl-9 w-full bg-input/40"
                />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => triggerInterconnectedSearch(aptSearchVal)}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Tables & Custom Components */}
        {activeTab === "company-assets" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Asset Code</th>
                  <th className="text-left px-4 py-3">Asset Name</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Original Rate</th>
                  <th className="text-right px-4 py-3">Current Manual Rate</th>
                  <th className="text-left px-4 py-3">Remarks / Location</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loadingCompanyAssets ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Loading company assets...</td></tr>
                ) : filteredCompanyAssets.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No company assets found.</td></tr>
                ) : filteredCompanyAssets.map((a) => (
                  <tr key={a.id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold">{a.asset_code}</td>
                    <td className="px-4 py-3 font-medium">{a.asset_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        a.category === "Furniture" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        a.category === "Fixture" ? "bg-teal-500/10 text-teal-500 border border-teal-500/20" :
                        a.category === "Appliance" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                      }`}>
                        {a.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{Number(a.purchase_rate).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">{Number(a.current_manual_rate).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{a.remarks || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openEditCompanyAsset(a)} className="hover:bg-secondary">
                        <Edit3 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteCompanyAsset(a.id!)} className="hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "apartment-assets" ? (
          aptSubView === "manage" ? (
            /* Apartment Manual Assets Manage Grid */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Asset Code</th>
                    <th className="text-left px-4 py-3">Apartment #</th>
                    <th className="text-left px-4 py-3">Asset Name</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-right px-4 py-3">Original Rate</th>
                    <th className="text-right px-4 py-3">Current Manual Rate</th>
                    <th className="text-left px-4 py-3">Remarks / Location</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingApartmentAssets ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Loading apartment assets...</td></tr>
                  ) : filteredApartmentAssets.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No apartment manual assets found.</td></tr>
                  ) : filteredApartmentAssets.map((a) => (
                    <tr key={a.id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold">{a.asset_code}</td>
                      <td className="px-4 py-3 font-semibold text-primary font-mono">Apt {a.apartment_no}</td>
                      <td className="px-4 py-3 font-medium">{a.asset_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          a.category === "Furniture" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                          a.category === "Appliances" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                          a.category === "Sanitary" ? "bg-teal-500/10 text-teal-500 border border-teal-500/20" :
                          "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                        }`}>
                          {a.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{Number(a.purchase_rate).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-success">{Number(a.current_manual_rate).toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{a.remarks || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openEditApartmentAsset(a)} className="hover:bg-secondary">
                          <Edit3 className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteApartmentAsset(a.id!)} className="hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Interconnected Apartment Inventory search results component list view */
            <ApartmentInventoryList searchResults={aptSearchResults} loading={loadingAptSearch} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Item ID</th>
                  <th className="text-left px-4 py-3">Item Name</th>
                  <th className="text-right px-4 py-3">Quantity</th>
                  <th className="text-right px-4 py-3">Unit Cost</th>
                  <th className="text-right px-4 py-3">Total Value</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loadingInventory ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Loading inventory...</td></tr>
                ) : filteredInventory.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No inventory stock found.</td></tr>
                ) : filteredInventory.map((i) => (
                  <tr key={i.item_id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold">{i.item_id}</td>
                    <td className="px-4 py-3 font-medium">{i.item_name}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={`px-2 py-0.5 rounded font-mono ${
                        i.quantity === 0 ? "bg-destructive/15 text-destructive" :
                        i.quantity <= 5 ? "bg-amber-500/15 text-amber-500" :
                        "bg-success/15 text-success"
                      }`}>
                        {i.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{Number(i.unit_cost).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-warning">{Number(i.total_value).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap gap-1 inline-flex">
                      <Button size="sm" variant="outline" onClick={() => openAdjustStock(i)} className="text-xs py-1 h-8">
                        Adjust Qty
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditInventory(i)} className="hover:bg-secondary h-8 w-8 p-0">
                        <Edit3 className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteInventory(i.item_id)} className="hover:bg-destructive/10 h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Company Asset Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent className="max-w-md bg-[#0b0f19] border border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{editingCompanyAsset ? "Edit Company Asset" : "Add Company Asset"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Asset Code *</Label>
                <Input
                  value={companyForm.asset_code}
                  onChange={(e) => setCompanyForm({ ...companyForm, asset_code: e.target.value })}
                  placeholder="AST-101"
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Category *</Label>
                <Select
                  value={companyForm.category}
                  onValueChange={(val) => setCompanyForm({ ...companyForm, category: val })}
                >
                  <SelectTrigger className="mt-1 bg-slate-900 border-slate-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="Society Asset">Society Asset</SelectItem>
                    <SelectItem value="Company Asset">Company Asset</SelectItem>
                    <SelectItem value="Furniture">Furniture & Decor</SelectItem>
                    <SelectItem value="Fixture">Fixtures & Fittings</SelectItem>
                    <SelectItem value="Appliance">Electrical Appliances</SelectItem>
                    <SelectItem value="Maintenance">Maintenance & Tools</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Asset Name *</Label>
                <Input
                  value={companyForm.asset_name}
                  onChange={(e) => setCompanyForm({ ...companyForm, asset_name: e.target.value })}
                  placeholder="Sofa Set Executive Room"
                  className="mt-1 bg-slate-900 border-slate-800 text-white"
                />
              </div>
              {!editingCompanyAsset && (
                <div>
                  <Label className="text-slate-300">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={companyForm.quantity}
                    onChange={(e) => setCompanyForm({ ...companyForm, quantity: e.target.value })}
                    className="mt-1 bg-slate-900 border-slate-800 text-white"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Original Purchase Rate (PKR) *</Label>
                <Input
                  type="number"
                  value={companyForm.purchase_rate}
                  onChange={(e) => setCompanyForm({ ...companyForm, purchase_rate: e.target.value })}
                  placeholder="45000"
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Current Manual Rate (PKR) *</Label>
                <Input
                  type="number"
                  value={companyForm.current_manual_rate}
                  onChange={(e) => setCompanyForm({ ...companyForm, current_manual_rate: e.target.value })}
                  placeholder=""
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Remarks / Location</Label>
              <Input
                value={companyForm.remarks}
                onChange={(e) => setCompanyForm({ ...companyForm, remarks: e.target.value })}
                placeholder="Perfect condition, placed in reception lounge"
                className="mt-1 bg-slate-900 border-slate-800 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800" onClick={() => setCompanyDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#d4af37] text-black hover:bg-[#d4af37]/80" onClick={saveCompanyAsset}>Save Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apartment Asset Dialog */}
      <Dialog open={apartmentDialogOpen} onOpenChange={setApartmentDialogOpen}>
        <DialogContent className="max-w-md bg-[#0b0f19] border border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{editingApartmentAsset ? "Edit Apartment Asset" : "Add Apartment Asset"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Apartment # *</Label>
                <Select
                  value={apartmentForm.apartment_no}
                  onValueChange={handleAptNoChange}
                >
                  <SelectTrigger className="mt-1 bg-slate-900 border-slate-800 text-white">
                    <SelectValue placeholder="Select Apartment" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {apartments.map((a) => (
                      <SelectItem key={a.id} value={a.number}>
                        Unit {a.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Category *</Label>
                <Select
                  value={apartmentForm.category}
                  onValueChange={(val) => setApartmentForm({ ...apartmentForm, category: val })}
                >
                  <SelectTrigger className="mt-1 bg-slate-900 border-slate-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="Owner Asset">Owner Asset</SelectItem>
                    <SelectItem value="Tenant Asset">Tenant Asset</SelectItem>
                    <SelectItem value="Furniture">Furniture & Decor</SelectItem>
                    <SelectItem value="Appliances">Electrical Appliances</SelectItem>
                    <SelectItem value="Sanitary">Sanitary & Plumbing</SelectItem>
                    <SelectItem value="Fittings">Permanent Fittings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Asset Code (Auto-generated) *</Label>
              <Input
                value={apartmentForm.asset_code}
                onChange={(e) => setApartmentForm({ ...apartmentForm, asset_code: e.target.value })}
                placeholder="APT-801-AC"
                className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Asset Name *</Label>
                <Input
                  value={apartmentForm.asset_name}
                  onChange={(e) => setApartmentForm({ ...apartmentForm, asset_name: e.target.value })}
                  placeholder="Inverter AC 1.5 Ton Haier"
                  className="mt-1 bg-slate-900 border-slate-800 text-white"
                />
              </div>
              {!editingApartmentAsset && (
                <div>
                  <Label className="text-slate-300">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={apartmentForm.quantity}
                    onChange={(e) => setApartmentForm({ ...apartmentForm, quantity: e.target.value })}
                    className="mt-1 bg-slate-900 border-slate-800 text-white"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Original Purchase Rate (PKR) *</Label>
                <Input
                  type="number"
                  value={apartmentForm.purchase_rate}
                  onChange={(e) => setApartmentForm({ ...apartmentForm, purchase_rate: e.target.value })}
                  placeholder="85000"
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Current Manual Rate (PKR) *</Label>
                <Input
                  type="number"
                  value={apartmentForm.current_manual_rate}
                  onChange={(e) => setApartmentForm({ ...apartmentForm, current_manual_rate: e.target.value })}
                  placeholder="75000"
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Remarks / Location</Label>
              <Input
                value={apartmentForm.remarks}
                onChange={(e) => setApartmentForm({ ...apartmentForm, remarks: e.target.value })}
                placeholder="Installed in Master Bedroom"
                className="mt-1 bg-slate-900 border-slate-800 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800" onClick={() => setApartmentDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#d4af37] text-black hover:bg-[#d4af37]/80" onClick={saveApartmentAsset}>Save Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent className="max-w-md bg-[#0b0f19] border border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{editingInventory ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label className="text-slate-300">Item ID *</Label>
                <Input
                  value={inventoryForm.item_id}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, item_id: e.target.value })}
                  placeholder="INV-001"
                  disabled={!!editingInventory}
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-300">Item Name *</Label>
                <Input
                  value={inventoryForm.item_name}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, item_name: e.target.value })}
                  placeholder="LED Bulb 12W"
                  className="mt-1 bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Initial Quantity</Label>
                <Input
                  type="number"
                  value={inventoryForm.quantity}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
                  disabled={!!editingInventory}
                  placeholder="50"
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Unit Cost (PKR)</Label>
                <Input
                  type="number"
                  value={inventoryForm.unit_cost}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, unit_cost: e.target.value })}
                  placeholder="450"
                  className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            {editingInventory && (
              <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded">
                <strong>Note:</strong> To modify stock quantities safely in production, use the "Adjust Qty" button on the grid list.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800" onClick={() => setInventoryDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#d4af37] text-black hover:bg-[#d4af37]/80" onClick={saveInventory}>Save Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-xs bg-[#0b0f19] border border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Adjust Stock Qty</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="text-sm font-medium text-slate-300 mb-1">
              Item: <span className="text-white">{adjustItem?.item_name}</span> (Current Qty: {adjustItem?.quantity})
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustType("add")}
                className={`py-2 text-xs rounded border font-semibold transition ${
                  adjustType === "add"
                    ? "bg-success/15 border-success text-success"
                    : "border-slate-800 hover:bg-slate-800 text-slate-300"
                }`}
              >
                Add Stock
              </button>
              <button
                type="button"
                onClick={() => setAdjustType("subtract")}
                className={`py-2 text-xs rounded border font-semibold transition ${
                  adjustType === "subtract"
                    ? "bg-destructive/15 border-destructive text-destructive"
                    : "border-slate-800 hover:bg-slate-800 text-slate-300"
                }`}
              >
                Issue / Reduce
              </button>
            </div>

            <div>
              <Label className="text-slate-300">Quantity to adjust</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="10"
                className="mt-1 font-mono bg-slate-900 border-slate-800 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800" size="sm" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#d4af37] text-black hover:bg-[#d4af37]/80" size="sm" onClick={adjustStock}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
