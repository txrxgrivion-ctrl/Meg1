import { NextResponse } from "next/server";
import {
  updateOnlineStatus,
  getUsersState,
  getChatMessages,
  markMessagesAsRead,
  updatePushSubscription,
} from "@/db/db-helper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, pushSubscription, isOnline } = body;

    if (!userId || (userId !== "wesley" && userId !== "megane")) {
      return NextResponse.json({ error: "Utilisateur invalide" }, { status: 400 });
    }

    const partnerId = userId === "wesley" ? "megane" : "wesley";

    // 1. Heartbeat the current user's presence
    const onlineStatus = isOnline !== undefined ? isOnline : true;
    await updateOnlineStatus(userId, onlineStatus);

    // 2. If a push subscription was sent, store it
    if (pushSubscription) {
      await updatePushSubscription(userId, JSON.stringify(pushSubscription));
    }

    // 3. Mark all messages sent by partner to current user as read
    await markMessagesAsRead(partnerId, userId);

    // 4. Retrieve all messages
    const allMessages = await getChatMessages();

    // 5. Get current state of both users (to check partner status)
    const usersState = await getUsersState();
    const partnerInfo = userId === "wesley" ? usersState.megane : usersState.wesley;

    return NextResponse.json({
      success: true,
      messages: allMessages,
      otherUser: partnerInfo
        ? {
            id: partnerInfo.id,
            name: partnerInfo.name,
            isOnline: partnerInfo.isOnline,
            lastSeen: partnerInfo.lastSeen,
            avatar: partnerInfo.avatar,
          }
        : null,
    });
  } catch (err) {
    console.error("Sync API error:", err);
    return NextResponse.json({ error: "Erreur serveur de synchronisation" }, { status: 500 });
  }
}
