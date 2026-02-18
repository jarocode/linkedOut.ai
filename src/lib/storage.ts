import { Storage } from "@plasmohq/storage"

import type { Cache, Usage, UserPrefs } from "./types"

const storage = new Storage()

const DEFAULT_PREFS: UserPrefs = {
  apiBaseUrl: "https://example.com", // set yours in Options
  tone: "professional",
  cta: "ask_15min_call",
  calendarLink: "",

  outreachOnly: true,
  minConfidence: 0.75,
  allowInboundDismissTemplates: true,

  maxMessagesToSend: 10,
  maskEmailsPhones: true
}

const DEFAULT_USAGE: Usage = {
  usedThisMonth: 0,
  limitThisMonth: 100,
  lastUpdatedAt: Date.now()
}

const DEFAULT_CACHE: Cache = {
  classifications: {},
  suggestions: {},
  ignoredThreads: {}
}

export const StorageKeys = {
  prefs: "prefs",
  usage: "usage",
  cache: "cache",
  authToken: "authToken" // optional if your backend needs it
} as const

export async function getPrefs(): Promise<UserPrefs> {
  return (await storage.get<UserPrefs>(StorageKeys.prefs)) ?? DEFAULT_PREFS
}

export async function setPrefs(prefs: UserPrefs) {
  await storage.set(StorageKeys.prefs, prefs)
}

export async function getUsage(): Promise<Usage> {
  return (await storage.get<Usage>(StorageKeys.usage)) ?? DEFAULT_USAGE
}

export async function setUsage(u: Usage) {
  await storage.set(StorageKeys.usage, u)
}

export async function getCache(): Promise<Cache> {
  return (await storage.get<Cache>(StorageKeys.cache)) ?? DEFAULT_CACHE
}

export async function setCache(c: Cache) {
  await storage.set(StorageKeys.cache, c)
}

export async function getAuthToken(): Promise<string | null> {
  return (await storage.get<string>(StorageKeys.authToken)) ?? null
}

export async function setAuthToken(token: string) {
  await storage.set(StorageKeys.authToken, token)
}
