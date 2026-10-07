import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchScheduleById, type Schedule } from '@/services/scheduleService';
import { useAuth } from '@/auth/AuthProvider';

export default function ScheduleDetailScreen() {
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Schedule | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!profile) { router.replace('/login'); return; }
    if (!id) return;
    fetchScheduleById(id).then(setItem).catch((e) => setError(e?.message || 'Unable to load meeting.'));
  }, [profile, id]);

  if (!profile || (!item && !error)) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator /></View></SafeAreaView>;
  if (error || !item) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.error}>{error || 'Meeting not found.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>← Back to Schedule</Text></Pressable>
      <Text style={styles.eyebrow}>MEETING DETAILS</Text>
      <Text style={styles.title}>{item.title || item.meeting_type || 'Meeting'}</Text>
      <View style={styles.badge}><Text style={styles.badgeText}>{item.status || 'scheduled'}</Text></View>
      <View style={styles.card}>
        <Info label="Date & Time" value={new Date(item.start_at).toLocaleString('en-IN')} />
        {!!item.end_at && <Info label="Ends" value={new Date(item.end_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })} />}
        <Info label="Type" value={(item.meeting_type || '—').replace(/_/g, ' ')} />
        <Info label="Mode" value={item.mode || '—'} />
        {!!item.owner?.full_name && <Info label="Owner" value={item.owner.full_name} />}
        {!!item.arranger?.full_name && <Info label="Arranged By" value={item.arranger.full_name} />}
      </View>
      {!!item.meeting_link && <Pressable style={styles.meetButton} onPress={() => Linking.openURL(item.meeting_link as string)}><Text style={styles.meetText}>Join Google Meet</Text></Pressable>}
      {!!item.google_calendar_url && <Pressable style={styles.calendarButton} onPress={() => Linking.openURL(item.google_calendar_url as string)}><Text style={styles.calendarText}>Open Google Calendar</Text></Pressable>}
      {!!item.location_address && <View style={styles.card}><Info label="Location" value={item.location_address} /></View>}
      {!!item.participants?.length && <View style={styles.card}><Text style={styles.section}>Participants</Text>{item.participants.map((p) => <Text key={p.user_id} style={styles.person}>{p.profile?.full_name || p.profile?.email || 'Team Member'}{p.is_required ? ' · Required' : ''}</Text>)}</View>}
    </ScrollView>
  </SafeAreaView>;
}
function Info({label,value}:{label:string,value:string}){return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#F6F8FB'},container:{padding:20,paddingBottom:40},center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
 back:{color:'#1261A0',fontWeight:'800',fontSize:12,marginBottom:20},eyebrow:{color:'#F28C28',fontWeight:'800',fontSize:11,letterSpacing:1.1},
 title:{color:'#132238',fontSize:27,fontWeight:'800',marginTop:5},badge:{alignSelf:'flex-start',marginTop:9,paddingHorizontal:10,paddingVertical:6,borderRadius:20,backgroundColor:'#EAF3FB'},
 badgeText:{color:'#1261A0',fontSize:10,fontWeight:'800',textTransform:'uppercase'},card:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginTop:14,borderWidth:1,borderColor:'#E8EDF3'},
 info:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F0F2F5'},label:{color:'#8A94A3',fontSize:10,fontWeight:'700',textTransform:'uppercase'},value:{color:'#132238',fontSize:13,fontWeight:'600',marginTop:3},
 meetButton:{marginTop:14,backgroundColor:'#1261A0',borderRadius:12,paddingVertical:14,alignItems:'center'},meetText:{color:'#FFF',fontWeight:'800'},calendarButton:{marginTop:9,borderWidth:1,borderColor:'#1261A0',borderRadius:12,paddingVertical:13,alignItems:'center'},calendarText:{color:'#1261A0',fontWeight:'800'},
 section:{color:'#132238',fontSize:15,fontWeight:'800',marginBottom:8},person:{color:'#4A5568',fontSize:12,paddingVertical:7},error:{color:'#B42318',textAlign:'center',marginBottom:12}
});