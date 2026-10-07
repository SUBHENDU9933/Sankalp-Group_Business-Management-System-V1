import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BLUE = '#1261A0';
const ORANGE = '#F28C28';

const kpis = [
  ['New Leads', '05'],
  ['Follow-ups', '08'],
  ['Meetings', '03'],
  ['Overdue', '02'],
];

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Text style={styles.eyebrow}>SANKALP BMS</Text>
          <Text style={styles.greeting}>Good Morning</Text>
          <Text style={styles.role}>Your business dashboard</Text>
        </View>

        <View style={styles.grid}>
          {kpis.map(([label, value]) => (
            <View key={label} style={styles.kpi}>
              <Text style={styles.kpiValue}>{value}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Section title="Today's Schedule">
          <View style={styles.scheduleCard}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>No live schedule connected yet</Text>
              <Text style={styles.cardText}>This screen will use the existing BMS scheduling data.</Text>
            </View>
          </View>
        </Section>

        <Section title="Quick Actions">
          <View style={styles.actions}>
            {['Add Lead', 'Follow-up', 'Schedule', 'Upload File'].map((item) => (
              <View key={item} style={styles.action}>
                <Text style={styles.actionText}>{item}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Recent Activity">
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ready for live BMS data</Text>
            <Text style={styles.emptyText}>We will connect this dashboard only after validating the existing APIs and RLS.</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { padding: 20, paddingBottom: 40 },
  eyebrow: { color: ORANGE, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  greeting: { color: '#132238', fontSize: 29, fontWeight: '800', marginTop: 4 },
  role: { color: '#718096', marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  kpi: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 17,
    borderLeftWidth: 4,
    borderLeftColor: BLUE,
  },
  kpiValue: { color: BLUE, fontSize: 27, fontWeight: '800' },
  kpiLabel: { color: '#6B778C', marginTop: 5, fontSize: 12 },
  section: { marginTop: 25 },
  sectionTitle: { color: '#132238', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE, marginRight: 12 },
  cardTitle: { color: '#273449', fontWeight: '700' },
  cardText: { color: '#7B8798', marginTop: 4, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    width: '47%',
  },
  actionText: { color: BLUE, fontWeight: '700' },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18 },
  emptyTitle: { color: '#273449', fontWeight: '700' },
  emptyText: { color: '#7B8798', marginTop: 5, lineHeight: 18, fontSize: 12 },
});
