/**
 * Patches the `category` field on all migrated savings_cards in Firestore.
 * Uses FIREBASE_* env vars from .env.local (no service-account.json needed).
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-migrated-categories.ts
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

// ── Inline forward-fill of the migration records ──────────────────────────
type Category = "Regular" | "FoodBank" | "Project 1M";
interface Row { migrationCode?: string; customerName: string; category: Category; }

const RAW_ROWS: Row[] = [
  { migrationCode: "SS01", customerName: "Magdalene",           category: "Regular"    },
  {                         customerName: "Best Mag",            category: "Regular"    },
  {                         customerName: "Mag",                 category: "FoodBank"   },
  { migrationCode: "SS02", customerName: "Flora 1",             category: "Regular"    },
  {                         customerName: "Flora 2",             category: "Regular"    },
  {                         customerName: "Flora 1",             category: "FoodBank"   },
  {                         customerName: "Flora 2",             category: "FoodBank"   },
  {                         customerName: "Delight",             category: "Regular"    },
  {                         customerName: "Divine",              category: "Regular"    },
  { migrationCode: "SS03", customerName: "Favour 1",            category: "Regular"    },
  {                         customerName: "Favour 2",            category: "Regular"    },
  {                         customerName: "Favour 3",            category: "Regular"    },
  {                         customerName: "Favour 4",            category: "Regular"    },
  { migrationCode: "SS04", customerName: "Stella Eguae",        category: "Regular"    },
  {                         customerName: "Stella Eguae",        category: "FoodBank"   },
  { migrationCode: "SS05", customerName: "Debby Nice",          category: "Regular"    },
  { migrationCode: "SS06", customerName: "Faith Esiri",         category: "Regular"    },
  { migrationCode: "SS07", customerName: "Alero",               category: "Regular"    },
  { migrationCode: "SS08", customerName: "Chiboy Peter",        category: "Regular"    },
  { migrationCode: "SS09", customerName: "Mrs Ajiri",           category: "Regular"    },
  { migrationCode: "SS10", customerName: "Blessing Love",       category: "Regular"    },
  { migrationCode: "SS11", customerName: "Maureen",             category: "Regular"    },
  { migrationCode: "SS12", customerName: "Gift Sunday",         category: "Regular"    },
  { migrationCode: "SS13", customerName: "Ndidi Maxwell",       category: "Regular"    },
  { migrationCode: "SS14", customerName: "Omonigho Francis",    category: "Regular"    },
  { migrationCode: "SS15", customerName: "Tracy",               category: "Regular"    },
  { migrationCode: "SS16", customerName: "Bridget",             category: "Regular"    },
  { migrationCode: "SS17", customerName: "Debby Nice",          category: "Regular"    },
  { migrationCode: "SS18", customerName: "Rejoice Elue",        category: "Regular"    },
  { migrationCode: "SS19", customerName: "Chinaza",             category: "Regular"    },
  { migrationCode: "SS20", customerName: "Ebuka",               category: "Regular"    },
  { migrationCode: "SS21", customerName: "Kobiruo Bliss",       category: "Regular"    },
  { migrationCode: "SS22", customerName: "Jennifer",            category: "Regular"    },
  { migrationCode: "SS23", customerName: "Fejiro Mrs",          category: "Regular"    },
  {                         customerName: "Fejiro Mrs",          category: "FoodBank"   },
  { migrationCode: "SS24", customerName: "Veeroyal",            category: "Regular"    },
  { migrationCode: "SS25", customerName: "Winner",              category: "Regular"    },
  { migrationCode: "SS26", customerName: "Juliet",              category: "Regular"    },
  { migrationCode: "SS27", customerName: "Bliss",               category: "Regular"    },
  { migrationCode: "SS28", customerName: "Edafe Victory",       category: "Regular"    },
  {                         customerName: "Godswill",            category: "Regular"    },
  { migrationCode: "SS29", customerName: "Yakubu Choice",       category: "Regular"    },
  { migrationCode: "SS30", customerName: "Emmy BSF",            category: "Regular"    },
  { migrationCode: "SS31", customerName: "Benny",               category: "Regular"    },
  { migrationCode: "SS32", customerName: "Richeal",             category: "Regular"    },
  { migrationCode: "SS33", customerName: "Peace Brooks",        category: "Regular"    },
  { migrationCode: "SS34", customerName: "Yoma",                category: "Regular"    },
  { migrationCode: "SS35", customerName: "Dees Moda",           category: "Regular"    },
  { migrationCode: "SS36", customerName: "Isaac Omonigho",      category: "Project 1M" },
  { migrationCode: "SS37", customerName: "Mr Andrew",           category: "FoodBank"   },
  { migrationCode: "SS38", customerName: "Tonia",               category: "FoodBank"   },
  { migrationCode: "SS39", customerName: "Jubilee",             category: "FoodBank"   },
  {                         customerName: "Wemi",                category: "Regular"    },
  { migrationCode: "SS40", customerName: "Mathilda Solomon",    category: "Regular"    },
  {                         customerName: "Mathilda Solomon 1",  category: "Regular"    },
  {                         customerName: "Mathilda",            category: "FoodBank"   },
  { migrationCode: "SS41", customerName: "Chef Happy",          category: "Regular"    },
  {                         customerName: "Chef Happy",          category: "FoodBank"   },
  { migrationCode: "SS42", customerName: "Matthew",             category: "FoodBank"   },
  {                         customerName: "Matthew",             category: "Project 1M" },
  { migrationCode: "SS43", customerName: "Benson Precious",     category: "FoodBank"   },
  { migrationCode: "SS44", customerName: "Paullet 1",           category: "Regular"    },
  {                         customerName: "Paullet 2",           category: "Regular"    },
  { migrationCode: "SS45", customerName: "Segun",               category: "Regular"    },
  { migrationCode: "SS46", customerName: "Gbeleke",             category: "Project 1M" },
  { migrationCode: "SS47", customerName: "Arabella",            category: "FoodBank"   },
  { migrationCode: "SS48", customerName: "Tega Lisa",           category: "Regular"    },
  { migrationCode: "SS49", customerName: "Favour Ovitute",      category: "Regular"    },
  { migrationCode: "SS50", customerName: "Fejiro Daniel",       category: "Regular"    },
  { migrationCode: "SS51", customerName: "Daddy Efe",           category: "Regular"    },
  { migrationCode: "SS52", customerName: "Racheal Delsu",       category: "Regular"    },
  {                         customerName: "Rachael Delsu 2",     category: "Regular"    },
  { migrationCode: "SS53", customerName: "Aghogho",             category: "Regular"    },
  { migrationCode: "SS54", customerName: "Tamara Doris",        category: "Regular"    },
  { migrationCode: "SS55", customerName: "Trina Beauty",        category: "Regular"    },
  { migrationCode: "SS56", customerName: "Charity",             category: "Regular"    },
  { migrationCode: "SS57", customerName: "Mummy Winning",       category: "Regular"    },
  { migrationCode: "SS58", customerName: "Blessing Friday",     category: "Regular"    },
  { migrationCode: "SS59", customerName: "Eguonor Sunday",      category: "Regular"    },
  { migrationCode: "SS60", customerName: "Destiny",             category: "Regular"    },
  { migrationCode: "SS61", customerName: "Ejovi",               category: "Regular"    },
  { migrationCode: "SS62", customerName: "Favour BSF",          category: "Regular"    },
  { migrationCode: "SS63", customerName: "Success",             category: "Regular"    },
  { migrationCode: "SS64", customerName: "Benita Onaro",        category: "Regular"    },
  { migrationCode: "SS65", customerName: "Righteousness",       category: "Regular"    },
  { migrationCode: "SS66", customerName: "Miss Esther",         category: "Regular"    },
  { migrationCode: "SS67", customerName: "Hope Rubby",          category: "Regular"    },
  { migrationCode: "SS68", customerName: "Gilson",              category: "Regular"    },
  { migrationCode: "SS69", customerName: "Elizabeth",           category: "Regular"    },
  { migrationCode: "SS70", customerName: "Mummy Dariel",        category: "Regular"    },
  { migrationCode: "SS71", customerName: "Temi Matu",           category: "Project 1M" },
  { migrationCode: "SS72", customerName: "Chef BB",             category: "Regular"    },
  { migrationCode: "SS73", customerName: "Gift Ese",            category: "Regular"    },
  { migrationCode: "SS74", customerName: "Emmy Royalty",        category: "Regular"    },
  { migrationCode: "SS75", customerName: "Olivia Delight",      category: "Regular"    },
  {                         customerName: "Olivia Delight",      category: "Regular"    },
];

function forwardFill(rows: Row[]): (Row & { migrationCode: string })[] {
  let lastCode = "";
  return rows.map((r) => {
    if (r.migrationCode) lastCode = r.migrationCode;
    return { ...r, migrationCode: lastCode };
  });
}

async function main() {
  const records = forwardFill(RAW_ROWS);

  // Build lookup: "CODE|NAME" → category
  const lookup = new Map<string, Category>();
  for (const r of records) {
    lookup.set(`${r.migrationCode}|${r.customerName}`, r.category);
  }

  console.log(`Lookup table: ${lookup.size} entries`);

  const snap = await db.collection("savings_cards").where("migrated", "==", true).get();
  if (snap.empty) { console.log("No migrated cards found in Firestore."); return; }

  console.log(`Found ${snap.docs.length} migrated cards in Firestore\n`);

  const batch = db.batch();
  let updates = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const doc of snap.docs) {
    const card = doc.data();
    const key = `${card.migrationCode}|${card.cardName}`;
    const expectedCategory = lookup.get(key);

    if (!expectedCategory) {
      console.warn(`UNMATCHED   id=${doc.id}  code=${card.migrationCode}  name="${card.cardName}"  current_category="${card.category ?? "none"}"`);
      unmatched++;
      continue;
    }

    if (card.category === expectedCategory) {
      console.log(`OK          ${card.migrationCode} / "${card.cardName}"  category=${expectedCategory}`);
      skipped++;
      continue;
    }

    console.log(`UPDATE      ${card.migrationCode} / "${card.cardName}"  ${card.category ?? "none"} → ${expectedCategory}`);
    batch.update(doc.ref, { category: expectedCategory });
    updates++;
  }

  console.log("\n──────────────────────────────────────");
  if (updates > 0) {
    await batch.commit();
    console.log(`Done. Updated=${updates}  Skipped=${skipped}  Unmatched=${unmatched}`);
  } else {
    console.log(`Nothing to update.  Skipped=${skipped}  Unmatched=${unmatched}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
