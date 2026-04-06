import { create } from 'zustand';
import {
  Reminder,
  addReminderRow,
  deleteReminderRow,
  fetchReminders,
  initializeDatabase,
  toggleReminderCompleteRow,
  updateReminderRow,
} from '@/utils/database';

interface ReminderStore {
  initialized: boolean;
  reminders: Reminder[];
  loadReminders: () => Promise<void>;
  addReminder: (reminder: Reminder) => Promise<void>;
  updateReminder: (reminder: Reminder) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
}

export const useReminders = create<ReminderStore>((set) => ({
  initialized: false,
  reminders: [],
  loadReminders: async () => {
    await initializeDatabase();
    const rows = await fetchReminders();
    set({ initialized: true, reminders: rows });
  },
  addReminder: async (reminder) => {
    await initializeDatabase();
    await addReminderRow(reminder);
    const rows = await fetchReminders();
    set({ reminders: rows });
  },
  updateReminder: async (reminder) => {
    await initializeDatabase();
    await updateReminderRow(reminder);
    const rows = await fetchReminders();
    set({ reminders: rows });
  },
  deleteReminder: async (id) => {
    await initializeDatabase();
    await deleteReminderRow(id);
    const rows = await fetchReminders();
    set({ reminders: rows });
  },
  toggleComplete: async (id) => {
    await initializeDatabase();
    await toggleReminderCompleteRow(id);
    const rows = await fetchReminders();
    set({ reminders: rows });
  },
}));
