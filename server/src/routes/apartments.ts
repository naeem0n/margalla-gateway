import { Router } from "express";
import { getDb, newId, now } from "../db/index.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { runBestEffort } from "../lib/errors.js";

const router = Router();

// 3.5. GET vacant apartments list — MUST come BEFORE /:id to avoid route shadowing
router.get("/vacant-list", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.query(`
      SELECT 
        number AS apartment_no,
        CASE
          WHEN type IS NOT NULL AND furnishing_status IS NOT NULL THEN type || ' – ' || furnishing_status
          WHEN type IS NOT NULL THEN type
          ELSE 'Standard Unit'
        END AS description,
        rent,
        COALESCE(notes, 'Available immediately') AS remarks,
        status
      FROM apartments
      WHERE LOWER(status) = 'available'
      ORDER BY number ASC
    `) as any[];

    res.json({ success: true, results: rows });
  } catch (e: any) {
    console.error("Failed to fetch vacant list:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to fetch vacant list" });
  }
});

// 3.6 POST seed default apartments
router.post("/seed", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const db = await getDb();
    const existing = await db.queryOne<{ count: number }>("SELECT COUNT(*) as count FROM apartments");
    if (existing && existing.count > 0) {
      const rows = await db.query("SELECT * FROM apartments ORDER BY number ASC");
      return res.json({ success: true, apartments: rows });
    }

    const ts = now();
    const defaultApts = [
      "A-101", "A-102", "A-103", "A-104", "A-105",
      "A-201", "A-202", "A-203", "A-204", "A-205",
      "A-301", "A-302", "A-303", "A-304", "A-305",
      "A-401", "A-402", "A-403", "A-404", "A-405"
    ];

    for (const apt of defaultApts) {
      const id = newId();
      await db.run(
        `INSERT INTO apartments (id, number, floor, type, bedrooms, area_sqft, rent, status, description, notes, media_urls_json, owner_name, ownership_type, dealer_company, dealer_commission, commission_type, sale_price, furnishing_status, created_at, updated_at)
         VALUES (?, ?, ?, 'Standard', '2', 1200, 0, 'available', 'Auto-initialized', '', '[]', 'Margalla Gateway', 'Company', '', 0, 'percent', 0, 'Unfurnished', ?, ?)`,
        [id, apt, apt.substring(2, 3), ts, ts]
      );
    }
    const rows = await db.query("SELECT * FROM apartments ORDER BY number ASC");
    res.json({ success: true, apartments: rows });
  } catch (e: any) {
    console.error("Failed to seed apartments:", e);
    res.status(500).json({ success: false, message: e.message || "Failed to seed apartments" });
  }
});

