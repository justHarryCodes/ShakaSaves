/**
 * Sets category = "Regular" on all savings_cards that have no category field.
 *
 * Run: npx tsx --env-file=.env.local scripts/tag-untagged-cards.ts
 */

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId   = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

const app = getApps().length
  ? getApp()
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db = getFirestore(app);

async function main() {
  const snap = await db.collection("savings_cards").get();
  if (snap.empty) { console.log("No savings cards found."); return; }

  console.log(`Total cards: ${snap.docs.length}\n`);

  const untagged = snap.docs.filter((d) => {
    const cat = d.data().category;
    return !cat || cat.toString().trim() === "";
  });

  if (untagged.length === 0) {
    console.log("All cards already have a category. Nothing to do.");
    return;
  }

  console.log(`Untagged cards: ${untagged.length}`);

  const BATCH_SIZE = 400;
  let updated = 0;

  for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
    const chunk = untagged.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      const d = doc.data();
      console.log(`  UPDATE  id=${doc.id}  name="${d.cardName ?? d.customerName}"  migrationCode=${d.migrationCode ?? "—"}`);
      batch.update(doc.ref, { category: "Regular" });
      updated++;
    }
    await batch.commit();
  }

  console.log(`\nDone. Updated ${updated} cards → category: "Regular"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
