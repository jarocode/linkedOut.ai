import type {
  ReplySuggestion,
  ThreadClassification,
  ThreadSnapshot,
  Usage,
  UserPrefs
} from "./types"

export type BgRequest =
  | { type: "GET_PREFS" }
  | { type: "SET_PREFS"; prefs: UserPrefs }
  | { type: "GET_USAGE" }
  | { type: "CLASSIFY_THREAD"; snapshot: ThreadSnapshot }
  | { type: "GENERATE_REPLY"; snapshot: ThreadSnapshot; force?: boolean }
  | { type: "REGENERATE_REPLY"; snapshot: ThreadSnapshot }
  | { type: "IGNORE_THREAD"; threadId: string; ignore: boolean }

export type BgResponse =
  | { ok: true; type: "GET_PREFS"; prefs: UserPrefs }
  | { ok: true; type: "SET_PREFS" }
  | { ok: true; type: "GET_USAGE"; usage: Usage }
  | { ok: true; type: "CLASSIFY_THREAD"; classification: ThreadClassification }
  | {
      ok: true
      type: "GENERATE_REPLY"
      suggestion: ReplySuggestion
      classification?: ThreadClassification
    }
  | { ok: true; type: "REGENERATE_REPLY"; suggestion: ReplySuggestion }
  | { ok: true; type: "IGNORE_THREAD" }
  | { ok: false; type: "ERROR"; error: string }

export async function sendToBackground(req: BgRequest): Promise<BgResponse> {
  return await chrome.runtime.sendMessage(req)
}
