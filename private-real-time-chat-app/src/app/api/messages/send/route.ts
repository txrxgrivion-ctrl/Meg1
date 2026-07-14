import { NextResponse } from "next/server";
import { sendChatMessage } from "@/db/db-helper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { senderId, recipientId, content, mediaData, mediaType, fileName } = body;

    if (!senderId || !recipientId) {
      return NextResponse.json({ error: "Expéditeur et destinataire requis" }, { status: 400 });
    }

    if (!content && !mediaData) {
      return NextResponse.json({ error: "Le message ne peut pas être vide" }, { status: 400 });
    }

    const newMessage = await sendChatMessage({
      senderId,
      recipientId,
      content,
      mediaData,
      mediaType,
      fileName,
    });

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (err) {
    console.error("Send message API error:", err);
    return NextResponse.json({ error: "Erreur lors de l'envoi du message" }, { status: 500 });
  }
}
