import React, { useState, useEffect } from "react";
import {
  User,
  CreditCard,
  Wrench,
  AlertCircle,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  Droplet,
  Zap,
  Flame,
  Plus
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getParkingRules, ParkingRule } from "@/lib/parking-rules-client";

export default function ResidentDashboard({ user }: { user: any }) {
  const [requests, setRequests] = useState([
    { id: "REQ-042", category: "Plumbing", description: "Water leakage in master bathroom washbasin pipeline", status: "In Progress", cost: 1200, date: "2026-06-12" },
    { id: "REQ-039", category: "Electrical", description: "Living room chandelier socket spark issue", status: "Resolved", cost: 800, date: "2026-06-08" },
    { id: "REQ-031", category: "HVAC", description: "AC compressor not cooling room adequately", status: "Resolved", cost: 3500, date: "2026-05-20" },
  ]);

  const [newCategory, setNewCategory] = useState("Plumbing");
  const [newDesc, setNewDesc] = useState("");
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const [rules, setRules] = useState<ParkingRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);

  useEffect(() => {
    const fetchRules = async () => {
      setLoadingRules(true);
      const data = await getParkingRules();
      setRules(data);
      setLoadingRules(false);
    };
    fetchRules();
  }, []);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;

    const newReq = {
      id: `REQ-${Math.floor(100 + Math.random() * 900)}`,
      category: newCategory,
      description: newDesc.trim(),
      status: "Pending",
      cost: 0,
      date: new Date().toISOString().split("T")[0]
    };

    setRequests([newReq, ...requests]);
    setNewDesc("");
    setShowRequestDialog(false);
  };

  const residentProfile = {
    aptNo: "Apt 402",
    clientId: "RES-402",
    outstandingBalance: 18500,
    fixedMaintenance: 5000,
    extraParkingSpots: 1,
    utilities: { gas: 45, water: 55, elec: 110 }
  };

  const totalUtilityBill = (residentProfile.utilities.gas + residentProfile.utilities.water + residentProfile.utilities.elec) * 100;
  const grandTotal = totalUtilityBill + residentProfile.fixedMaintenance + (residentProfile.extraParkingSpots * 2000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Resident Portal</h1>
          <p className="text-muted-foreground text-sm">Welcome home, {user.name}. View your statement, manage utility metrics, or request services.</p>
        </div>
        <Button onClick={() => setShowRequestDialog(!showRequestDialog)} className="font-semibold shadow-gold cursor-pointer">
          <Wrench className="mr-2 h-4 w-4" /> Request Maintenance
        </Button>
      </div>

      {/* Grid structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 columns: Profile details and statement */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Stats Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/60 bg-card/45">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apartment No</span>
                  <Badge variant="outline" className="border-primary/30 text-primary font-mono">{residentProfile.clientId}</Badge>
                </div>
                <div className="text-2xl font-bold text-foreground">{residentProfile.aptNo}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Margalla Tower, Floor 4</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/45">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Balance</span>
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-destructive">PKR {residentProfile.outstandingBalance.toLocaleString()}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Due date: 10th of this month</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/45">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parking Spots</span>
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{residentProfile.extraParkingSpots + 1} Cards</div>
                <p className="text-[11px] text-muted-foreground mt-1">1 Free + {residentProfile.extraParkingSpots} Extra</p>
              </CardContent>
            </Card>
          </div>

          {/* Account Statement */}
          <Card className="border-border/60 bg-card/45 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-display">Current Account Statement</CardTitle>
                <CardDescription>Breakdown of charges and utilities for this cycle</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" /> Print Ledger
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Utility meter readings */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-secondary/35 rounded-lg border border-border/40">
                <div className="flex flex-col items-center justify-center p-2 text-center">
                  <Flame className="h-5 w-5 text-amber-500 mb-1" />
                  <span className="text-[10px] text-muted-foreground">Gas Units</span>
                  <span className="text-sm font-bold mt-0.5">{residentProfile.utilities.gas} m³</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 text-center border-x border-border/30">
                  <Droplet className="h-5 w-5 text-blue-500 mb-1" />
                  <span className="text-[10px] text-muted-foreground">Water Units</span>
                  <span className="text-sm font-bold mt-0.5">{residentProfile.utilities.water} Gal</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 text-center">
                  <Zap className="h-5 w-5 text-yellow-500 mb-1" />
                  <span className="text-[10px] text-muted-foreground">Electric Units</span>
                  <span className="text-sm font-bold mt-0.5">{residentProfile.utilities.elec} kWh</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-border/20">
                  <span className="text-muted-foreground">Utility Bills (Gas + Water + Electricity) * 100 PKR</span>
                  <span className="font-semibold text-foreground font-mono">PKR {totalUtilityBill.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/20">
                  <span className="text-muted-foreground">Fixed Maintenance charges</span>
                  <span className="font-semibold text-foreground font-mono">PKR {residentProfile.fixedMaintenance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/20">
                  <span className="text-muted-foreground">Extra Parking Slot (1 Spot @ 2,000)</span>
                  <span className="font-semibold text-foreground font-mono">PKR 2,000</span>
                </div>
                <div className="flex justify-between items-center py-2 font-semibold text-sm pt-4">
                  <span className="text-foreground">Grand Total outstanding:</span>
                  <span className="font-bold text-primary font-mono">PKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parking & Community Rules (Live Fetch) */}
          <Card className="border-border/60 bg-card/45 backdrop-blur-md mt-6">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Margalla Parking & Building Policies
              </CardTitle>
              <CardDescription>Latest community rules updated dynamically by management</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRules ? (
                <div className="text-xs text-muted-foreground py-2">Loading latest guidelines...</div>
              ) : rules.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No active guidelines posted.</div>
              ) : (
                <ul className="space-y-3 text-xs pl-5 list-disc">
                  {rules.map((rule) => (
                    <li key={rule.id} className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{rule.title}: </span>
                      {rule.description}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Maintenance services requests with status tracking UI */}
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/45 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Active Maintenance Requests
              </CardTitle>
              <CardDescription>
                Track the progress of repair jobs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showRequestDialog && (
                <form onSubmit={handleSubmitRequest} className="p-3 bg-secondary/50 rounded-lg border border-border/60 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Category</Label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full text-xs bg-background border border-border/60 rounded px-2 py-1 text-foreground"
                    >
                      <option>Plumbing</option>
                      <option>Electrical</option>
                      <option>HVAC</option>
                      <option>Carpentry</option>
                      <option>Painting</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Describe Issue</Label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Explain details of the issue..."
                      className="w-full text-xs bg-background border border-border/60 rounded p-2 text-foreground h-16 resize-none"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowRequestDialog(false)} className="h-7 text-[10px] px-2.5">
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="h-7 text-[10px] px-2.5">
                      Submit Request <Send className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </form>
              )}

              {requests.map((r) => (
                <div key={r.id} className="p-3 bg-secondary/30 rounded-lg border border-border/40 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">{r.category}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{r.id}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{r.description}</p>
                  
                  {/* Status Timeline Tracking */}
                  <div className="pt-2 flex items-center justify-between border-t border-border/20 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {r.status === "Resolved" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-primary animate-spin" />
                      )}
                      <span className={r.status === "Resolved" ? "text-success font-medium" : "text-primary font-medium"}>
                        {r.status}
                      </span>
                    </div>
                    <span className="text-muted-foreground">{r.date}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
