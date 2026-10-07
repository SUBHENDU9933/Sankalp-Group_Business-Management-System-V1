import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { fetchLeadById, type Lead } from '@/services/leadService';
import { fetchLeadActivities, type LeadActivity } from '@/services/leadActivityService';

export default function LeadDetailScreen() {
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) { router.replace('/login'); return; }
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const [leadData, activityData] = await Promise.all([
          fetchLeadById(id),
          fetchLeadActivities(id),
        ]);
        if (!mounted) return;
        setLead(leadData);
        setActivities(activityData);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Unable to load lead details.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [profile, id]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator /></View></SafeAreaView>;
  if (error || !lead) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.error}>{error || 'Lead not found.'}</Text><Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>← Back to Leads</Text></Pressable>
        <Text style={styles.eyebrow}>LEAD DETAILS</Text>
        <Text style={styles.title}>{lead.name || 'Unnamed lead'}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{lead.status || '—'}</Text></View>

        <View style={styles.card}>
          {!!lead.phone && <Info label="Phone" value={lead.phone} />}
          {!!lead.email && <Info label="Email" value={lead.email} />}
          {!!lead.location && <Info label="Location" value={lead.location} />}
          {!!lead.area && <Info label="Area" value={lead.area} />}
          {!!lead.project_type && <Info label="Project" value={lead.project_type} />}
          {!!lead.requirement && <Info label="Requirement" value={lead.requirement} />}
          {!!lead.assigned_profile?.full_name && <Info label="Assigned To" value={lead.assigned_profile.full_name} />}
        </View>

        <Text style={styles.section}>Activity Timeline</Text>
        <View style={styles.card}>
          {activities.length ? activities.map((item) => (
            <View key={item.id} style={styles.activity}>
              <View style={styles.activityDot} />
              <View style={styles.activityBody}>
                <Text style={styles.activityType}>{item.type || 'activity'}</Text>
                {!!item.content && <Text style={styles.activityText}>{item.content}</Text>}
                <Text style={styles.activityMeta}>
                  {[item.creator?.full_name, item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          )) : <Text style={styles.empty}>No activity recorded.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F8FB'},
  container:{padding:20,paddingBottom:40},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
  back:{color:'#1261A0',fontWeight:'800',fontSize:12,marginBottom:20},
  eyebrow:{color:'#F28C28',fontWeight:'800',fontSize:11,letterSpacing:1.1},
  title:{color:'#132238',fontSize:28,fontWeight:'800',marginTop:5},
  badge:{alignSelf:'flex-start',marginTop:9,paddingHorizontal:10,paddingVertical:6,borderRadius:20,backgroundColor:'#EAF3FB'},
  badgeText:{color:'#1261A0',fontSize:10,fontWeight:'800',textTransform:'uppercase'},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:16,marginTop:14,borderWidth:1,borderColor:'#E8EDF3'},
  info:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F0F2F5'},
  infoLabel:{color:'#8A94A3',fontSize:10,fontWeight:'700',textTransform:'uppercase'},
  infoValue:{color:'#132238',fontSize:13,fontWeight:'600',marginTop:3},
  section:{color:'#132238',fontSize:17,fontWeight:'800',marginTop:24,marginBottom:0},
  activity:{flexDirection:'row',paddingVertical:11},
  activityDot:{width:7,height:7,borderRadius:4,backgroundColor:'#F28C28',marginTop:5,marginRight:10},
  activityBody:{flex:1},
  activityType:{color:'#132238',fontSize:12,fontWeight:'800',textTransform:'capitalize'},
  activityText:{color:'#4A5568',fontSize:12,marginTop:3,lineHeight:18},
  activityMeta:{color:'#9AA3AF',fontSize:10,marginTop:4},
  empty:{color:'#718096',fontSize:12},
  error:{color:'#B42318',textAlign:'center',marginBottom:12},
});
