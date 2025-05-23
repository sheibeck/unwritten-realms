// src/composables/useSpacetime.ts
import { ref } from 'vue';
import { SpacetimeService } from '../lib/spacetimeService';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import type { DbConnection } from '../module_bindings';

const connected = ref(false);
const identity = ref<Identity | null>(null);
const service = new SpacetimeService('unwrittenrealms', 'ws://localhost:3000');

export function useSpacetime() {
  async function connect(): Promise<DbConnection | null> {
    service.connect();

    // Wait until connected is true
    return await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (service.isConnected) {
          clearInterval(interval);
          connected.value = true;
          identity.value = service.currentIdentity;
          resolve(service.conn);
        }
      }, 100);
    });
  }

  return {
    connect,
    connected,
    identity,
    conn: service.conn,
    service,
  };
}