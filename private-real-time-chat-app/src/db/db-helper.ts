import { db } from "@/db";
import { users, messages } from "./schema";
import { eq, or, and, asc, desc } from "drizzle-orm";

// Automatically seed users if they don't exist
export async function ensureUsersSeeded() {
  try {
    // Check if wesley exists
    const wesleyCheck = await db.select().from(users).where(eq(users.id, "wesley")).limit(1);
    if (wesleyCheck.length === 0) {
      await db.insert(users).values({
        id: "wesley",
        name: "Wesley",
        password: "lune", // Secondary password: 'wesley' handled in authentication code
        isOnline: false,
        lastSeen: new Date(),
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200", // placeholder
      });
    }

    // Check if megane exists
    const meganeCheck = await db.select().from(users).where(eq(users.id, "megane")).limit(1);
    if (meganeCheck.length === 0) {
      await db.insert(users).values({
        id: "megane",
        name: "Mégane",
        password: "soleil", // Secondary password: 'megane' handled in authentication code
        isOnline: false,
        lastSeen: new Date(),
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200", // placeholder
      });
    }
  } catch (error) {
    console.error("Seeding users failed:", error);
  }
}

export async function authenticateUser(passwordInput: string) {
  await ensureUsersSeeded();
  const normalized = passwordInput.trim().toLowerCase();

  // Map allowed passwords to user IDs
  if (normalized === "wesley" || normalized === "etoile" || normalized === "étoile" || normalized === "wes") {
    const user = await db.select().from(users).where(eq(users.id, "wesley")).limit(1);
    return user[0] || null;
  }

  if (normalized === "megane" || normalized === "crepuscule" || normalized === "crépuscule" || normalized === "meg") {
    const user = await db.select().from(users).where(eq(users.id, "megane")).limit(1);
    return user[0] || null;
  }

  return null;
}

export async function updateOnlineStatus(userId: string, isOnline: boolean) {
  await ensureUsersSeeded();
  try {
    await db
      .update(users)
      .set({
        isOnline,
        lastSeen: new Date(),
      })
      .where(eq(users.id, userId));
  } catch (err) {
    console.error(`Failed to update status for ${userId}:`, err);
  }
}

export async function getUsersState() {
  await ensureUsersSeeded();
  try {
    const allUsers = await db.select().from(users);
    return {
      wesley: allUsers.find((u) => u.id === "wesley") || null,
      megane: allUsers.find((u) => u.id === "megane") || null,
    };
  } catch (err) {
    console.error("Failed to get users state:", err);
    return { wesley: null, megane: null };
  }
}

export async function getChatMessages() {
  await ensureUsersSeeded();
  try {
    // There are only two users, so we can just grab all messages in chronological order
    const list = await db
      .select()
      .from(messages)
      .orderBy(asc(messages.createdAt));
    return list;
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    return [];
  }
}

export async function sendChatMessage(params: {
  senderId: string;
  recipientId: string;
  content?: string;
  mediaData?: string;
  mediaType?: string;
  fileName?: string;
}) {
  await ensureUsersSeeded();
  try {
    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: params.senderId,
        recipientId: params.recipientId,
        content: params.content || null,
        mediaData: params.mediaData || null,
        mediaType: params.mediaType || null,
        fileName: params.fileName || null,
        isRead: false,
        createdAt: new Date(),
      })
      .returning();

    // Also bump active status for sender
    await updateOnlineStatus(params.senderId, true);

    return newMessage;
  } catch (err) {
    console.error("Failed to send message:", err);
    throw err;
  }
}

export async function markMessagesAsRead(senderId: string, recipientId: string) {
  try {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.senderId, senderId),
          eq(messages.recipientId, recipientId),
          eq(messages.isRead, false)
        )
      );
  } catch (err) {
    console.error("Failed to mark messages as read:", err);
  }
}

export async function updatePushSubscription(userId: string, subscriptionJson: string | null) {
  await ensureUsersSeeded();
  try {
    await db
      .update(users)
      .set({ pushSubscription: subscriptionJson })
      .where(eq(users.id, userId));
  } catch (err) {
    console.error("Failed to update push subscription:", err);
  }
}