// 1. GET all apartments
router.get("/", authRequired, async (req, res) => {
  try {
    const db = await getDb();
    let rows: any[] = [];
    
    if (req.user!.role === "admin") {
      rows = await db.query("SELECT * FROM apartments ORDER BY number ASC");
    } else {
      const profile = await db.queryOne<{ apartment_no: string }>("SELECT apartment_no FROM users WHERE id = ?", [req.user!.sub]);
      const userApt = profile?.apartment_no;
      if (userApt) {
        rows = await db.query(
          "SELECT * FROM apartments WHERE UPPER(number) = ? ORDER BY number ASC",
          [userApt.toUpperCase()]
        );
      }
    }
    // Parse media_urls_json for each row
    const apartments = rows.map((r: any) => {
      let media_urls: string[] = [];
      try {
        media_urls = JSON.parse(r.media_urls_json || "[]");
      } catch (_) {
        media_urls = [];
      }
      return {
        id: r.id,
        number: r.number,
        floor: r.floor,
        type: r.type,
        bedrooms: r.bedrooms,
        area_sqft: r.area_sqft,
        rent: r.rent,
        status: r.status,
        description: r.description,
        notes: r.notes,
        media_urls,
        owner_name: r.owner_name ?? "Margalla Gateway",
        ownership_type: r.ownership_type ?? "Company",
        dealer_company: r.dealer_company ?? null,
        dealer_commission: r.dealer_commission ?? 0.00,
        furnishing_status: r.furnishing_status ?? "Unfurnished",
        property_id: r.property_id ?? null,
        building_id: r.building_id ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });
    res.json({ apartments });
  } catch (e: any) {
    console.error("Failed to fetch apartments:", e);
    res.status(500).json({ error: e.message || "Failed to fetch apartments" });
  }
});

// 2. POST create new apartment
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  const { 
    number, floor, type, bedrooms, area_sqft, rent, status, description, notes, media_urls,
    owner_name, ownership_type, dealer_company, dealer_commission, furnishing_status
  } = req.body ?? {};
  if (!number) {
    return res.status(400).json({ error: "Apartment number is required" });
  }

  try {
    const db = await getDb();
    const dup = await db.queryOne("SELECT id FROM apartments WHERE number = ?", [number]);
    if (dup) {
      return res.status(400).json({ error: `Apartment number ${number} already exists.` });
    }
    const id = newId();
    const ts = now();
    const mediaUrlsJson = JSON.stringify(media_urls ?? []);

    await db.run(
      `INSERT INTO apartments (id, number, floor, type, bedrooms, area_sqft, rent, status, description, notes, media_urls_json, owner_name, ownership_type, dealer_company, dealer_commission, furnishing_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        number,
        floor !== undefined ? floor : null,
        type ?? null,
        bedrooms ?? null,
        area_sqft !== undefined ? Number(area_sqft) : null,
        rent !== undefined ? Number(rent) : 0,
        status ?? "available",
        description ?? null,
        notes ?? null,
        mediaUrlsJson,
        owner_name ?? "Margalla Gateway",
        ownership_type ?? "Company",
        dealer_company ?? null,
        dealer_commission !== undefined ? Number(dealer_commission) : 0.00,
        furnishing_status ?? "Unfurnished",
        ts,
        ts
      ]
    );

    const payload = {
      id,
      number,
      floor: floor !== undefined ? floor : null,
      type: type ?? null,
      bedrooms: bedrooms ?? null,
      area_sqft: area_sqft !== undefined ? Number(area_sqft) : null,
      rent: rent !== undefined ? Number(rent) : 0,
      status: status ?? "available",
      description: description ?? null,
      notes: notes ?? null,
      media_urls: media_urls ?? [],
      owner_name: owner_name ?? "Margalla Gateway",
      ownership_type: ownership_type ?? "Company",
      dealer_company: dealer_company ?? null,
      dealer_commission: dealer_commission !== undefined ? Number(dealer_commission) : 0.00,
      furnishing_status: furnishing_status ?? "Unfurnished",
      created_at: ts,
      updated_at: ts
    };

    // Queue for cloud sync (non-blocking)
    await runBestEffort("enqueueSync apartments insert", () => db.enqueueSync("apartments", id, "insert", payload));

    res.json({ success: true, apartment: payload });
  } catch (e: any) {
    console.error("Failed to create apartment:", e);
    res.status(500).json({ error: e.message || "Failed to create apartment" });
  }
});

// 3. PUT update apartment
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { 
    number, floor, type, bedrooms, area_sqft, rent, status, description, notes, media_urls,
    owner_name, ownership_type, dealer_company, dealer_commission, furnishing_status
  } = req.body ?? {};
  
  if (!number) {
    return res.status(400).json({ error: "Apartment number is required" });
  }

  try {
    const db = await getDb();
    const dup = await db.queryOne("SELECT id FROM apartments WHERE number = ? AND id != ?", [number, id]);
    if (dup) {
      return res.status(400).json({ error: `Apartment number ${number} is already taken by another unit.` });
    }
    const ts = now();
    const mediaUrlsJson = JSON.stringify(media_urls ?? []);

    const existing = await db.queryOne("SELECT id, created_at FROM apartments WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Apartment not found" });
    }

    await db.run(
      `UPDATE apartments SET
        number = ?,
        floor = ?,
        type = ?,
        bedrooms = ?,
        area_sqft = ?,
        rent = ?,
        status = ?,
        description = ?,
        notes = ?,
        media_urls_json = ?,
        owner_name = ?,
        ownership_type = ?,
        dealer_company = ?,
        dealer_commission = ?,
        furnishing_status = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        number,
        floor !== undefined ? Number(floor) : null,
        type ?? null,
        bedrooms ?? null,
        area_sqft !== undefined ? Number(area_sqft) : null,
        rent !== undefined ? Number(rent) : 0,
        status ?? "available",
        description ?? null,
        notes ?? null,
        mediaUrlsJson,
        owner_name ?? "Margalla Gateway",
        ownership_type ?? "Company",
        dealer_company ?? null,
        dealer_commission !== undefined ? Number(dealer_commission) : 0.00,
        furnishing_status ?? "Unfurnished",
        ts,
        id
      ]
    );

    const payload = {
      id,
      number,
      floor: floor !== undefined ? Number(floor) : null,
      type: type ?? null,
      bedrooms: bedrooms ?? null,
      area_sqft: area_sqft !== undefined ? Number(area_sqft) : null,
      rent: rent !== undefined ? Number(rent) : 0,
      status: status ?? "available",
      description: description ?? null,
      notes: notes ?? null,
      media_urls: media_urls ?? [],
      owner_name: owner_name ?? "Margalla Gateway",
      ownership_type: ownership_type ?? "Company",
      dealer_company: dealer_company ?? null,
      dealer_commission: dealer_commission !== undefined ? Number(dealer_commission) : 0.00,
      furnishing_status: furnishing_status ?? "Unfurnished",
      created_at: (existing as any).created_at,
      updated_at: ts
    };

    // Queue for cloud sync (non-blocking)
    await runBestEffort("enqueueSync apartments update", () => db.enqueueSync("apartments", id, "update", payload));

    res.json({ success: true, apartment: payload });
  } catch (e: any) {
    console.error("Failed to update apartment:", e);
    res.status(500).json({ error: e.message || "Failed to update apartment" });
  }
});

