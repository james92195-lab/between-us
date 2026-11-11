# Shared jar

A jar is a friends’ pot inside a circle. “Circle” here means the people in this book, not a crypto network.

## On this device

You can create a jar, set a goal, add and deactivate members, record promised contributions, and run a withdrawal vote. The book is `localStorage` key `between-us-book` in this browser. It is not synced to other people or other devices. Choosing someone’s name to “record a yes” is a notebook entry. It is not their password and it does not prove they agreed.

Recorded amounts are promises. Provider-confirmed amounts stay at zero. Neither number is a spendable wallet balance. Custody — who would legally hold real money — is `undecided`.

## The vote

A withdrawal is bound to the jar, an integer cent amount, currency `USD`, the destination person, and the purpose. That binding plus a revision is what a yes attaches to.

- The requester cannot approve their own request.
- Exactly 3 other **active members of that jar** must each approve the current binding.
- The same person cannot approve twice. Repeating the same yes is ignored.
- If the amount, destination, or purpose changes, the revision increments and old yeses stop counting.
- If there are fewer than 3 other active members, the request is **blocked**. The threshold does not drop to 2 or 1.
- Deactivating a voter, or the requester, removes that person from the count. A request that was policy-approved becomes blocked. Old yeses are not revived when someone is marked active again.
- One other active member can reject. The requester can cancel. A concurrent reject wins over concurrent yeses when the two copies are merged.
- Execution is idempotent per key. It records a check and sets `fundsMoved` to false. Confirmed cents are not reduced, so a second check cannot double-spend.

Policy approved means the notebook rule is satisfied. It does not mean a transfer was created.

## Still undecided before real money

These have to be chosen in writing before a jar can take or pay out real funds:

1. Who may request a withdrawal. Today any active jar member can open a request in the notebook.
2. Custody and the legal structure. Pooled friend money may be a money-transmitter, escrow, or informal custody problem. This app does not pick one.
3. Whether Dwolla (or anyone) will approve holding or pooling those funds. Their user-to-user transfer product is not treated as a shared wallet here.
4. What “confirmed” means: which webhook, on which leg of Dwolla’s multi-hop transfer, after the destination bank shows `processed`, matched to a server ledger row.
5. Authenticated membership. Each voter needs a server account whose membership row is checked on the server. A browser check is not authorization.
6. Where the server and database run. GitHub Pages cannot do this.

Until those exist, deposits and withdrawals are not executed.
