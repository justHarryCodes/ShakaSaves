/**
 * Real export from the ShakaSaves migration Google Sheet.
 * Source: https://docs.google.com/spreadsheets/d/1-JiziO41ArfGUvitdZvgpE-h0SMF88oTw2enek1-Ig0
 *
 * Rules:
 *  - First row per customer has `migrationCode`
 *  - Subsequent rows for the same customer (different categories) leave `migrationCode` undefined
 *  - Order matches the sheet exactly — forwardFill() depends on it
 *
 * NOTE ON BLANK CODES:
 * A blank migrationCode ALWAYS means "same customer as the row above,"
 * even if the name is completely different — customers sometimes marked
 * their savings under a different name (nickname, relative's name, etc.)
 * on different days. forwardFill() trusts the code position, not the name.
 *
 * ⚠ ONE REAL FLAG: "Debby Nice" appears under TWO DIFFERENT explicit codes
 * (SS05 and SS17), both with their own migrationCode set — same name, same
 * numbers, two separate codes. Almost certainly one person registered twice.
 * findDuplicateCandidates() will flag this for admin review before approval.
 */

import type { RawRow } from "./migrationData";
import {
  groupByMigrationCode,
  findDuplicateCandidates,
  forwardFill,
} from "./migrationData";

export const RAW_ROWS: RawRow[] = [
  { migrationCode: "SS01", customerName: "Magdalene",        dailyMarking: 3000, totalSavings: 663000, amountWtd: 654000, cardBal: 9000,   adminCommission: 24000, category: "Regular"    },
  {                         customerName: "Best Mag",         dailyMarking: 3000, totalSavings: 384000, amountWtd: 0,      cardBal: 384000, adminCommission: 15000, category: "Regular"    },
  {                         customerName: "Mag",              dailyMarking: 800,  totalSavings: 72000,  amountWtd: 0,      cardBal: 72000,  adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS02", customerName: "Flora 1",          dailyMarking: 500,  totalSavings: 180000, amountWtd: 0,      cardBal: 180000, adminCommission: 6000,  category: "Regular"    },
  {                         customerName: "Flora 2",          dailyMarking: 500,  totalSavings: 14000,  amountWtd: 0,      cardBal: 14000,  adminCommission: 0,     category: "Regular"    },
  {                         customerName: "Flora 1",          dailyMarking: 800,  totalSavings: 144800, amountWtd: 0,      cardBal: 144800, adminCommission: 0,     category: "FoodBank"   },
  {                         customerName: "Flora 2",          dailyMarking: 800,  totalSavings: 153600, amountWtd: 0,      cardBal: 153600, adminCommission: 0,     category: "FoodBank"   },
  {                         customerName: "Delight",          dailyMarking: 4000, totalSavings: 244000, amountWtd: 0,      cardBal: 244000, adminCommission: 12000, category: "Regular"    },
  {                         customerName: "Divine",           dailyMarking: 2000, totalSavings: 128000, amountWtd: 0,      cardBal: 128000, adminCommission: 6000,  category: "Regular"    },

  { migrationCode: "SS03", customerName: "Favour 1",         dailyMarking: 2000, totalSavings: 486000, amountWtd: 246000, cardBal: 240000, adminCommission: 18000, category: "Regular"    },
  {                         customerName: "Favour 2",         dailyMarking: 500,  totalSavings: 180000, amountWtd: 118500, cardBal: 45000,  adminCommission: 6000,  category: "Regular"    },
  {                         customerName: "Favour 3",         dailyMarking: 2000, totalSavings: 88000,  amountWtd: 0,      cardBal: 88000,  adminCommission: 4000,  category: "Regular"    },
  {                         customerName: "Favour 4",         dailyMarking: 500,  totalSavings: 180000, amountWtd: 0,      cardBal: 180000, adminCommission: 6000,  category: "Regular"    },

  { migrationCode: "SS04", customerName: "Stella Eguae",     dailyMarking: 1000, totalSavings: 324000, amountWtd: 0,      cardBal: 324000, adminCommission: 11000, category: "Regular"    },
  {                         customerName: "Stella Eguae",     dailyMarking: 800,  totalSavings: 260000, amountWtd: 0,      cardBal: 260000, adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS05", customerName: "Debby Nice",       dailyMarking: 1000, totalSavings: 208000, amountWtd: 150000, cardBal: 58000,  adminCommission: 6000,  category: "Regular"    },
  { migrationCode: "SS06", customerName: "Faith Esiri",      dailyMarking: 500,  totalSavings: 65500,  amountWtd: 0,      cardBal: 65500,  adminCommission: 2500,  category: "Regular"    },
  { migrationCode: "SS07", customerName: "Alero",            dailyMarking: 400,  totalSavings: 48000,  amountWtd: 24000,  cardBal: 24000,  adminCommission: 1200,  category: "Regular"    },
  { migrationCode: "SS08", customerName: "Chiboy Peter",     dailyMarking: 1000, totalSavings: 147000, amountWtd: 0,      cardBal: 147000, adminCommission: 5000,  category: "Regular"    },
  { migrationCode: "SS09", customerName: "Mrs Ajiri",        dailyMarking: 1000, totalSavings: 247000, amountWtd: 45000,  cardBal: 202000, adminCommission: 9000,  category: "Regular"    },
  { migrationCode: "SS10", customerName: "Blessing Love",    dailyMarking: 1000, totalSavings: 220000, amountWtd: 90000,  cardBal: 130000, adminCommission: 8000,  category: "Regular"    },
  { migrationCode: "SS11", customerName: "Maureen",          dailyMarking: 1000, totalSavings: 43000,  amountWtd: 43000,  cardBal: 0,      adminCommission: 2000,  category: "Regular"    },
  { migrationCode: "SS12", customerName: "Gift Sunday",      dailyMarking: 2000, totalSavings: 6000,   amountWtd: 0,      cardBal: 0,      adminCommission: 2000,  category: "Regular"    },
  { migrationCode: "SS13", customerName: "Ndidi Maxwell",    dailyMarking: 1000, totalSavings: 97000,  amountWtd: 65000,  cardBal: 0,      adminCommission: 4000,  category: "Regular"    },
  { migrationCode: "SS14", customerName: "Omonigho Francis", dailyMarking: 200,  totalSavings: 42000,  amountWtd: 0,      cardBal: 42000,  adminCommission: 1400,  category: "Regular"    },
  { migrationCode: "SS15", customerName: "Tracy",            dailyMarking: 200,  totalSavings: 23200,  amountWtd: 0,      cardBal: 23200,  adminCommission: 800,   category: "Regular"    },
  { migrationCode: "SS16", customerName: "Bridget",          dailyMarking: 300,  totalSavings: 67800,  amountWtd: 0,      cardBal: 67800,  adminCommission: 2400,  category: "Regular"    },

  // ⚠ DUPLICATE CANDIDATE: same name & same numbers as SS05 — likely one person, two codes
  { migrationCode: "SS17", customerName: "Debby Nice",       dailyMarking: 1000, totalSavings: 208000, amountWtd: 150000, cardBal: 58000,  adminCommission: 7000,  category: "Regular"    },

  { migrationCode: "SS18", customerName: "Rejoice Elue",     dailyMarking: 500,  totalSavings: 46000,  amountWtd: 0,      cardBal: 46000,  adminCommission: 2000,  category: "Regular"    },
  { migrationCode: "SS19", customerName: "Chinaza",          dailyMarking: 500,  totalSavings: 1500,   amountWtd: 0,      cardBal: 1500,   adminCommission: 500,   category: "Regular"    },
  { migrationCode: "SS20", customerName: "Ebuka",            dailyMarking: 1000, totalSavings: 183000, amountWtd: 179000, cardBal: 4000,   adminCommission: 8000,  category: "Regular"    },
  { migrationCode: "SS21", customerName: "Kobiruo Bliss",    dailyMarking: 500,  totalSavings: 14500,  amountWtd: 0,      cardBal: 14500,  adminCommission: 500,   category: "Regular"    },
  { migrationCode: "SS22", customerName: "Jennifer",         dailyMarking: 500,  totalSavings: 38500,  amountWtd: 38500,  cardBal: 0,      adminCommission: 1500,  category: "Regular"    },

  { migrationCode: "SS23", customerName: "Fejiro Mrs",       dailyMarking: 500,  totalSavings: 39000,  amountWtd: 14500,  cardBal: 24500,  adminCommission: 1500,  category: "Regular"    },
  {                         customerName: "Fejiro Mrs",       dailyMarking: 800,  totalSavings: 106000, amountWtd: 0,      cardBal: 106000, adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS24", customerName: "Veeroyal",         dailyMarking: 1000, totalSavings: 74000,  amountWtd: 0,      cardBal: 74000,  adminCommission: 3000,  category: "Regular"    },
  { migrationCode: "SS25", customerName: "Winner",           dailyMarking: 500,  totalSavings: 62000,  amountWtd: 0,      cardBal: 62000,  adminCommission: 2000,  category: "Regular"    },
  { migrationCode: "SS26", customerName: "Juliet",           dailyMarking: 500,  totalSavings: 69500,  amountWtd: 0,      cardBal: 69500,  adminCommission: 2500,  category: "Regular"    },
  { migrationCode: "SS27", customerName: "Bliss",            dailyMarking: 1000, totalSavings: 251000, amountWtd: 251000, cardBal: 0,      adminCommission: 9000,  category: "Regular"    },

  { migrationCode: "SS28", customerName: "Edafe Victory",    dailyMarking: 3000, totalSavings: 48000,  amountWtd: 48000,  cardBal: 0,      adminCommission: 3000,  category: "Regular"    },
  {                         customerName: "Godswill",         dailyMarking: 3000, totalSavings: 36000,  amountWtd: 36000,  cardBal: 0,      adminCommission: 3000,  category: "Regular"    },

  { migrationCode: "SS29", customerName: "Yakubu Choice",    dailyMarking: 300,  totalSavings: 5100,   amountWtd: 5100,   cardBal: 0,      adminCommission: 300,   category: "Regular"    },
  { migrationCode: "SS30", customerName: "Emmy BSF",         dailyMarking: 500,  totalSavings: 24000,  amountWtd: 0,      cardBal: 24000,  adminCommission: 1000,  category: "Regular"    },
  { migrationCode: "SS31", customerName: "Benny",            dailyMarking: 200,  totalSavings: 42000,  amountWtd: 0,      cardBal: 42000,  adminCommission: 1400,  category: "Regular"    },
  { migrationCode: "SS32", customerName: "Richeal",          dailyMarking: 500,  totalSavings: 14000,  amountWtd: 14000,  cardBal: 0,      adminCommission: 500,   category: "Regular"    },
  { migrationCode: "SS33", customerName: "Peace Brooks",     dailyMarking: 200,  totalSavings: 6000,   amountWtd: 0,      cardBal: 6000,   adminCommission: 200,   category: "Regular"    },
  { migrationCode: "SS34", customerName: "Yoma",             dailyMarking: 500,  totalSavings: 76000,  amountWtd: 0,      cardBal: 76000,  adminCommission: 3000,  category: "Regular"    },
  { migrationCode: "SS35", customerName: "Dees Moda",        dailyMarking: 500,  totalSavings: 30500,  amountWtd: 0,      cardBal: 30500,  adminCommission: 1500,  category: "Regular"    },
  { migrationCode: "SS36", customerName: "Isaac Omonigho",   dailyMarking: 3000, totalSavings: 138000, amountWtd: 0,      cardBal: 138000, adminCommission: 6000,  category: "Project 1M" },
  { migrationCode: "SS37", customerName: "Mr Andrew",        dailyMarking: 800,  totalSavings: 168000, amountWtd: 0,      cardBal: 168000, adminCommission: 0,     category: "FoodBank"   },
  { migrationCode: "SS38", customerName: "Tonia",            dailyMarking: 800,  totalSavings: 48000,  amountWtd: 0,      cardBal: 48000,  adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS39", customerName: "Jubilee",          dailyMarking: 800,  totalSavings: 104000, amountWtd: 0,      cardBal: 104000, adminCommission: 0,     category: "FoodBank"   },
  {                         customerName: "Wemi",             dailyMarking: 3000, totalSavings: 525000, amountWtd: 0,      cardBal: 525000, adminCommission: 18000, category: "Regular"    },

  { migrationCode: "SS40", customerName: "Mathilda Solomon", dailyMarking: 2000, totalSavings: 720000, amountWtd: 300000, cardBal: 420000, adminCommission: 24000, category: "Regular"    },
  {                         customerName: "Mathilda Solomon 1", dailyMarking: 2000, totalSavings: 222000, amountWtd: 0,   cardBal: 222000, adminCommission: 8000,  category: "Regular"    },
  {                         customerName: "Mathilda",         dailyMarking: 2000, totalSavings: 12000,  amountWtd: 0,      cardBal: 12000,  adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS41", customerName: "Chef Happy",       dailyMarking: 1000, totalSavings: 9000,   amountWtd: 0,      cardBal: 9000,   adminCommission: 1000,  category: "Regular"    },
  {                         customerName: "Chef Happy",       dailyMarking: 800,  totalSavings: 24000,  amountWtd: 0,      cardBal: 24000,  adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS42", customerName: "Matthew",          dailyMarking: 800,  totalSavings: 48800,  amountWtd: 0,      cardBal: 48800,  adminCommission: 0,     category: "FoodBank"   },
  {                         customerName: "Matthew",          dailyMarking: 3000, totalSavings: 921000, amountWtd: 0,      cardBal: 921000, adminCommission: 33000, category: "Project 1M" },

  { migrationCode: "SS43", customerName: "Benson Precious",  dailyMarking: 800,  totalSavings: 48800,  amountWtd: 0,      cardBal: 48800,  adminCommission: 0,     category: "FoodBank"   },

  { migrationCode: "SS44", customerName: "Paullet 1",        dailyMarking: 1000, totalSavings: 17000,  amountWtd: 0,      cardBal: 17000,  adminCommission: 1000,  category: "Regular"    },
  {                         customerName: "Paullet 2",        dailyMarking: 1000, totalSavings: 17000,  amountWtd: 0,      cardBal: 17000,  adminCommission: 1000,  category: "Regular"    },

  { migrationCode: "SS45", customerName: "Segun",            dailyMarking: 1000, totalSavings: 300000, amountWtd: 300000, cardBal: 0,      adminCommission: 10000, category: "Regular"    },
  { migrationCode: "SS46", customerName: "Gbeleke",          dailyMarking: 3000, totalSavings: 534000, amountWtd: 0,      cardBal: 534000, adminCommission: 9000,  category: "Project 1M" },
  { migrationCode: "SS47", customerName: "Arabella",         dailyMarking: 800,  totalSavings: 144000, amountWtd: 0,      cardBal: 144000, adminCommission: 0,     category: "FoodBank"   },
  { migrationCode: "SS48", customerName: "Tega Lisa",        dailyMarking: 1000, totalSavings: 205000, amountWtd: 156000, cardBal: 49000,  adminCommission: 7000,  category: "Regular"    },
  { migrationCode: "SS49", customerName: "Favour Ovitute",   dailyMarking: 300,  totalSavings: 9000,   amountWtd: 0,      cardBal: 9000,   adminCommission: 600,   category: "Regular"    },
  { migrationCode: "SS50", customerName: "Fejiro Daniel",    dailyMarking: 2000, totalSavings: 178000, amountWtd: 136000, cardBal: 42000,  adminCommission: 6000,  category: "Regular"    },
  { migrationCode: "SS51", customerName: "Daddy Efe",        dailyMarking: 2000, totalSavings: 82000,  amountWtd: 0,      cardBal: 82000,  adminCommission: 4000,  category: "Regular"    },

  { migrationCode: "SS52", customerName: "Racheal Delsu",    dailyMarking: 2000, totalSavings: 720000, amountWtd: 60000,  cardBal: 660000, adminCommission: 24000, category: "Regular"    },
  {                         customerName: "Rachael Delsu 2",  dailyMarking: 2000, totalSavings: 120000, amountWtd: 0,      cardBal: 120000, adminCommission: 4000,  category: "Regular"    },

  { migrationCode: "SS53", customerName: "Aghogho",          dailyMarking: 300,  totalSavings: 24600,  amountWtd: 0,      cardBal: 24600,  adminCommission: 900,   category: "Regular"    },
  { migrationCode: "SS54", customerName: "Tamara Doris",     dailyMarking: 2000, totalSavings: 108000, amountWtd: 108000, cardBal: 0,      adminCommission: 4000,  category: "Regular"    },
  { migrationCode: "SS55", customerName: "Trina Beauty",     dailyMarking: 500,  totalSavings: 60500,  amountWtd: 60500,  cardBal: 0,      adminCommission: 2500,  category: "Regular"    },
  { migrationCode: "SS56", customerName: "Charity",          dailyMarking: 1000, totalSavings: 55000,  amountWtd: 55000,  cardBal: 0,      adminCommission: 2000,  category: "Regular"    },
  { migrationCode: "SS57", customerName: "Mummy Winning",    dailyMarking: 500,  totalSavings: 77000,  amountWtd: 77000,  cardBal: 0,      adminCommission: 3000,  category: "Regular"    },
  { migrationCode: "SS58", customerName: "Blessing Friday",  dailyMarking: 500,  totalSavings: 8500,   amountWtd: 8500,   cardBal: 0,      adminCommission: 500,   category: "Regular"    },
  { migrationCode: "SS59", customerName: "Eguonor Sunday",   dailyMarking: 1000, totalSavings: 23000,  amountWtd: 0,      cardBal: 23000,  adminCommission: 1000,  category: "Regular"    },
  { migrationCode: "SS60", customerName: "Destiny",          dailyMarking: 1000, totalSavings: 58000,  amountWtd: 0,      cardBal: 58000,  adminCommission: 2000,  category: "Regular"    },
  { migrationCode: "SS61", customerName: "Ejovi",            dailyMarking: 2000, totalSavings: 2000,   amountWtd: 2000,   cardBal: 0,      adminCommission: 0,     category: "Regular"    },
  { migrationCode: "SS62", customerName: "Favour BSF",       dailyMarking: 200,  totalSavings: 24000,  amountWtd: 0,      cardBal: 24000,  adminCommission: 800,   category: "Regular"    },
  { migrationCode: "SS63", customerName: "Success",          dailyMarking: 1000, totalSavings: 17000,  amountWtd: 17000,  cardBal: 0,      adminCommission: 1000,  category: "Regular"    },
  { migrationCode: "SS64", customerName: "Benita Onaro",     dailyMarking: 200,  totalSavings: 36000,  amountWtd: 36000,  cardBal: 0,      adminCommission: 1200,  category: "Regular"    },
  { migrationCode: "SS65", customerName: "Righteousness",    dailyMarking: 300,  totalSavings: 33600,  amountWtd: 0,      cardBal: 33600,  adminCommission: 1200,  category: "Regular"    },
  { migrationCode: "SS66", customerName: "Miss Esther",      dailyMarking: 500,  totalSavings: 78000,  amountWtd: 0,      cardBal: 78000,  adminCommission: 3000,  category: "Regular"    },
  { migrationCode: "SS67", customerName: "Hope Rubby",       dailyMarking: 500,  totalSavings: 18500,  amountWtd: 18500,  cardBal: 0,      adminCommission: 1000,  category: "Regular"    },
  { migrationCode: "SS68", customerName: "Gilson",           dailyMarking: 500,  totalSavings: 125000, amountWtd: 125000, cardBal: 0,      adminCommission: 4000,  category: "Regular"    },
  { migrationCode: "SS69", customerName: "Elizabeth",        dailyMarking: 200,  totalSavings: 3600,   amountWtd: 0,      cardBal: 3600,   adminCommission: 200,   category: "Regular"    },
  { migrationCode: "SS70", customerName: "Mummy Dariel",     dailyMarking: 500,  totalSavings: 20000,  amountWtd: 0,      cardBal: 20000,  adminCommission: 1000,  category: "Regular"    },
  { migrationCode: "SS71", customerName: "Temi Matu",        dailyMarking: 3000, totalSavings: 30000,  amountWtd: 0,      cardBal: 30000,  adminCommission: 3000,  category: "Project 1M" },
  { migrationCode: "SS72", customerName: "Chef BB",          dailyMarking: 2000, totalSavings: 68000,  amountWtd: 0,      cardBal: 68000,  adminCommission: 4000,  category: "Regular"    },
  { migrationCode: "SS73", customerName: "Gift Ese",         dailyMarking: 500,  totalSavings: 66500,  amountWtd: 66500,  cardBal: 0,      adminCommission: 2500,  category: "Regular"    },
  { migrationCode: "SS74", customerName: "Emmy Royalty",     dailyMarking: 500,  totalSavings: 90000,  amountWtd: 75000,  cardBal: 0,      adminCommission: 3000,  category: "Regular"    },

  { migrationCode: "SS75", customerName: "Olivia Delight",   dailyMarking: 1000, totalSavings: 42000,  amountWtd: 0,      cardBal: 42000,  adminCommission: 2000,  category: "Regular"    },
  {                         customerName: "Olivia Delight",   dailyMarking: 1000, totalSavings: 16000,  amountWtd: 0,      cardBal: 16000,  adminCommission: 1000,  category: "Regular"    },
];

// ─── computed exports ─────────────────────────────────────────────────────────

/** All rows with migrationCode guaranteed (blanks forward-filled). */
export const MIGRATION_RECORDS = forwardFill(RAW_ROWS);

/** Grouped by migration code — one MigrationCard per customer/group. */
export const MIGRATION_CARDS = groupByMigrationCode(RAW_ROWS);

/** Names appearing under more than one explicit code — flag for admin review. */
export const DUPLICATE_CANDIDATES = findDuplicateCandidates(MIGRATION_RECORDS);
