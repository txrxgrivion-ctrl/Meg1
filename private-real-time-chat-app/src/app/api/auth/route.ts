import { NextResponse } from "next/server";
import { authenticateUser, updateOnlineStatus } from "@/db/db-helper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
    }

    const user = await authenticateUser(password);

    if (!user) {
      return NextResponse.json(
        { error: "Mot de passe incorrect. Essaie 'etoile' ou 'crepuscule' !" },
        { status: 401 }
      );
    }

    // Set online status to true
    await updateOnlineStatus(user.id, true);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        isOnline: true,
      },
    });
  } catch (err) {
    console.error("Auth API error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
