import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const naira = (n: number) =>
  `NGN ${new Intl.NumberFormat("en-NG").format(n)}`;

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1E293B" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#64748B", marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontFamily: "Helvetica-Bold",
    borderBottom: "1 solid #E2E8F0", paddingBottom: 4, marginBottom: 8,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { color: "#64748B", width: 220 },
  summaryValue: { fontFamily: "Helvetica-Bold" },
  col: { flex: 1, fontSize: 9 },
  tableHeader: {
    flexDirection: "row", backgroundColor: "#F8FAFC",
    padding: "4 0", marginBottom: 4, borderBottom: "1 solid #CBD5E1",
  },
  tableRow: { flexDirection: "row", padding: "3 0", borderBottom: "1 solid #F1F5F9" },
});

export interface MonthlyReportData {
  monthLabel: string;
  totalCollections: number;
  activeCustomers: number;
  newCustomers: number;
  withdrawalsPaid: number;
  totalBalance: number;
  avgAchievement: number;
  customerBreakdown: {
    id: string; fullName: string; frequency: string; periodsPaid: number;
    amountConfirmed: number; balance: number; target: number; achievement: number;
  }[];
  defaulters: { id: string; fullName: string; frequency: string; balance: number }[];
  withdrawalLog: {
    id: string; customerId: string; amount: number;
    requestedAt: string; status: string;
  }[];
}

export function MonthlyReport({ data }: { data: MonthlyReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Shaka Saves — Monthly Report</Text>
        <Text style={styles.subtitle}>
          {data.monthLabel}  |  Generated: {new Date().toLocaleDateString("en-NG")}
        </Text>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {[
            ["Total collections this month", naira(data.totalCollections)],
            ["Active customers", String(data.activeCustomers)],
            ["New customers this month", String(data.newCustomers)],
            ["Withdrawals paid this month", naira(data.withdrawalsPaid)],
            ["Net savings under management", naira(data.totalBalance)],
            ["Average target achievement", `${data.avgAchievement}%`],
          ].map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Customer Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Breakdown</Text>
          <View style={styles.tableHeader}>
            {["Name", "Plan", "Periods Paid", "Confirmed", "Balance", "Target", "%"].map((h) => (
              <Text key={h} style={[styles.col, { fontFamily: "Helvetica-Bold" }]}>{h}</Text>
            ))}
          </View>
          {data.customerBreakdown.map((c) => (
            <View key={c.id} style={styles.tableRow}>
              <Text style={styles.col}>{c.fullName}</Text>
              <Text style={styles.col}>{c.frequency}</Text>
              <Text style={styles.col}>{c.periodsPaid}</Text>
              <Text style={styles.col}>{naira(c.amountConfirmed)}</Text>
              <Text style={styles.col}>{naira(c.balance)}</Text>
              <Text style={styles.col}>{naira(c.target)}</Text>
              <Text style={styles.col}>{c.achievement}%</Text>
            </View>
          ))}
        </View>

        {/* Defaulters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Defaulters (No payment this month)</Text>
          {data.defaulters.length === 0 ? (
            <Text style={{ color: "#10B981" }}>None — all customers paid this month!</Text>
          ) : (
            <>
              <View style={styles.tableHeader}>
                {["Name", "Frequency", "Balance"].map((h) => (
                  <Text key={h} style={[styles.col, { fontFamily: "Helvetica-Bold" }]}>{h}</Text>
                ))}
              </View>
              {data.defaulters.map((d) => (
                <View key={d.id} style={styles.tableRow}>
                  <Text style={styles.col}>{d.fullName}</Text>
                  <Text style={styles.col}>{d.frequency}</Text>
                  <Text style={styles.col}>{naira(d.balance)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Withdrawal Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Log</Text>
          {data.withdrawalLog.length === 0 ? (
            <Text style={{ color: "#64748B" }}>No withdrawals this month</Text>
          ) : (
            <>
              <View style={styles.tableHeader}>
                {["Customer ID", "Amount", "Requested", "Status"].map((h) => (
                  <Text key={h} style={[styles.col, { fontFamily: "Helvetica-Bold" }]}>{h}</Text>
                ))}
              </View>
              {data.withdrawalLog.map((w) => (
                <View key={w.id} style={styles.tableRow}>
                  <Text style={styles.col}>{w.customerId.slice(0, 10)}</Text>
                  <Text style={styles.col}>{naira(w.amount)}</Text>
                  <Text style={styles.col}>{w.requestedAt}</Text>
                  <Text style={styles.col}>{w.status}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </Page>
    </Document>
  );
}
