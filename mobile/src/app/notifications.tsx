import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MobileTabBar } from '@/components/MobileTabBar';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type BmsNotification,
} from '@/services/notificationService';

const BLUE = '#1261A0';
const ORANGE = '#F28C28';

function openLink(link?: string | null) {
  if (!link) return;
  if (link.startsWith('/lead/')) return router.push(link as any);
  if (link.startsWith('/schedule/')) return router.push(link as any);
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<BmsNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setItems(await fetchNotifications(50));
    } catch (e: any) {
      setError(e?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function read(id: string) {
    try {
      await markNotificationRead(id);
      setItems(current => current.map(item => item.id === id ? { ...item, read: true } : item));
    } catch (e: any) {
      setError(e?.message || 'Unable to update notification.');
    }
  }

  async function markAll() {
    try {
      await markAllNotificationsRead();
      setItems(current => current.map(item => ({ ...item, read: true })));
    } catch (e: any) {
      setError(e?.message || 'Unable to mark notifications as read.');
    }
  }

  const unread = items.filter(item => !item.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SANKALP BMS</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>{unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up'}</Text>
          </View>
          {unread > 0 ? (
            <Pressable onPress={markAll} style={styles.markAll}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={BLUE} /></View>
        ) : items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No notifications</Text><Text style={styles.emptyText}>New BMS alerts and follow-up updates will appear here.</Text></View>
        ) : (
          <View style={styles.list}>
            {items.map(item => (
              <Pressable
                key={item.id}
                onPress={async () => { if (!item.read) await read(item.id); openLink(item.link); }}
                style={[styles.card, !item.read && styles.unreadCard]}
              >
                <View style={styles.row}>
                  <View style={[styles.dot, !item.read && styles.dotUnread]} />
                  <View style={styles.body}>
                    <Text style={styles.type}>{item.type || 'BMS ALERT'}</Text>
                    <Text style={styles.cardTitle}>{item.title || 'Notification'}</Text>
                    {item.body ? <Text style={styles.cardText}>{item.body}</Text> : null}
                    <Text style={styles.time}>{item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : ''}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <MobileTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F8FB'},
  container:{padding:20,paddingBottom:40},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:10},
  eyebrow:{color:ORANGE,fontWeight:'800',fontSize:12,letterSpacing:1.2},
  title:{color:'#132238',fontSize:28,fontWeight:'800',marginTop:4},
  subtitle:{color:'#718096',marginTop:4,fontSize:12},
  markAll:{backgroundColor:'#FFFFFF',paddingHorizontal:12,paddingVertical:9,borderRadius:10},
  markAllText:{color:BLUE,fontWeight:'800',fontSize:11},
  error:{backgroundColor:'#FFF5F5',borderRadius:12,padding:12,marginTop:16},
  errorText:{color:'#B42318',fontSize:12},
  list:{marginTop:18,gap:10},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:16},
  unreadCard:{borderLeftWidth:4,borderLeftColor:ORANGE},
  row:{flexDirection:'row',gap:10},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:'#D5DCE5',marginTop:6},
  dotUnread:{backgroundColor:ORANGE},
  body:{flex:1},
  type:{color:BLUE,fontSize:9,fontWeight:'800',letterSpacing:1},
  cardTitle:{color:'#132238',fontWeight:'800',fontSize:15,marginTop:3},
  cardText:{color:'#596779',fontSize:12,lineHeight:18,marginTop:5},
  time:{color:'#98A2B3',fontSize:10,marginTop:8},
  center:{paddingVertical:60,alignItems:'center'},
  empty:{backgroundColor:'#FFFFFF',borderRadius:16,padding:24,marginTop:20,alignItems:'center'},
  emptyTitle:{color:'#132238',fontSize:16,fontWeight:'800'},
  emptyText:{color:'#718096',fontSize:12,lineHeight:18,textAlign:'center',marginTop:6},
});
