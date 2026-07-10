export type UserRole = "admin" | "resident" | "thirdparty" | "accountant" | "super admin" | "system admin";

export interface User {
  id: string;
  client_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  apartment_no: string | null;
  phone: string | null;
  role: UserRole;
  permissions_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  entry_date: string;
  entry_type: "rent" | "security" | "maintenance" | "other";
  description: string;
  debit: number;
  credit: number;
  balance_after: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface Document {
  id: string;
  owner_id: string | null;
  owner_type: string;
  title: string;
  doc_type: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface Complaint {
  id: string;
  resident_id: string;
  title: string;
  category: string;
  priority: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: "insert" | "update" | "delete";
  payload_json: string;
  created_at: string;
  synced_at: string | null;
  error: string | null;
}
