import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save, Image as ImageIcon, Film } from "lucide-react";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/image-compress";
import { getApiBase } from "@/lib/api-client";

export const Route = createFileRoute("/admin/home-content")({ component: HomeContentPage });

const HERO_FIELDS = [
  { key: "hero_title", label: "Hero Title", type: "input", placeholder: "Luxury Living" },
  { key: "hero_subtitle", label: "Hero Subtitle (italic gold)", type: "input", placeholder: "Redefined" },
  { key: "hero_tagline", label: "Hero Tagline", type: "textarea", placeholder: "Premium apartments..." },
] as const;

const APT_CARDS = [1, 2, 3, 4] as const;

function HomeContentPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_content").select("key,value");
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const setVal = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); setSaving(false); return; }
      const rows = Object.entries(values).map(([key, value]) => ({ key, value: value || "" }));
      const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Saved");
    } catch (e: any) {
      console.error("Save home content failed:", e);
      toast.error("Could not save content — try again");
    } finally { setSaving(false); }
  };

  const upload = async (key: string, file: File, folder: string) => {
    setUploadingKey(key);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }

      // Basic validation: allow images and short videos, limit size to 20MB
      const allowedImage = file.type.startsWith("image/");
      const allowedVideo = file.type.startsWith("video/");
      const allowed = allowedImage || allowedVideo;
      if (!allowed) { toast.error("Only images or videos allowed"); return; }
      if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)"); return; }

      // 1. Try local upload first
      try {
        // Compress images if it is an image
        let uploadFile = file;
        if (file.type.startsWith("image/")) {
          uploadFile = await compressImage(file, 1600, 1600, 0.8);
        }

        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("title", uploadFile.name);
        fd.append("owner_type", "public");
        fd.append("owner_id", "site-assets");
        fd.append("doc_type", "banner");

        const token = localStorage.getItem("mgt_api_token");
        const res = await fetch(`${getApiBase()}/documents`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd
        });
        if (!res.ok) throw new Error("Local upload failed");
        
        const data = await res.json() as { file_path: string };
        const apiHost = getApiBase().replace(/\/api$/, "");
        const localUrl = `${apiHost}/uploads/${data.file_path}`;
        setVal(key, localUrl);
        toast.success("Uploaded locally — click Save");
        return;
      } catch (localErr) {
        console.warn("Local upload failed, falling back to Supabase cloud:", localErr);
      }

      // 2. Cloud fallback
      const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      setVal(key, data.publicUrl);
      toast.success("Uploaded to Cloud — click Save");
    } catch (e: any) { 
      console.error("Home content upload failed:", e); 
      toast.error("Upload failed — try again"); 
    } finally { 
      setUploadingKey(null); 
    }
  };

  if (loading) return <AdminLayout title="Home Content"><div>Loading...</div></AdminLayout>;

  return (
    <AdminLayout title="Home Content">
      <div className="max-w-4xl space-y-10">
        {/* HERO */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Hero Section</h2>

          <div className="space-y-2">
            <Label>Hero Image or Video</Label>
            <div className="aspect-video w-full bg-secondary/40 border border-border/60 rounded-lg overflow-hidden flex items-center justify-center">
              {values["hero_image_url"] ? (
                values["hero_image_url"].match(/\.(mp4|webm|ogg|mov)$/i) || values["hero_image_url"].startsWith("data:video/") ? (
                  <video src={values["hero_image_url"]} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                ) : (
                  <img src={values["hero_image_url"]} alt="Hero" className="w-full h-full object-cover" />
                )
              ) : <div className="text-muted-foreground flex flex-col items-center gap-2"><ImageIcon className="h-8 w-8" /><span className="text-sm">Using default</span></div>}
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer bg-secondary border border-border rounded-md px-4 py-2 text-sm hover:bg-secondary/80">
              <Upload className="h-4 w-4" />
              {uploadingKey === "hero_image_url" ? "Uploading..." : "Upload Hero Image/Video"}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={e => e.target.files?.[0] && upload("hero_image_url", e.target.files[0], "hero")} />
            </label>
            {values["hero_image_url"] && <Button variant="ghost" size="sm" onClick={() => setVal("hero_image_url", "")}>Reset</Button>}
          </div>

          {HERO_FIELDS.map(f => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea value={values[f.key] || ""} placeholder={f.placeholder} onChange={e => setVal(f.key, e.target.value)} rows={3} />
              ) : (
                <Input value={values[f.key] || ""} placeholder={f.placeholder} onChange={e => setVal(f.key, e.target.value)} />
              )}
            </div>
          ))}
        </section>

        {/* APARTMENT CARDS */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl">Apartment Cards (Home Page)</h2>
          <p className="text-sm text-muted-foreground">Edit the 4 apartment cards shown on the homepage. Upload photo or video.</p>

          {APT_CARDS.map(n => {
            const imgKey = `apt${n}_image_url`;
            const vidKey = `apt${n}_video_url`;
            const titleKey = `apt${n}_title`;
            const priceKey = `apt${n}_price`;
            const descKey = `apt${n}_desc`;
            return (
              <div key={n} className="border border-border/60 rounded-lg p-4 bg-card space-y-3">
                <h3 className="font-display text-lg text-primary">Apartment {n} — {n} Bedroom</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Title</Label>
                    <Input value={values[titleKey] || ""} placeholder={`${n} Bedroom Apartment`} onChange={e => setVal(titleKey, e.target.value)} />
                  </div>
                  <div>
                    <Label>Price</Label>
                    <Input value={values[priceKey] || ""} placeholder="PKR 45,000" onChange={e => setVal(priceKey, e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={2} value={values[descKey] || ""} placeholder="Short description shown on card..." onChange={e => setVal(descKey, e.target.value)} />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Image</Label>
                    <div className="aspect-video bg-secondary/40 border rounded overflow-hidden mb-2">
                      {values[imgKey] ? <img src={values[imgKey]} className="w-full h-full object-cover" alt="" /> : <div className="h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-2 text-xs bg-secondary border rounded px-3 py-1.5 hover:bg-secondary/80">
                      <Upload className="h-3 w-3" /> {uploadingKey === imgKey ? "Uploading..." : "Upload Image"}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && upload(imgKey, e.target.files[0], `apt${n}`)} />
                    </label>
                  </div>
                  <div>
                    <Label>Video (optional)</Label>
                    <div className="aspect-video bg-secondary/40 border rounded overflow-hidden mb-2">
                      {values[vidKey] ? <video src={values[vidKey]} controls className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-muted-foreground"><Film className="h-6 w-6" /></div>}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-2 text-xs bg-secondary border rounded px-3 py-1.5 hover:bg-secondary/80">
                      <Upload className="h-3 w-3" /> {uploadingKey === vidKey ? "Uploading..." : "Upload Video"}
                      <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && upload(vidKey, e.target.files[0], `apt${n}`)} />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* RESIDENT PORTAL DYNAMIC ALERTS */}
        <section className="space-y-4 border-t border-border/40 pt-6">
          <h2 className="font-display text-2xl text-yellow-500">Resident Dashboard Alerts & Notices</h2>
          <p className="text-sm text-muted-foreground">Type custom notifications, rules, or alerts that will display live on all resident portals.</p>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>English Dynamic Alert (Breakdowns, Rent Dues, Maintenance logs)</Label>
              <Textarea value={values["dashboard_alert_en"] || ""} placeholder="e.g. Light nahi aa rahi, Pani ki motor kharab hai, Rental Update" onChange={e => setVal("dashboard_alert_en", e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Urdu Dynamic Alert (Breakdowns, Rent Dues, Maintenance logs)</Label>
              <Textarea value={values["dashboard_alert_ur"] || ""} placeholder="مثال: پانی کی موٹر خراب ہے، بجلی کی لوڈ شیڈنگ، کرایہ اپ ڈیٹ" onChange={e => setVal("dashboard_alert_ur", e.target.value)} rows={4} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>English Parking Rules Notice</Label>
              <Textarea value={values["parking_rules_en"] || ""} placeholder="Type English parking rules..." onChange={e => setVal("parking_rules_en", e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Urdu Parking Rules Notice</Label>
              <Textarea value={values["parking_rules_ur"] || ""} placeholder="پارکنگ کے قوانین اردو میں لکھیں..." onChange={e => setVal("parking_rules_ur", e.target.value)} rows={4} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>English Rental Policy Notice</Label>
              <Textarea value={values["rental_policy_en"] || ""} placeholder="Type English rental policy..." onChange={e => setVal("rental_policy_en", e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Urdu Rental Policy Notice</Label>
              <Textarea value={values["rental_policy_ur"] || ""} placeholder="رینٹل پالیسی اردو میں لکھیں..." onChange={e => setVal("rental_policy_ur", e.target.value)} rows={4} />
            </div>
          </div>
        </section>

        <div className="sticky bottom-4">
          <Button onClick={save} disabled={saving} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
