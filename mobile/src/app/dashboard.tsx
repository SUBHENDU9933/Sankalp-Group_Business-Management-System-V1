import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';

const BLUE = '#1261A0';
const ORANGE = '#F28C28';

export default function DashboardScreen() {
  const { profile, signOut } = useAuth();
  const role = String(profile?.role || '').toUpperCase();

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SANKALP BMS</Text>
            <Text style={styles.greeting}>Hello, {profile?.full_name || 'Team Member'}</Text>
            <Text style={styles.role}>{profile?.designation || role || 'BMS User'}</Text>
          </View>
          <Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Logout</Text></Pressable>
        </View>

        <View style={styles.grid}>
          {[['New Leads','—'],['Follow-ups','—'],['Meetings','—'],['Overdue','—']].map(([label,value]) => (
            <View key={label} style={styles.kpi}><Text style={styles.kpiValue}>{value}</Text><Text style={styles.kpiLabel}>{label}</Text></View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mobile BMS</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Authentication connected ✓</Text>
            <Text style={styles.cardText}>Signed in as {profile?.email || 'current BMS user'} • Role: {role || 'unknown'}</Text>
            <Text style={styles.cardText}>Live Leads, Schedule, Customers and notifications will be connected after the mobile data-service audit.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
safe:{flex:1,backgroundColor:'#F6F8FB'},
container:{padding:20,paddingBottom:40},
header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
eyebrow:{color:ORANGE,fontWeight:'800',fontSize:12,letterSpacing:1.2},
greeting:{color:'#132238',fontSize:26,fontWeight:'800',marginTop:4,maxWidth:260},
role:{color:'#718096',marginTop:3},
logout:{paddingHorizontal:12,paddingVertical:9,borderRadius:10,backgroundColor:'#FFFFFF'},
logoutText:{color:'#C0392B',fontWeight:'700',fontSize:12},
grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:22},
kpi:{width:'47%',backgroundColor:'#FFFFFF',borderRadius:17,padding:17,borderLeftWidth:4,borderLeftColor:BLUE},
kpiValue:{color:BLUE,fontSize:27,fontWeight:'800'},
kpiLabel:{color:'#6B778C',marginTop:5,fontSize:12},
section:{marginTop:25},
sectionTitle:{color:'#132238',fontSize:17,fontWeight:'800',marginBottom:10},
card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:18},
cardTitle:{color:'#1E7A4A',fontWeight:'800'},
cardText:{color:'#7B8798',marginTop:7,lineHeight:18,fontSize:12},
});
