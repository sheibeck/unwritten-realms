import { ref } from 'vue';
import type { DbConnection, User } from '../module_bindings';

export function useUsers(conn: DbConnection | null) {
  const users = ref<Map<string, User>>(new Map());
    
  if (!conn) {
    console.warn('No connection provided');
    return { users };
  }

  return users;
}
