import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "Ajo <onboarding@resend.dev>";
const APP_NAME = "Shaka Saves";

function naira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

async function send(to: string, subject: string, html: string): Promise<void> {
  await getResend().emails.send({ from: FROM, to, subject, html });
}

export async function sendPaymentSubmittedToAdmin(
  adminEmail: string,
  customerName: string,
  amount: number,
  periodsCount: number
): Promise<void> {
  await send(
    adminEmail,
    `New payment submission from ${customerName}`,
    `<p>${customerName} submitted a payment of <strong>${naira(amount)}</strong> for <strong>${periodsCount}</strong> period(s). Please log in to review and confirm.</p>`
  );
}

export async function sendPaymentConfirmedToCustomer(
  customerEmail: string,
  amount: number,
  periodsCount: number
): Promise<void> {
  await send(
    customerEmail,
    `Payment confirmed — ${naira(amount)}`,
    `<p>Your payment of <strong>${naira(amount)}</strong> has been confirmed. <strong>${periodsCount}</strong> period(s) have been ticked on your savings card.</p>`
  );
}

export async function sendPaymentRejectedToCustomer(
  customerEmail: string,
  amount: number,
  reason: string
): Promise<void> {
  await send(
    customerEmail,
    "Payment not confirmed",
    `<p>Your payment of <strong>${naira(amount)}</strong> could not be confirmed.</p><p>Reason: ${reason}</p><p>Please contact support if you believe this is an error.</p>`
  );
}

export async function sendWithdrawalRequestToAdmin(
  adminEmail: string,
  customerName: string,
  amount: number
): Promise<void> {
  await send(
    adminEmail,
    `Withdrawal request from ${customerName}`,
    `<p>${customerName} has requested a withdrawal of <strong>${naira(amount)}</strong>. Please log in to review.</p>`
  );
}

export async function sendWithdrawalApprovedToCustomer(
  customerEmail: string,
  amount: number
): Promise<void> {
  await send(
    customerEmail,
    "Withdrawal approved",
    `<p>Your withdrawal of <strong>${naira(amount)}</strong> has been approved and will be processed shortly.</p>`
  );
}

export async function sendWithdrawalRejectedToCustomer(
  customerEmail: string,
  amount: number,
  reason: string
): Promise<void> {
  await send(
    customerEmail,
    "Withdrawal declined",
    `<p>Your withdrawal request of <strong>${naira(amount)}</strong> was declined.</p><p>Reason: ${reason}</p>`
  );
}

export async function sendWithdrawalPaidToCustomer(
  customerEmail: string,
  amount: number
): Promise<void> {
  await send(
    customerEmail,
    "Withdrawal paid",
    `<p>Your withdrawal of <strong>${naira(amount)}</strong> has been paid out. Please check your account.</p>`
  );
}

export async function sendWelcomeEmail(
  customerEmail: string,
  customerName: string
): Promise<void> {
  await send(
    customerEmail,
    `Welcome to ${APP_NAME} — here's how to get started`,
    `<h2>Welcome, ${customerName}!</h2>
    <p>Your ${APP_NAME} savings account is ready. Here's how to get started:</p>
    <ol>
      <li>Log in at your dashboard</li>
      <li>View the admin's bank details on the payment page</li>
      <li>Make a transfer and upload your proof</li>
      <li>Your savings card will be updated once confirmed</li>
    </ol>
    <p>Happy saving!</p>`
  );
}
