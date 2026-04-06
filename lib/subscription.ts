// lib/subscription.ts
// Zentrales Modul fuer Abo-Plan-Checks, Speicher-Limits und API-Usage-Tracking.

import { prisma } from "@/lib/prisma"

export const PLAN_LIMITS = {
  free: {
    storageBytes: 1n * 1024n * 1024n * 1024n, // 1 GB
    canChat: false,
  },
  pro: {
    storageBytes: 6n * 1024n * 1024n * 1024n, // 6 GB
    canChat: true,
    monthlyApiCostCapUsd: 2,
  },
} as const

// Sonnet 4.6 Preise: $3/M input, $15/M output
const INPUT_COST_PER_TOKEN = 3 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000

export type PlanType = "free" | "pro"

interface UserPlanResult {
  plan: PlanType
  isExpired: boolean
  planExpiresAt: Date | null
}

export async function getUserPlan(userId: string): Promise<UserPlanResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  })

  if (!user || user.plan !== "pro") {
    return { plan: "free", isExpired: false, planExpiresAt: null }
  }

  const isExpired = user.planExpiresAt ? user.planExpiresAt < new Date() : false

  return {
    plan: isExpired ? "free" : "pro",
    isExpired,
    planExpiresAt: user.planExpiresAt,
  }
}

export async function canUseChat(userId: string): Promise<boolean> {
  const { plan } = await getUserPlan(userId)
  return PLAN_LIMITS[plan].canChat
}

interface StorageCheckResult {
  allowed: boolean
  currentUsageBytes: bigint
  limitBytes: bigint
}

export async function checkStorageLimit(
  userId: string,
  additionalBytes: number
): Promise<StorageCheckResult> {
  const [user, { plan }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsedBytes: true },
    }),
    getUserPlan(userId),
  ])

  const currentUsageBytes = user?.storageUsedBytes ?? 0n
  const limitBytes = PLAN_LIMITS[plan].storageBytes
  const allowed = currentUsageBytes + BigInt(additionalBytes) <= limitBytes

  return { allowed, currentUsageBytes, limitBytes }
}

export async function checkApiCostLimit(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiTokensUsedThisMonth: true, apiUsageResetAt: true },
  })

  if (!user) return false

  const now = new Date()

  // Monatlicher Reset: Wenn apiUsageResetAt in der Vergangenheit liegt, Counter zuruecksetzen
  if (user.apiUsageResetAt < now) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        apiTokensUsedThisMonth: 0,
        apiUsageResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    })
    return true
  }

  // Grobe Kostenschaetzung: Angenommen 50% input, 50% output Tokens
  const estimatedCost = estimateApiCostFromTokens(user.apiTokensUsedThisMonth)
  return estimatedCost < PLAN_LIMITS.pro.monthlyApiCostCapUsd
}

export function estimateApiCostFromTokens(totalTokens: number): number {
  // Konservative Schaetzung: 30% input, 70% output (output ist teurer)
  const inputTokens = Math.round(totalTokens * 0.3)
  const outputTokens = Math.round(totalTokens * 0.7)
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export function estimateApiCostUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export async function incrementApiUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const totalTokens = inputTokens + outputTokens

  await prisma.user.update({
    where: { id: userId },
    data: {
      apiTokensUsedThisMonth: { increment: totalTokens },
    },
  })
}

export function estimateCardBytes(front: string, back: string, hint?: string | null): number {
  return Buffer.byteLength(front + back + (hint ?? ""), "utf-8")
}

export async function incrementStorageUsed(userId: string, bytes: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsedBytes: { increment: BigInt(bytes) } },
  })
}

export async function decrementStorageUsed(userId: string, bytes: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsedBytes: { decrement: BigInt(bytes) } },
  })
}
