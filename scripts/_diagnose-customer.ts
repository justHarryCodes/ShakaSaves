// READ-ONLY — diagnoses why a specific customer can't withdraw.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as admin from "firebase-admin";

const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) });

const NAME_QUERY = process.argv[2] ?? "Stephen Maxwell";

function computeWithdrawable(card: any) {
  const dailyAmt = card.dailyAmount ?? 0;
  const hasCommission = card.category !== "FoodBank";
  const commissionMonths = hasCommission
    ? new Set((card.tickedPeriods ?? []).map((p: string) => p.slice(0, 7))).size
    : 0;
  const calendarCommission = commissionMonths * dailyAmt;
  const migrationCommission = card.migrated ? (card.migrationAdminCommission ?? 0) : 0;
  const additionalCommission = Math.max(0, calendarCommission - migrationCommission);
  const commissionHeld = migrationCommission + additionalCommission;
  const withdrawable = Math.max(0, card.currentBalance - additionalCommission);
  const withdrawnAmount = card.migrationAmountWtd ?? 0;
  const grossSaved = Math.max(0, card.currentBalance + withdrawnAmount - additionalCommission);
  return { withdrawable, additionalCommission, commissionHeld, grossSaved, calendarCommission, migrationCommission, commissionMonths };
}

function resolveEffectivePlan(category: string | undefined, plan: any) {
  if (plan) return { name: plan.name, lockDays: plan.lockDays, targetAmount: plan.targetAmount };
  const cat = (category ?? "").toLowerCase();
  if (!cat || cat === "regular") return null;
  if (cat === "foodbank") return { name: "FoodBank", lockDays: 365 };
  if (cat === "project 1m") return { name: "Project 1M", targetAmount: 1_000_000 };
  return { name: category ?? "Savings Plan" };
}

async function run() {
  const db = admin.firestore();

  const customersSnap = await db.collection("customers").get();
  const matches = customersSnap.docs.filter(d => {
    const name = (d.data().fullName ?? "").toLowerCase();
    return NAME_QUERY.toLowerCase().split(" ").every(part => name.includes(part));
  });

  if (matches.length === 0) {
    console.log(`No customer found matching "${NAME_QUERY}". Listing close-ish names:`);
    const q = NAME_QUERY.toLowerCase().split(" ")[0];
    customersSnap.docs.forEach(d => {
      const name = (d.data().fullName ?? "").toLowerCase();
      if (name.includes(q)) console.log(" -", d.data().fullName, d.id);
    });
    process.exit(0);
  }

  const plansSnap = await db.collection("savings_plans").get();
  const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  for (const custDoc of matches) {
    const customer = { id: custDoc.id, ...custDoc.data() } as any;
    console.log(`\n=== Customer: ${customer.fullName} (id=${customer.id}, uid=${customer.uid}) ===`);
    console.log("  customer.currentBalance:", customer.currentBalance, " status:", customer.status, " deletedAt:", customer.deletedAt);

    // Pending withdrawals block new requests
    const pendingSnap = await db.collection("withdrawals").where("customerId", "==", customer.id).where("status", "==", "pending").get();
    if (!pendingSnap.empty) {
      console.log(`  ⚠ HAS ${pendingSnap.size} PENDING WITHDRAWAL(S) — this alone blocks new requests on /dashboard/withdraw`);
      pendingSnap.docs.forEach(d => console.log("     ", d.id, d.data().amountRequested, d.data().requestedAt?.toDate?.()));
    }
    const approvedSnap = await db.collection("withdrawals").where("customerId", "==", customer.id).where("status", "==", "approved").get();
    if (!approvedSnap.empty) {
      console.log(`  ⚠ HAS ${approvedSnap.size} APPROVED-NOT-YET-PAID WITHDRAWAL(S)`);
      approvedSnap.docs.forEach(d => console.log("     ", d.id, d.data().amountRequested));
    }

    const cardsSnap = await db.collection("savings_cards").where("customerId", "==", customer.id).get();
    if (cardsSnap.empty) { console.log("  NO CARDS FOUND for this customer."); continue; }

    for (const cardDoc of cardsSnap.docs) {
      const card = { id: cardDoc.id, ...cardDoc.data() } as any;
      const firestorePlan = plans.find(p => p.name?.toLowerCase() === (card.category ?? "").toLowerCase()) ?? null;
      const effective = resolveEffectivePlan(card.category, firestorePlan);
      const r = computeWithdrawable(card);

      let lockedReason = null;
      if (effective?.lockDays) {
        const createdMs = card.createdAt?.toMillis?.() ?? Date.now();
        const daysHeld = (Date.now() - createdMs) / 86_400_000;
        if (daysHeld < effective.lockDays) lockedReason = `Locked ${(effective.lockDays - daysHeld).toFixed(1)} more days`;
      } else if (effective?.targetAmount && r.grossSaved < effective.targetAmount) {
        lockedReason = `Needs ₦${effective.targetAmount.toLocaleString()} gross, has ₦${r.grossSaved.toLocaleString()}`;
      }

      console.log(`\n  --- Card: ${card.cardName} (id=${card.id}) category=${card.category} migrated=${!!card.migrated} ---`);
      console.log(`      currentBalance=${card.currentBalance}  dailyAmount=${card.dailyAmount}  daysMarked=${(card.tickedPeriods??[]).length}`);
      console.log(`      migrationAmountWtd=${card.migrationAmountWtd} migrationAdminCommission=${card.migrationAdminCommission}`);
      console.log(`      commissionMonths=${r.commissionMonths} additionalCommission=${r.additionalCommission} commissionHeld=${r.commissionHeld}`);
      console.log(`      grossSaved=${r.grossSaved}  withdrawable(net-of-commission)=${r.withdrawable}`);
      console.log(`      effectivePlan=`, effective, ` lockedReason=`, lockedReason);
      console.log(`      FINAL withdrawable on eligibility page = ${lockedReason ? 0 : r.withdrawable}`);
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
