import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { fetchSchedules, type Schedule } from '@/services/scheduleService';
import { MobileTabBar } from '@/components/MobileTabBar';

export default function ScheduleScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(manual = false) {
    if (manual) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      setRows(await fetchSchedules({ from: start.toISOString(), to: end.toISOString() }));
    } catch (e: any) { setError(e?.message || 'Unable to load schedule.'); }
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
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>Upcoming meetings · next 7 days</Text>
        {loading ? <View style={styles.center}><ActivityIndicator /></View> :
          error ? <View style={styles.center}><Text style={styles.error}>{error}</Text></View> :
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            contentContainerStyle={rows.length ? styles.list : styles.emptyList}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => router.push('/schedule/' + item.id)}>
                <View style={styles.row}>
                  <Text style={styles.name} numberOfLines={2}>{item.title || item.meeting_type || 'Meeting'}</Text>
                  <Text style={styles.mode}>{item.mode || '—'}</Text>
                </View>
                <Text style={styles.time}>{new Date(item.start_at).toLocaleString('en-IN')}</Text>
                {!!item.owner?.full_name && <Text style={styles.meta}>Owner: {item.owner.full_name}</Text>}
                {!!item.status && <Text style={styles.meta}>Status: {item.status}</Text>}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No upcoming meetings.</Text>}
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
  row:{flexDirection:'row',alignItems:'flex-start',gap:8},
  name:{flex:1,color:'#132238',fontSize:15,fontWeight:'800'},
  mode:{color:'#1261A0',fontSize:10,fontWeight:'800',textTransform:'uppercase'},
  time:{color:'#132238',fontSize:12,fontWeight:'700',marginTop:9},
  meta:{color:'#718096',fontSize:12,marginTop:5},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:20},
  error:{color:'#B42318',textAlign:'center'},
  emptyList:{flexGrow:1,alignItems:'center',justifyContent:'center'},
  empty:{color:'#718096'},
});
