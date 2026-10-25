import { openDB, IDBPDatabase } from 'idb'

export interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: number
  synced: boolean
}
let dbInstance: IDBPDatabase | null = null
export async function getDB() {
  if (dbInstance) return dbInstance
  dbInstance = await openDB('pomodoro-db', 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const todoStore = db.createObjectStore('todos', { keyPath: 'id' })
        todoStore.createIndex('by-synced', 'synced')
      }
      if (oldVersion < 2) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
        sessionStore.createIndex('by-completedAt', 'completedAt')
      }
      // F006/F007/F008: tasks live in their own store. The upgrade is edited in
      // place (no migrations system): existing todos/sessions are untouched.
      if (oldVersion < 3) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' })
        taskStore.createIndex('by-status', 'status')
        taskStore.createIndex('by-priority', 'priority')
        taskStore.createIndex('by-createdAt', 'createdAt')
      }
    },
  })
  return dbInstance
}
export async function addTodo(text: string): Promise<Todo> {
  const db = await getDB()
  const todo: Todo = {
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: Date.now(),
    synced: false,
  }
  await db.add('todos', todo)
  return todo
}
export async function getTodos(): Promise<Todo[]> {
  const db = await getDB()
  return db.getAll('todos')
}
export async function updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
  const db = await getDB()
  const todo = await db.get('todos', id)
  if (!todo) return
  const updated = { ...todo, ...updates, synced: false }
  await db.put('todos', updated)
}
export async function deleteTodo(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('todos', id)
}
export async function getUnsyncedTodos(): Promise<Todo[]> {
  const db = await getDB()
  const allTodos = await db.getAll('todos')
  return allTodos.filter((todo: Todo) => !todo.synced)
}
export async function markAsSynced(id: string): Promise<void> {
  const db = await getDB()
  const todo = await db.get('todos', id)
  if (!todo) return
  todo.synced = true
  await db.put('todos', todo)
}