/** Canonical event names. Add here first so dashboards and code agree. */
export const EVENTS = {
  signup: 'signup',
  onboarding_completed: 'onboarding_completed',
  page_view: 'page_view',
  status_set: 'status_set',
  chat_started: 'chat_started',
  report_filed: 'report_filed',
  subscribe_started: 'subscribe_started',
  subscribed: 'subscribed',
  subscription_cancelled: 'subscription_cancelled',
  payment_failed: 'payment_failed',
  payment_completed: 'payment_completed',
  account_deleted: 'account_deleted',
  feedback_sent: 'feedback_sent',
  data_exported: 'data_exported',
  password_changed: 'password_changed',
  email_unsubscribed: 'email_unsubscribed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS] | (string & {});
