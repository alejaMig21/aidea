// Permission requests from the builder wait here until the person answers them.
// A "conversation" is one exchange with the builder. It has two secrets:
//   - a token, in the address of the builder's permission tool, so only the Claude Code process we started can ask;
//   - an answer secret, sent only to the person's interface inside the stream, so only the interface can answer.
// The builder must not be able to approve its own requests, so it never learns the answer secret.
import { randomBytes, timingSafeEqual } from "node:crypto";

export type Decision = { behavior: "allow" } | { behavior: "deny"; message: string };

const MAX_PENDING = 20; // requests one conversation may have waiting at once

type Conversation = { project: string; secret: string; emit: (event: object) => void; pending: Set<string> };
type Request = { conversation: Conversation; resolve: (decision: Decision) => void };

export const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createBroker() {
  const conversations = new Map<string, Conversation>(); // token -> conversation
  const requests = new Map<string, Request>(); // request id -> who is waiting
  let counter = 0;

  return {
    // A conversation starts, about one Project. `emit` sends an event to the person's chat stream.
    open(emit: (event: object) => void, project: string) {
      const token = randomBytes(16).toString("hex");
      const conversation: Conversation = { project, secret: randomBytes(16).toString("hex"), emit, pending: new Set() };
      conversations.set(token, conversation);
      return {
        token,
        // The conversation is over: whatever is still waiting is denied, so the builder does not hang.
        close() {
          conversations.delete(token);
          for (const id of conversation.pending) {
            requests.get(id)?.resolve({ behavior: "deny", message: "The conversation ended before the person answered" });
            requests.delete(id);
          }
          conversation.pending.clear();
        },
      };
    },

    isOpen: (token: string) => conversations.has(token),

    // What the builder's tools need to know about the conversation they belong to.
    conversationOf(token: string): { project: string; secret: string; emit: (event: object) => void } | undefined {
      const c = conversations.get(token);
      return c && { project: c.project, secret: c.secret, emit: c.emit };
    },

    // The builder asks for permission. Resolves when the person answers; undefined if the conversation is not running.
    // `gaveUp` fires when the builder stops waiting (Claude Code drops a request that goes unanswered for too long):
    // the card is withdrawn so the person is not left answering a question nobody is listening to.
    ask(token: string, tool: string, input: unknown, gaveUp?: AbortSignal): Promise<Decision> | undefined {
      const conversation = conversations.get(token);
      if (!conversation) return undefined;
      if (conversation.pending.size >= MAX_PENDING) {
        return Promise.resolve({ behavior: "deny", message: "Too many requests are waiting for the person" });
      }
      const id = `perm-${++counter}`;
      return new Promise((resolve) => {
        requests.set(id, { conversation, resolve });
        conversation.pending.add(id);
        conversation.emit({ type: "permission", id, secret: conversation.secret, tool, input });
        gaveUp?.addEventListener(
          "abort",
          () => {
            if (!requests.delete(id)) return; // already answered
            conversation.pending.delete(id);
            resolve({ behavior: "deny", message: "The builder stopped waiting for the person" });
            conversation.emit({ type: "permission_expired", id });
          },
          { once: true },
        );
      });
    },

    // The person answers. "forbidden" when the secret is not the conversation's, "unknown" when the request is not
    // waiting (never asked, or already answered).
    answer(id: string, secret: string, decision: Decision): "answered" | "unknown" | "forbidden" {
      const request = requests.get(id);
      if (!request) return "unknown";
      if (!sameSecret(secret, request.conversation.secret)) return "forbidden";
      requests.delete(id);
      request.conversation.pending.delete(id);
      request.resolve(decision);
      return "answered";
    },
  };
}

export type Broker = ReturnType<typeof createBroker>;
