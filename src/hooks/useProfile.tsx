import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { apiFetch, getToken } from "@/lib/api-client";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  apartment_no: string | null;
  client_id: string | null;
  gas_units?: number | null;
  water_units?: number | null;
  electricity_units?: number | null;
  fixed_maintenance?: number | null;
  outstanding_balance?: number | null;
  last_billing_date?: string | null;
  cnic?: string | null;
  rent_amount?: number | null;
  security_deposit?: number | null;
  agreement_url?: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = () => {
    if (!user) { setProfile(null); return; }
    setLoading(true);

    if (getToken()) {
      apiFetch<{ user: any }>(`/auth/me?t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      })
        .then((res) => {
          if (res && res.user) {
            setProfile({
              ...res.user,
              id: res.user.id,
              full_name: res.user.full_name,
              phone: res.user.phone,
              apartment_no: res.user.apartment_no,
              client_id: res.user.client_id,
              cnic: res.user.cnic,
              rent_amount: res.user.rent_amount ?? 0,
              security_deposit: res.user.security_deposit ?? 0,
              agreement_url: res.user.agreement_url,
              gas_units: res.user.gas_curr ?? res.user.gas_units ?? 0,
              water_units: res.user.water_rate ?? res.user.water_units ?? 0,
              electricity_units: res.user.elec_curr ?? res.user.electricity_units ?? 0,
              fixed_maintenance: res.user.fixed_maintenance ?? 0,
              outstanding_balance: res.user.outstanding_balance ?? 0,
              last_billing_date: res.user.last_billing_date || null,
              elec_prev: res.user.elec_prev ?? 0,
              elec_curr: res.user.elec_curr ?? 0,
              elec_rate: res.user.elec_rate ?? 100,
              elec_arrears: res.user.elec_arrears ?? 0,
              gas_prev: res.user.gas_prev ?? 0,
              gas_curr: res.user.gas_curr ?? 0,
              gas_rate: res.user.gas_rate ?? 0,
              gas_arrears: res.user.gas_arrears ?? 0,
              water_prev: res.user.water_prev ?? 0,
              water_curr: res.user.water_curr ?? 0,
              water_rate: res.user.water_rate ?? 80,
              water_arrears: res.user.water_arrears ?? 0,
              parking_rent: res.user.parking_rent ?? 0,
              stall_rent: res.user.stall_rent ?? 0,
              other_income: res.user.other_income ?? 0
            } as any);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Local profile load failed:", err);
          setLoading(false);
        });
      return;
    }

    supabase.from("profiles")
      .select("id, full_name, phone, apartment_no, client_id, gas_units, water_units, electricity_units, fixed_maintenance, outstanding_balance, last_billing_date")
      .eq("id", user.id).maybeSingle()
      .then(({ data }: any) => { setProfile(data as Profile | null); setLoading(false); })
      .catch((err: any) => {
        console.error("Supabase profile load failed:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return { profile, loading, refetch: fetchProfile };
}
