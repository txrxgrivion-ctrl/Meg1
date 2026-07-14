import { pgTable, varchar, boolean, timestamp, text, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 50 }).primaryKey(), // 'wesley' or 'megane'
  name: varchar("name", { length: 100 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
  pushSubscription: text("push_subscription"), // JSON string of Web Push Subscription
  avatar: text("avatar"), // URL or base64
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id", { length: 50 }).references(() => users.id).notNull(),
  recipientId: varchar("recipient_id", { length: 50 }).references(() => users.id).notNull(),
  content: text("content"),
  mediaData: text("media_data"), // base64 encoded file content
  mediaType: varchar("media_type", { length: 50 }), // 'image' | 'video' | 'pdf' | 'audio'
  fileName: varchar("file_name", { length: 255 }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
