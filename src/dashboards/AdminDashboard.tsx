import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  Activity,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building,
  Droplet,
  Zap,
  Flame,
  Search,
  Settings,
  HelpCircle,
  FileText
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getParkingRules, addParkingRule, updateParkingRule, deleteParkingRule, ParkingRule } from "@/lib/parking-rules-client";

export default function AdminDashboard({ user }: { user: any }) {
  const [searchTerm, setSearchTerm] = useState("");

  const [rules, setRules] = useState<ParkingRule[]>([]);
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [loadingRules, setLoadingRules] = useState(false);

  const fetchRules = async () => {
    setLoadingRules(true);
    const data = await getParkingRules();
    setRules(data);
    setLoadingRules(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleDesc.trim()) return;

    if (editingRuleId) {
      const success = await updateParkingRule(editingRuleId, ruleTitle.trim(), ruleDesc.trim());
      if (success) {
        setRules(rules.map(r => r.id === editingRuleId ? { ...r, title: ruleTitle.trim(), description: ruleDesc.trim() } : r));
        setEditingRuleId(null);
        setRuleTitle("");
        setRuleDesc("");
      }
    } else {
      const success = await addParkingRule(ruleTitle.trim(), ruleDesc.trim());
      if (success) {
        fetchRules();
        setRuleTitle("");
        setRuleDesc("");
      }
    }
  };

  const handleEditRule = (rule: ParkingRule) => {
    setEditingRuleId(rule.id);
    setRuleTitle(rule.title);
    setRuleDesc(rule.description);
  };

  const handleDeleteRule = async (id: string) => {
    const success = await deleteParkingRule(id);
    if (success) {
      setRules(rules.filter(r => r.id !== id));
    }
  };

  const [residents, setResidents] = useState([
    { id: "RES-101", name: "Muhammad Bilal", room: "Apt 101", status: "Active", pendingBill: 15500, utilities: { gas: 35, water: 40, elec: 80 } },
    { id: "RES-102", name: "Ayesha Khan", room: "Apt 204", status: "Active", pendingBill: 0, utilities: { gas: 20, water: 30, elec: 60 } },
    { id: "RES-103", name: "Dr. Tariq Mahmood", room: "Apt 302", status: "Suspended", pendingBill: 48000, utilities: { gas: 110, water: 120, elec: 250 } },
    { id: "RES-104", name: "Zainab Bibi", room: "Apt 108", status: "Active", pendingBill: 8200, utilities: { gas: 25, water: 22, elec: 35 } },
    { id: "RES-105", name: "Kamran Shah", room: "Apt 403", status: "Pending Approval", pendingBill: 0, utilities: { gas: 0, water: 0, elec: 0 } },
  ]);

  const filteredResidents = residents.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = residents.reduce((sum, r) => sum + (r.status === "Active" ? 35000 : 0), 0);
  const totalOutstanding = residents.reduce((sum, r) => sum + r.pendingBill, 0);

  const calculateUtilityBill = (gas: number, water: number, elec: number) => {
    return (gas + water + elec) * 100;
  };

  const handleToggleStatus = (id: string) => {
    setResidents(residents.map(r => {
      if (r.id === id) {
        const nextStatus = r.status === "Active" ? "Suspended" : r.status === "Suspended" ? "Active" : "Active";
        return { ...r, status: nextStatus };
      }
      return r;
    }));
  };

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Admin Operations Panel</h1>
          <p className="text-muted-foreground text-sm">Welcome back, {user.name}. You have full control over properties, billing, and services.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
          <Button size="sm" className="h-9 font-semibold shadow-gold cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> Add Resident
          </Button>
        </div>
      </div>

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/45 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Residents</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{residents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">4 active accounts, 1 pending approval</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/45 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">PKR {totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-success mt-1">✔ 92% rent collection rate this month</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/45 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding Balance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">PKR {totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">⚠️ 1 tenant exceeds 90 days overdue</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/45 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Operations</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">Online</div>
            <p className="text-xs text-muted-foreground mt-1">Database & API servers fully connected</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Management Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search residents, apartments, IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 border-border/80"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/45 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Resident & Apt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResidents.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-primary">{r.id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.room}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                       <Badge
                         variant={r.status === "Suspended" ? "destructive" : "outline"}
                         className={
                           r.status === "Active"
                             ? "bg-success/15 text-success border-success/30"
                             : r.status === "Suspended"
                             ? ""
                             : "bg-muted text-muted-foreground border-border"
                         }
                       >
                         {r.status}
                       </Badge>
                     </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.pendingBill > 0 ? (
                        <span className="text-destructive font-semibold">PKR {r.pendingBill.toLocaleString()}</span>
                      ) : (
                        <span className="text-success">PKR 0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(r.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Toggle Active/Suspended status"
                        >
                          {r.status === "Active" ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 text-success" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right col: Automated Utility Engine Billing Preview */}
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/45 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Utility Billing Preview
              </CardTitle>
              <CardDescription>
                Calculated using formula: (Gas + Water + Elec) * 100 PKR
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredResidents.filter(r => r.status === "Active" || r.status === "Suspended").slice(0, 3).map((r) => {
                const totalUnits = r.utilities.gas + r.utilities.water + r.utilities.elec;
                const totalBill = calculateUtilityBill(r.utilities.gas, r.utilities.water, r.utilities.elec);
                return (
                  <div key={r.id} className="p-3 bg-secondary/30 rounded-lg border border-border/40 space-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-border/40 pb-1.5">
                      <span className="font-semibold text-foreground">{r.name} ({r.room})</span>
                      <span className="text-primary font-mono">{r.id}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-500" /> Gas: {r.utilities.gas} units
                      </div>
                      <div className="flex items-center gap-1">
                        <Droplet className="h-3 w-3 text-blue-500" /> Water: {r.utilities.water} units
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-yellow-500" /> Elec: {r.utilities.elec} units
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/20">
                      <span>Total ({totalUnits} units):</span>
                      <span className="font-semibold font-mono text-foreground">PKR {totalBill.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/45 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Operations & Settings
              </CardTitle>
              <CardDescription>
                System variables and overrides
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/20">
                <span className="text-muted-foreground">Utility Unit Multiplier</span>
                <span className="font-semibold text-foreground font-mono">100 PKR / unit</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/20">
                <span className="text-muted-foreground">Fixed Maintenance Rate</span>
                <span className="font-semibold text-foreground font-mono">5,000 PKR / month</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/20">
                <span className="text-muted-foreground">Extra Parking Spot</span>
                <span className="font-semibold text-foreground font-mono">2,000 PKR / spot</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Suspension Threshold</span>
                <span className="font-semibold text-destructive font-mono">90 Days Overdue</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rules Management Card */}
      <Card className="border-border/60 bg-card/45 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Parking Rules Management (Admin-Only)
          </CardTitle>
          <CardDescription>
            Add, edit, or remove building and parking policies dynamically. Changes will be reflected live on the resident dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSaveRule} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-secondary/20 p-4 rounded-xl border border-border/40">
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="ruleTitle" className="text-xs">Rule Title</Label>
              <Input
                id="ruleTitle"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                placeholder="e.g. Extra Spot Charges"
                required
                className="bg-background/60"
              />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label htmlFor="ruleDesc" className="text-xs">Rule Description</Label>
              <Input
                id="ruleDesc"
                value={ruleDesc}
                onChange={(e) => setRuleDesc(e.target.value)}
                placeholder="e.g. Additional cards: PKR 2,500/month each."
                required
                className="bg-background/60"
              />
            </div>
            <div className="flex gap-2 md:col-span-1">
              <Button type="submit" className="flex-1 font-semibold cursor-pointer">
                {editingRuleId ? "Update Policy" : "Create Policy"}
              </Button>
              {editingRuleId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingRuleId(null);
                    setRuleTitle("");
                    setRuleDesc("");
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {/* Rules List */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[250px]">Policy Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRules ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      Loading latest rules from database...
                    </TableCell>
                  </TableRow>
                ) : rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                      No parking policies defined in database.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id} className="hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground">{rule.title}</TableCell>
                      <TableCell className="text-muted-foreground">{rule.description}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Edit Rule"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
