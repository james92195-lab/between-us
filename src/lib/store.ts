import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  blankCircle,
  buildExpense,
  demoCircle,
  mentions,
  newId,
  type Circle,
  type Entry,
  type Offer,
} from "@/lib/ledger";

type Ledger = Circle & {
  addPerson: (name: string) => string | null;
  renamePerson: (id: string, name: string) => void;
  removePerson: (id: string) => string | null;
  addEntry: (entry: Entry) => void;
  logExpense: (input: {
    note: string;
    payerId: string;
    totalCents: number;
    memberIds: string[];
    roundUp: boolean;
  }) => void;
  logSettle: (input: { note: string; fromId: string; toId: string; amountCents: number }) => void;
  logDrop: (input: { note: string; personId: string; amountCents: number }) => void;
  donate: (amountCents: number, note: string) => string | null;
  setCause: (causeName: string, goalCents: number) => void;
  setOffer: (offer: Offer) => void;
  loadDemo: () => void;
  startBlank: () => void;
  replaceAll: (circle: Circle) => void;
};

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 24);
}

export const useLedger = create<Ledger>()(
  persist(
    (set, get) => ({
      ...demoCircle(),
      addPerson: (name) => {
        const cleaned = cleanName(name);
        if (!cleaned) return "Add a name.";
        if (get().people.length >= 16) return "This circle is full.";
        set({ people: [...get().people, { id: newId(), name: cleaned, isYou: false }] });
        return null;
      },
      renamePerson: (id, name) => {
        const cleaned = cleanName(name);
        if (!cleaned) return;
        set({
          people: get().people.map((person) => (person.id === id ? { ...person, name: cleaned } : person)),
        });
      },
      removePerson: (id) => {
        const person = get().people.find((item) => item.id === id);
        if (!person || person.isYou) return "You stay in the circle.";
        if (get().entries.some((entry) => mentions(entry, id))) {
          return "They’re already in the ledger. Start a blank circle if you want a fresh book.";
        }
        set({ people: get().people.filter((item) => item.id !== id) });
        return null;
      },
      addEntry: (entry) => set({ entries: [...get().entries, entry] }),
      logExpense: (input) => {
        const entry = buildExpense({
          id: newId(),
          at: Date.now(),
          note: input.note,
          payerId: input.payerId,
          totalCents: input.totalCents,
          memberIds: input.memberIds,
          roundUp: input.roundUp,
        });
        set({ entries: [...get().entries, entry] });
      },
      logSettle: (input) => {
        const entry: Entry = {
          id: newId(),
          kind: "settle",
          at: Date.now(),
          note: input.note.trim() || "Payback",
          fromId: input.fromId,
          toId: input.toId,
          amountCents: input.amountCents,
        };
        set({ entries: [...get().entries, entry] });
      },
      logDrop: (input) => {
        const entry: Entry = {
          id: newId(),
          kind: "drop",
          at: Date.now(),
          note: input.note.trim() || "Loose change",
          personId: input.personId,
          amountCents: input.amountCents,
        };
        set({ entries: [...get().entries, entry] });
      },
      donate: (amountCents, note) => {
        const have = get().entries.reduce((sum, entry) => {
          if (entry.kind === "expense") return sum + entry.shares.reduce((s, share) => s + share.roundupCents, 0);
          if (entry.kind === "drop") return sum + entry.amountCents;
          if (entry.kind === "donation") return sum - entry.amountCents;
          return sum;
        }, 0);
        if (amountCents > have) return "The jar doesn’t have that much.";
        const entry: Entry = {
          id: newId(),
          kind: "donation",
          at: Date.now(),
          note: note.trim() || "Given",
          cause: get().causeName,
          amountCents,
        };
        set({ entries: [...get().entries, entry] });
        return null;
      },
      setCause: (causeName, goalCents) => {
        const name = causeName.trim().slice(0, 60);
        if (!name || goalCents <= 0) return;
        set({ causeName: name, goalCents });
      },
      setOffer: (offer) => set({ offer }),
      loadDemo: () => set(demoCircle()),
      startBlank: () => set(blankCircle()),
      replaceAll: (circle) => set(circle),
    }),
    {
      name: "between-us",
      version: 1,
      partialize: (state) => ({
        people: state.people,
        entries: state.entries,
        causeName: state.causeName,
        goalCents: state.goalCents,
        offer: state.offer,
      }),
    },
  ),
);
