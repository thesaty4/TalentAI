# Spec 09 — Notifications Module

> Tell Copilot: **"implement spec 09"**
> Depends on: spec 03 (auth).
> Read `specs/product-overview.md` § 2.6 before starting.

---

## What this spec builds

`server/src/notifications/` — read and mark-seen endpoints for the notification bell.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/notifications` | all roles | Notifications for the logged-in user (newest first) |
| `PATCH` | `/notifications/mark-seen` | all roles | Mark all unseen notifications as seen |
| `PATCH` | `/notifications/:id/seen` | all roles | Mark a single notification as seen |

---

## Rules

- `GET /notifications`: return all notifications where `userId = req.user.id`, ordered by `createdAt DESC`. Include `unseenCount` in the response meta.
- A notification is scoped to the user who owns it — never return another user's notifications (R20 principle applies here too).
- The pipeline module (spec 06) already creates notifications inline. This module only reads them.

---

## Response shape

```json
{
  "data": [
    { "id": 1, "title": "Satya Mishra moved to Manager Screening", "description": "...", "createdAt": "...", "seen": false }
  ],
  "meta": { "total": 3, "unseenCount": 2 }
}
```

---

## Acceptance criteria

- Prince Verma → `GET /notifications` returns the 2 seeded notifications.
- `PATCH /notifications/mark-seen` → all set to `seen: true`; subsequent `GET` returns `unseenCount: 0`.
- Other user's notifications are never returned.
