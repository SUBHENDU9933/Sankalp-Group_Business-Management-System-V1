import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { fetchLeads, type Lead } from '@/services/leadService';
import { MobileTabBar } from '@/components/MobileTabBar';

export default function LeadsScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(manual = false) {
    if (manual) setRefreshing(true); else setLoading(true);
    setError('');
    try { setRows(await fetchLeads()); }
    catch (e: any) { setError(e?.message || 'Unable to load leads.'); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    if (!profile) router.replace('/login');
    else load();
  }, [profile]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SANKALP BMS</Text>
            <Text style={styles.title}>Leads</Text>
            <Text style={styles.subtitle}>{rows.length} visible records</Text>
          </View>
        </View>
        {loading ? <View style={styles.center}><ActivityIndicator /></View> :
          error ? <View style={styles.center}><Text style={styles.error}>{error}</Text></View> :
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            contentContainerStyle={rows.length ? styles.list : styles.emptyList}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>{item.name || 'Unnamed lead'}</Text>
                  <Text style={styles.status}>{item.status || '—'}</Text>
                </View>
                {!!item.phone && <Text style={styles.meta}>{item.phone}</Text>}
                {!!item.location && <Text style={styles.meta}>{item.location}</Text>}
                {!!item.project_type && <Text style={styles.meta}>{item.project_type}</Text>}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No visible leads.</Text>}
          />}
      </View>
      <MobileTabBar />
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F8FB'},
  body:{flex:1,padding:20},
  header:{marginBottom:16},
  eyebrow:{color:'#F28C28',fontWeight:'800',fontSize:11,letterSpacing:1.1},
  title:{color:'#132238',fontSize:28,fontWeight:'800',marginTop:3},
  subtitle:{color:'#718096',marginTop:3,fontSize:12},
  list:{paddingBottom:18},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:16,marginBottom:10,borderWidth:1,borderColor:'#E8EDF3'},
  row:{flexDirection:'row',alignItems:'center',gap:8},
  name:{flex:1,color:'#132238',fontSize:15,fontWeight:'800'},
  status:{color:'#1261A0',fontSize:10,fontWeight:'800',textTransform:'uppercase'},
  meta:{color:'#718096',fontSize:12,marginTop:5},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:20},
  error:{color:'#B42318',textAlign:'center'},
  emptyList:{flexGrow:1,alignItems:'center',justifyContent:'center'},
  empty:{color:'#718096'},
});
