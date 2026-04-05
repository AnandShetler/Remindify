import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('remindifi.db');

export interface Reminder {
  id: string;
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  recurrenceType: 'once' | 'daily' | 'weekly' | 'monthly';
  dueDate: string;
  dueTime?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const runSql = <T = void>(sql: string, args: any[] = []): Promise<T> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          args,
          (_, result) => resolve(result as unknown as T),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      },
      reject
    );
  });
};

export const initializeDatabase = async (): Promise<void> => {
  await runSql(
    `CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      importance TEXT NOT NULL,
      recurrence_type TEXT NOT NULL,
      due_date TEXT NOT NULL,
      due_time TEXT,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );`
  );
};

export const fetchReminders = async (): Promise<Reminder[]> => {
  const result = await runSql<SQLite.SQLResultSet>(
    `SELECT * FROM reminders ORDER BY datetime(due_date) ASC;`
  );

  const rows = result.rows as unknown as { _array: any[] };
  return rows._array.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    importance: item.importance,
    recurrenceType: item.recurrence_type,
    dueDate: item.due_date,
    dueTime: item.due_time,
    category: item.category,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    completedAt: item.completed_at || undefined,
  }));
};

export const addReminderRow = async (reminder: Reminder): Promise<void> => {
  await runSql(
    `INSERT INTO reminders (id, title, description, importance, recurrence_type, due_date, due_time, category, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      reminder.id,
      reminder.title,
      reminder.description,
      reminder.importance,
      reminder.recurrenceType,
      reminder.dueDate,
      reminder.dueTime || null,
      reminder.category,
      reminder.createdAt,
      reminder.updatedAt,
      reminder.completedAt || null,
    ]
  );
};

export const toggleReminderCompleteRow = async (reminderId: string): Promise<void> => {
  const rows = await runSql<SQLite.SQLResultSet>(
    `SELECT completed_at FROM reminders WHERE id = ?;`,
    [reminderId]
  );

  const result = rows.rows as unknown as { _array: any[] };
  const existing = result._array[0];
  const completedAt = existing?.completed_at ? null : new Date().toISOString();

  await runSql(
    `UPDATE reminders SET completed_at = ?, updated_at = ? WHERE id = ?;`,
    [completedAt, new Date().toISOString(), reminderId]
  );
};
