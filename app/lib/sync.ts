import { getUnsyncedTodos, markAsSynced } from './db'

export async function syncTodos() {
  if (!navigator.onLine) {
    console.log('Offline - will sync later')
    return
  }
  const unsyncedTodos = await getUnsyncedTodos()


  if (unsyncedTodos.length === 0) {
    return
  }
  console.log(`Syncing ${unsyncedTodos.length} todos...`)
  for (const todo of unsyncedTodos) {
    try {
      await markAsSynced(todo.id)
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }
}
// auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online! Syncing...')
    syncTodos()
  })
}