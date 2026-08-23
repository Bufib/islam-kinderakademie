import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import type {
  SessionStorageAdapter,
  SessionStorageOptions,
} from "@/lib/secure-session-storage.types";

type StorageSlot = "a" | "b";

type StorageManifest = {
  version: 1;
  active: StorageSlot;
  chunks: Record<StorageSlot, number>;
};

const CHUNK_LENGTH = 512;
const MAX_CHUNKS = 128;
const VALID_SECURE_STORE_KEY = /^[A-Za-z0-9._-]+$/;
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let secureStoreAvailability: Promise<boolean> | null = null;

function getChunkKey(key: string, slot: StorageSlot, index: number) {
  return `${key}.secure.${slot}.${index}`;
}

function parseManifest(value: string | null): StorageManifest | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StorageManifest>;
    const a = parsed.chunks?.a;
    const b = parsed.chunks?.b;

    if (
      parsed.version !== 1 ||
      (parsed.active !== "a" && parsed.active !== "b") ||
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a! < 0 ||
      b! < 0 ||
      a! > MAX_CHUNKS ||
      b! > MAX_CHUNKS
    ) {
      return null;
    }

    return {
      version: 1,
      active: parsed.active,
      chunks: { a: a!, b: b! },
    };
  } catch {
    return null;
  }
}

function splitIntoSecureStoreChunks(value: string) {
  const chunks: string[] = [];
  let start = 0;

  while (start < value.length) {
    let end = Math.min(start + CHUNK_LENGTH, value.length);

    if (
      end < value.length &&
      value.charCodeAt(end - 1) >= 0xd800 &&
      value.charCodeAt(end - 1) <= 0xdbff &&
      value.charCodeAt(end) >= 0xdc00 &&
      value.charCodeAt(end) <= 0xdfff
    ) {
      end -= 1;
    }

    chunks.push(value.slice(start, end));
    start = end;
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error("Die Supabase-Sitzung ist zu groß für den sicheren Gerätespeicher.");
  }

  return chunks;
}

async function assertSecureStoreAvailable() {
  secureStoreAvailability ??= SecureStore.isAvailableAsync();

  if (!(await secureStoreAvailability)) {
    throw new Error("Der sichere Gerätespeicher ist auf diesem Gerät nicht verfügbar.");
  }
}

function assertValidKey(key: string) {
  if (!VALID_SECURE_STORE_KEY.test(key)) {
    throw new Error("Supabase hat einen ungültigen Schlüssel für SecureStore verwendet.");
  }
}

async function deleteChunks(
  key: string,
  slot: StorageSlot,
  count: number,
) {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(
        getChunkKey(key, slot, index),
        SECURE_STORE_OPTIONS,
      ),
    ),
  );
}

class SecureSessionStorage implements SessionStorageAdapter {
  async getItem(key: string) {
    assertValidKey(key);
    await assertSecureStoreAvailable();

    const manifestValue = await SecureStore.getItemAsync(
      key,
      SECURE_STORE_OPTIONS,
    );

    if (manifestValue === null) {
      const legacyValue = await AsyncStorage.getItem(key);

      if (legacyValue !== null) {
        await this.setItem(key, legacyValue);
      }

      return legacyValue;
    }

    const manifest = parseManifest(manifestValue);

    if (!manifest) {
      await this.removeItem(key);
      return null;
    }

    const chunkCount = manifest.chunks[manifest.active];
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(
          getChunkKey(key, manifest.active, index),
          SECURE_STORE_OPTIONS,
        ),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      await this.removeItem(key);
      return null;
    }

    return chunks.join("");
  }

  async setItem(key: string, value: string) {
    assertValidKey(key);
    await assertSecureStoreAvailable();

    const chunks = splitIntoSecureStoreChunks(value);
    const previousManifest = parseManifest(
      await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS),
    );
    const targetSlot: StorageSlot =
      previousManifest?.active === "a" ? "b" : "a";
    const previousTargetCount =
      previousManifest?.chunks[targetSlot] ?? 0;

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(
          getChunkKey(key, targetSlot, index),
          chunk,
          SECURE_STORE_OPTIONS,
        ),
      ),
    );

    if (previousTargetCount > chunks.length) {
      await Promise.all(
        Array.from(
          { length: previousTargetCount - chunks.length },
          (_, offset) =>
            SecureStore.deleteItemAsync(
              getChunkKey(key, targetSlot, chunks.length + offset),
              SECURE_STORE_OPTIONS,
            ),
        ),
      );
    }

    const nextManifest: StorageManifest = {
      version: 1,
      active: targetSlot,
      chunks: {
        a: targetSlot === "a" ? chunks.length : (previousManifest?.chunks.a ?? 0),
        b: targetSlot === "b" ? chunks.length : (previousManifest?.chunks.b ?? 0),
      },
    };

    await SecureStore.setItemAsync(
      key,
      JSON.stringify(nextManifest),
      SECURE_STORE_OPTIONS,
    );

    if (previousManifest) {
      const oldSlot = previousManifest.active;
      await deleteChunks(key, oldSlot, previousManifest.chunks[oldSlot]);
      nextManifest.chunks[oldSlot] = 0;

      await SecureStore.setItemAsync(
        key,
        JSON.stringify(nextManifest),
        SECURE_STORE_OPTIONS,
      );
    }

    await AsyncStorage.removeItem(key);
  }

  async removeItem(key: string) {
    assertValidKey(key);
    await assertSecureStoreAvailable();

    const manifest = parseManifest(
      await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS),
    );

    if (manifest) {
      await Promise.all([
        deleteChunks(key, "a", manifest.chunks.a),
        deleteChunks(key, "b", manifest.chunks.b),
      ]);
    }

    await Promise.all([
      SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS),
      AsyncStorage.removeItem(key),
    ]);
  }
}

export const secureSessionStorageOptions: SessionStorageOptions = {
  storage: new SecureSessionStorage(),
};
