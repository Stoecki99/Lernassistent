// app/(dashboard)/chat/page.tsx
// Chat-Seite: Laedt letzte Chat-Nachrichten aus DB, uebergibt an Client Component.

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ChatFenster from "@/components/features/ChatFenster"

export const metadata = {
  title: "Chat - Lernassistent",
  description: "Chatte mit deinem KI-Lernassistenten",
}

/** Max Nachrichten, die initial geladen werden */
const INITIAL_MESSAGES = 50

export default async function ChatPage() {
  const user = await getCurrentUser()

  if (!user?.id) {
    redirect("/login")
  }

  const messagesDesc = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: INITIAL_MESSAGES,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  })

  // Neueste 50 laden (desc), dann chronologisch sortieren
  const messages = messagesDesc.reverse()

  // Decks fuer "Direkt importieren" Funktion laden
  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      icon: true,
    },
  })

  const serializedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  }))

  const serializedDecks = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    icon: deck.icon,
  }))

  return <ChatFenster initialMessages={serializedMessages} decks={serializedDecks} />
}