// 4. DELETE apartment
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const existing = await db.queryOne<{ id: string; number: string }>("SELECT id, number FROM apartments WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Apartment not found" });
    }

    const aptNo = existing.number;

    // 1. Get all users/residents associated with this apartment
    const users = await db.query<{ id: string }>("SELECT id FROM users WHERE apartment_no = ? OR apartment_no = ?", [aptNo, aptNo.toUpperCase()]);

    for (const u of users) {
      const userId = u.id;
      // Cascade delete user references just like in users.ts delete route
      await runBestEffort(`cascade delete leases for user ${userId}`, () => db.run("DELETE FROM leases WHERE resident_id IN (SELECT id FROM residents WHERE user_id = ?)", [userId]));
      await runBestEffort(`cascade delete residents for user ${userId}`, () => db.run("DELETE FROM residents WHERE user_id = ?", [userId]));
      await runBestEffort(`cascade release parking for user ${userId}`, () => db.run("UPDATE parking SET assigned_tenant_id = NULL, status = 'available' WHERE assigned_tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete ledger_entries for user ${userId}`, () => db.run("DELETE FROM ledger_entries WHERE user_id = ?", [userId]));
      await runBestEffort(`cascade delete invoice_items for user ${userId}`, () => db.run("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoice_headers WHERE tenant_id = ?)", [userId]));
      await runBestEffort(`cascade delete invoice_headers for user ${userId}`, () => db.run("DELETE FROM invoice_headers WHERE tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete invoices for user ${userId}`, () => db.run("DELETE FROM invoices WHERE tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete payments for user ${userId}`, () => db.run("DELETE FROM payments WHERE tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete receipt_vouchers for user ${userId}`, () => db.run("DELETE FROM receipt_vouchers WHERE tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete security_deposits for user ${userId}`, () => db.run("DELETE FROM security_deposits WHERE tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete tenant_ledger for user ${userId}`, () => db.run("DELETE FROM tenant_ledger WHERE tenant_id = ?", [userId]));
      await runBestEffort(`cascade delete complaints for user ${userId}`, () => db.run("DELETE FROM complaints WHERE resident_id = ?", [userId]));
      await runBestEffort(`cascade delete payment_requests for user ${userId}`, () => db.run("DELETE FROM payment_requests WHERE resident_id = ? OR tenant_id = ?", [userId, userId]));
      await runBestEffort(`cascade delete chart_of_accounts for user ${userId}`, () => db.run("DELETE FROM chart_of_accounts WHERE acco_id IN ('1200.1.1.' || ?, '2100.1.1.' || ?, '1300.1.1.' || ?)", [userId, userId, userId]));
      await runBestEffort(`cascade delete users for user ${userId}`, () => db.run("DELETE FROM users WHERE id = ?", [userId]));
    }

    // 2. Cascade delete direct apartment references in other tables
    await runBestEffort(`cascade delete daily_bookings for apartment ${id}`, () => db.run("DELETE FROM daily_bookings WHERE apartment_id = ?", [id]));
    await runBestEffort(`cascade delete apartment_manual_assets for ${aptNo}`, () => db.run("DELETE FROM apartment_manual_assets WHERE apartment_no = ? OR apartment_no = ?", [aptNo, aptNo.toUpperCase()]));
    await runBestEffort(`cascade delete apartment_meter_readings for ${aptNo}`, () => db.run("DELETE FROM apartment_meter_readings WHERE apartment_no = ? OR apartment_no = ?", [aptNo, aptNo.toUpperCase()]));
    await runBestEffort(`cascade delete monthly_billing for ${aptNo}`, () => db.run("DELETE FROM monthly_billing WHERE apartment_no = ? OR apartment_no = ?", [aptNo, aptNo.toUpperCase()]));
    await runBestEffort(`cascade delete tenants for ${aptNo}`, () => db.run("DELETE FROM tenants WHERE apartment_no = ? OR apartment_no = ?", [aptNo, aptNo.toUpperCase()]));
    await runBestEffort(`cascade delete invoices for ${aptNo}`, () => db.run("DELETE FROM invoices WHERE apartment_no = ? OR apartment_no = ?", [aptNo, aptNo.toUpperCase()]));
    await runBestEffort(`cascade delete ledger_entries for ${aptNo}`, () => db.run("DELETE FROM ledger_entries WHERE user_id IN (SELECT id FROM users WHERE apartment_no = ? OR apartment_no = ?)", [aptNo, aptNo.toUpperCase()]));
    await runBestEffort(`cascade release parking for ${aptNo}`, () => db.run("UPDATE parking SET status = 'available' WHERE number = ? OR number = ?", [aptNo, aptNo.toUpperCase()]));

    // 3. Delete the apartment itself
    await db.run("DELETE FROM apartments WHERE id = ?", [id]);

    // Queue delete for cloud sync (non-blocking)
    await runBestEffort("enqueueSync apartments delete", () => db.enqueueSync("apartments", id, "delete", { id }));

    res.json({ success: true, message: "Apartment and all associated ledger history permanently deleted" });
  } catch (e: any) {
    console.error("Failed to delete apartment:", e);
    res.status(500).json({ error: e.message || "Failed to delete apartment" });
  }
});

export default router;
