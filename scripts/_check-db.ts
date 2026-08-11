import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as admin from "firebase-admin";

const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) });

const ADMIN_USERNAMES = new Set(["shakasaves", "shakasave", "glitch2024"]);

async function run() {
  const db = admin.firestore();
  const auth = admin.auth();

  const credsSnap = await db.collection("user_credentials").get();
  for (const doc of credsSnap.docs) {
    const username: string = (doc.data().username ?? "").toLowerCase();
    const uid = doc.id;
    const isAdmin = ADMIN_USERNAMES.has(username);
    const user = await auth.getUser(uid);
    const currentRole = user.customClaims?.role ?? null;
    const expectedRole = isAdmin ? "admin" : "customer";
    if (currentRole !== expectedRole) {
      await auth.setCustomUserClaims(uid, { role: expectedRole });
      console.log(`Fixed ${username} (${uid}): ${currentRole} → ${expectedRole}`);
    } else {
      console.log(`OK    ${username} (${uid}): ${currentRole}`);
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
