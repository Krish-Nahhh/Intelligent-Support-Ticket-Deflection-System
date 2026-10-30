import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../lib/db";

const seedTickets = (
  [
    // Login
    ["Can't log in to my account", "I enter my password but it says invalid credentials.", "Use 'Forgot password' to reset it, then clear browser cookies and retry."],
    ["Password reset email never arrives", "I requested a reset link but nothing shows up in my inbox.", "Check spam, confirm the email on file, and request again. Links expire after 30 minutes."],
    ["Account locked after failed attempts", "Too many wrong tries and now I'm blocked from signing in.", "Locks lift automatically after 15 minutes. Reset your password to unlock sooner."],
    ["Two-factor code not working", "The 6-digit code from my authenticator app is rejected every time.", "Sync your phone's clock to automatic time, then use a fresh code. Use a backup code if it still fails."],
    ["Forgot which email I signed up with", "I can't remember the address I used to register.", "Search your inboxes for our welcome email, or contact support with your order number to look it up."],
    // Billing
    ["Charged twice for one order", "My card shows two payments for the same purchase.", "Duplicate holds drop off within 3-5 business days. If a second charge settles, we refund it automatically."],
    ["Payment declined at checkout", "My card keeps getting rejected when I try to pay.", "Verify card number, expiry and billing address, or try another card. Contact your bank if it persists."],
    ["Need a GST invoice for my purchase", "I need a tax invoice with my company details for accounting.", "Go to Orders, open the order and choose Download Invoice. Add company details in Billing Settings first."],
    ["Promo code not applying", "The discount code says invalid even though I just received it.", "Check the code's expiry and minimum cart value. Codes can't be combined with other offers."],
    ["Unknown charge on my statement", "There's a transaction from your company I don't recognize.", "Check Orders and Subscriptions for that amount. If it isn't there, contact us and we'll investigate and reverse it."],
    // Shipping
    ["Package hasn't arrived", "Tracking has shown 'in transit' for over a week.", "Allow 2 extra business days, then contact the carrier with your tracking ID. We reship if it's lost."],
    ["Marked delivered but I never got it", "Tracking says delivered yesterday but nothing is at my door.", "Check with neighbors and the building reception. If it doesn't turn up in 48 hours, we open a carrier investigation."],
    ["Change delivery address after ordering", "I entered the wrong address and need to update it.", "Address changes are possible before dispatch. Contact us with your order number right away."],
    ["Received the wrong item", "The product in the box isn't what I ordered.", "Send a photo of the item and label. We'll ship the correct one and arrange a free pickup."],
    ["Item arrived damaged", "The box was crushed and the product is broken.", "Upload photos of the packaging and item within 7 days. We'll send a replacement or refund."],
    // Refunds and returns
    ["How do I return an item", "I want to send back something I bought last week.", "Open Orders, choose Return Item, and print the label. Returns are accepted within 30 days."],
    ["Refund hasn't shown up", "I returned the product two weeks ago but no money back yet.", "Refunds take 5-7 business days after we receive the item. Check your bank's pending credits."],
    ["Cancel order before it ships", "I ordered by mistake and want to cancel right now.", "Orders can be cancelled until dispatch. Use Cancel Order in your Orders page for an instant refund."],
    ["Exchange for a different size", "The size doesn't fit and I want a bigger one.", "Start an exchange from Orders, pick the new size, and we ship it once your return is scanned."],
    ["Return window has passed", "It's been 45 days and I still want to return it.", "Returns after 30 days can't be refunded automatically. Contact us and we'll offer store credit where possible."],
    // App problems
    ["App crashes on launch", "The app opens for a second and then closes immediately.", "Update to the latest version, restart your phone, and reinstall if needed. Your data is stored in your account."],
    ["App freezes on loading screen", "It just spins forever and never gets to the home page.", "Check your internet connection, force close the app, and clear its cache in system settings."],
    ["Not getting push notifications", "I don't receive any alerts from the app anymore.", "Enable notifications for the app in system settings and disable battery optimization for it."],
    ["Can't upload photos", "Choosing an image does nothing or shows an error.", "Make sure the file is under 10 MB and JPG or PNG, and grant the app photo permission."],
    ["Website shows a blank white page", "The page loads but everything is empty.", "Hard refresh with Ctrl+Shift+R, disable extensions, or try a private window. Clear site data if it persists."],
    // Account settings
    ["Change my email address", "I want my account linked to a new email.", "Go to Profile > Security > Email, enter the new address, and confirm the link we send."],
    ["Update my phone number", "My number changed and I need to update it.", "Edit it under Profile > Contact. You'll verify the new number with a one-time code."],
    ["Delete my account and data", "I want my account and personal data permanently removed.", "Request deletion in Privacy Settings. Data is erased within 30 days and this can't be undone."],
    ["Change my display name", "My name is spelled wrong on my profile.", "Update it under Profile > Personal Info. Changes appear immediately."],
    ["Stop marketing emails", "I keep getting promotional emails and want them to stop.", "Click Unsubscribe in any email or turn off Marketing under Notification Settings."],
    // Subscriptions
    ["Cancel my subscription", "I want to stop my monthly plan.", "Go to Billing > Subscription > Cancel. You keep access until the end of the paid period."],
    ["Upgrade to a higher plan", "I need more features and want to move up a tier.", "Choose Change Plan in Billing. You pay only the prorated difference today."],
    ["Charged after I cancelled", "My subscription renewed even though I cancelled it.", "Cancellations must be made 24 hours before renewal. Contact us with the date and we'll refund the latest charge."],
    ["Pause my subscription", "I'll be away for two months and don't want to pay.", "Pause for up to 3 months from Billing > Subscription. Billing resumes automatically afterwards."],
    ["Switch from monthly to annual billing", "I'd like to pay yearly to save money.", "Select Annual under Change Plan. Your unused monthly balance is credited toward the yearly price."],
    // Product help
    ["Product stopped working under warranty", "My device died after four months of normal use.", "It's covered by the 12-month warranty. Submit a claim with your order number and we'll repair or replace it."],
    ["Device won't pair with my phone", "Bluetooth pairing keeps failing during setup.", "Forget the device in Bluetooth settings, hold the power button for 10 seconds to reset, then pair again."],
    ["Battery drains very fast", "It goes from full to empty in a few hours.", "Update the firmware, lower the screen brightness, and turn off background sync. Request a battery check if it continues."],
    ["Accessory missing from the box", "The charger wasn't included in my package.", "Send a photo of the box contents and your order number. We'll ship the missing accessory free of charge."],
    ["Product won't turn on at all", "I charged it overnight and there's no sign of life.", "Try a different cable and outlet, then hold the power button for 15 seconds. If dead, start a warranty claim."],
  ] as [string, string, string][]
).map(([title, description, solution]) => ({ title, description, solution }));

async function main() {
  await pool.query("TRUNCATE solution_suggestions, resolutions, tickets, users RESTART IDENTITY CASCADE");

  const hash = await bcrypt.hash("password123", 10);
  const users = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
      ('Admin', 'admin@test.com', $1, 'admin'),
      ('Agent', 'agent@test.com', $1, 'agent'),
      ('Customer', 'customer@test.com', $1, 'customer')
     RETURNING id, role`,
    [hash]
  );
  const id = (r: string) => users.rows.find((u) => u.role === r).id;

  for (const t of seedTickets) {
    const ticket = await pool.query(
      `INSERT INTO tickets (customer_id, assigned_agent_id, title, description, status, resolved_at)
       VALUES ($1, $2, $3, $4, 'resolved', now()) RETURNING id`,
      [id("customer"), id("agent"), t.title, t.description]
    );
    await pool.query(
      `INSERT INTO resolutions (ticket_id, agent_id, solution_text) VALUES ($1, $2, $3)`,
      [ticket.rows[0].id, id("agent"), t.solution]
    );
  }

  console.log("Seeded");
  await pool.end();
}
main();