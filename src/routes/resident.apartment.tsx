import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import apt2 from "@/assets/apt-2bed.jpg";

export const Route = createFileRoute("/resident/apartment")({
  component: ResidentApartmentPage,
});

function ResidentApartmentPage() {
  const [profile, setProfile] = useState<any>(null);
  const [apartmentData, setApartmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Immediate Cache Revalidation: append unique query parameter and set bypass headers
        const meRes = await apiFetch<any>(`/auth/me?t=${Date.now()}`, {
          headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });

        if (meRes && meRes.user) {
          const user = meRes.user;
          setProfile(user);

          if (user.apartment_no) {
            const aptsRes = await apiFetch<any>(`/apartments?t=${Date.now()}`, {
              headers: {
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Expires": "0"
              }
            });
            if (aptsRes && aptsRes.apartments) {
              const matchedApt = aptsRes.apartments.find(
                (a: any) => a.number?.toLowerCase() === user.apartment_no?.toLowerCase()
              );
              if (matchedApt) {
                setApartmentData(matchedApt);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load resident apartment details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Explicit leaseData mapping monthly_rent to rent_amount entered in Admin
  const leaseData = profile ? {
    monthly_rent: profile.rent_amount || 0,
    security_deposit: profile.security_deposit || 0,
    joining_date: profile.joining_date || null,
  } : null;

  const apartmentNumber = profile?.apartment_no || "A-203";
  const rentDisplay = leaseData && leaseData.monthly_rent > 0 
    ? `PKR ${leaseData.monthly_rent.toLocaleString()}` 
    : (apartmentData && apartmentData.rent > 0 
      ? `PKR ${apartmentData.rent.toLocaleString()}` 
      : "PKR 0");

  const maintenanceDisplay = profile?.fixed_maintenance 
    ? `PKR ${profile.fixed_maintenance.toLocaleString()}` 
    : "PKR 0";

  return (
    <ResidentLayout title="My Apartment">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground animate-pulse">Loading Apartment Details...</div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
          <div className="rounded-lg overflow-hidden border border-border/60">
            <img src={apt2} alt="Apartment" className="w-full h-full object-cover" />
          </div>
          <div className="bg-card border border-border/60 rounded-lg p-6 space-y-3">
            <h3 className="font-display text-2xl">Apartment {apartmentNumber}</h3>
            <p className="text-muted-foreground text-sm">
              {apartmentData 
                ? `${apartmentData.bedrooms || 2} Bedroom · ${apartmentData.area_sqft || 950} sq.ft · ${apartmentData.floor || 2}nd Floor` 
                : "2 Bedroom · 950 sq.ft · 2nd Floor"}
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/60">
              <div>
                {/* 🔄 FIXED DYNAMIC RENT LABEL */}
                <div className="text-sm text-slate-400">Rent</div>
                <div className="text-xl font-bold text-white">
                  PKR {leaseData?.monthly_rent?.toLocaleString() || "0"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Maintenance</div>
                <div className="font-medium">{maintenanceDisplay}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lease Start</div>
                <div className="font-medium">
                  {leaseData?.joining_date 
                    ? new Date(leaseData.joining_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) 
                    : "Jan 2024"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Parking Slot</div>
                <div className="font-medium">P-014</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ResidentLayout>
  );
}
