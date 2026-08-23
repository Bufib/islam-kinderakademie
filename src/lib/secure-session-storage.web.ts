import type { SessionStorageOptions } from "@/lib/secure-session-storage.types";

// Im Browser verwendet supabase-js weiterhin seinen normalen Web-Storage.
export const secureSessionStorageOptions: SessionStorageOptions = {};
