// Admin activity log entries (adminLog collection), shared by the API
// routes and the Activity page.

export const ACTIONS = {
  "business.approve": "Approved business",
  "business.reject": "Rejected business",
  "business.suspend": "Suspended business",
  "business.delete": "Deleted business",
  "business.edit": "Edited business",
  "business.googleLink": "Changed Google link",
  "business.removePhoto": "Removed cover photo",
  "business.nudge": "Sent seat-update reminder",
  "account.disable": "Disabled account",
  "account.enable": "Enabled account",
  "account.resetLink": "Created password reset link",
  "admin.add": "Added admin",
  "admin.remove": "Removed admin",
  "settings.features": "Changed feature switches",
  "settings.twoFactor": "Changed two-factor sign-in",
  "inbox.handled": "Marked inbox item handled",
  "inbox.reopened": "Reopened inbox item",
} as const;

export type ActionKey = keyof typeof ACTIONS;

export type LogEntry = {
  id: string;
  action: ActionKey;
  actorUid: string;
  actorEmail: string;
  targetType: "business" | "account" | "admin" | "settings" | "inbox";
  targetId: string;
  targetName: string;
  details: string;
  createdMs: number | null;
};

// Actions the browser may report (the rest are only logged by the server
// routes that perform them).
export const CLIENT_ACTIONS: ActionKey[] = [
  "business.approve",
  "business.reject",
  "business.suspend",
  "business.delete",
  "business.googleLink",
  "inbox.handled",
  "inbox.reopened",
];
