import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { fetchCustomers, type Customer } from '@/services/customerService';
import { MobileTabBar } from '@/components/MobileTabBar';

export default function CustomersScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(manual = false) {
    if (manual) setRefreshing(true); else setLoading(true);
    setError('');
    try { setRows(await fetchCustomers()); }
    catch (e: any) { setError(e?.message || 'Unable to load customers.'); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => {
    if (!profile) router.replace('/login');
    else load();
  }, [profile]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>SANKALP BMS</Text>
        <Text style={styles.title}>Customers</Text>
        <Text style={styles.subtitle}>{rows.length} visible records</Text>
        {loading ? <View style={styles.center}><ActivityIndicator /></View> :
          error ? <View style={styles.center}><Text style={styles.error}>{error}</Text></View> :
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            contentContainerStyle={rows.length ? styles.list : styles.emptyList}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name} numberOfLines={1}>{item.name || 'Unnamed customer'}</Text>
                {!!item.phone && <Text style={styles.meta}>{item.phone}</Text>}
                {!!item.address && <Text style={styles.meta}>{item.address}</Text>}
                {!!item.project_details && <Text style={styles.meta}>{item.project_details}</Text>}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No visible customers.</Text>}
          />}
      </View>
      <MobileTabBar />
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F8FB'},
  body:{flex:1,padding:20},
  eyebrow:{color:'#F28C28',fontWeight:'800',fontSize:11,letterSpacing:1.1},
  title:{color:'#132238',fontSize:28,fontWeight:'800',marginTop:3},
  subtitle:{color:'#718096',marginTop:3,marginBottom:16,fontSize:12},
  list:{paddingBottom:18},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:16,marginBottom:10,borderWidth:1,borderColor:'#E8EDF3'},
  name:{color:'#132238',fontSize:15,fontWeight:'800'},
  meta:{color:'#718096',fontSize:12,marginTop:5},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:20},
  error:{color:'#B42318',textAlign:'center'},
  emptyList:{flexGrow:1,alignItems:'center',justifyContent:'center'},
  empty:{color:'#718096'},
});
