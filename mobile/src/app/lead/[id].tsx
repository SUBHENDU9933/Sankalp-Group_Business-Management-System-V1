import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { can } from '@/auth/permissions';
import { fetchLeadById, updateLeadFollowUp, updateLeadStatus, type Lead } from '@/services/leadService';
import { createSchedule, fetchActiveEmployees, checkCalendarAvailability, type EmployeeOption } from '@/services/scheduleService';
import {
  fetchLeadActivities,
  logLeadCallOutcome,
  type LeadActivity,
} from '@/services/leadActivityService';

const STATUS_OPTIONS = [
  'new',
  'not_contacted',
  'contacted',
  'site_visit',
  'quotation_given',
  'negotiation',
  'floor_plan_site_info',
  'estimate_to_be_created',
  'need_followup',
];

export default function LeadDetailScreen() {
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [callNote, setCallNote] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingType, setMeetingType] = useState('follow_up');
  const [meetingMode, setMeetingMode] = useState('digital');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const editable = can(profile?.role, 'leads', 'edit');
  const statusLabel = useMemo(
    () => lead?.status?.replace(/_/g, ' ') || '—',
    [lead?.status],
  );

  async function load() {
    if (!id) return;
    setError('');
    try {
      const [leadData, activityData] = await Promise.all([
        fetchLeadById(id),
        fetchLeadActivities(id),
      ]);
      setLead(leadData);
      setActivities(activityData);
      setFollowupDate(leadData?.next_followup_date || '');
      setFollowupNote(leadData?.reminder_note || '');
    } catch (e: any) {
      setError(e?.message || 'Unable to load lead details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profile) {
      router.replace('/login');
      return;
    }
    load();
    fetchActiveEmployees().then(setEmployees).catch(() => {});
  }, [profile, id]);

  async function handleCall(outcome: 'connected' | 'not_connected') {
    if (!id || !profile?.id || !editable) return;
    setSaving(true);
    try {
      await logLeadCallOutcome({ leadId: id, outcome, userId: profile.id, note: callNote });
      setCallNote('');
      await load();
      Alert.alert('Call saved', outcome === 'connected' ? 'Connected call recorded.' : 'Not-connected call recorded.');
    } catch (e: any) {
      Alert.alert('Unable to save call', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: string) {
    if (!id || !editable || status === lead?.status) return;
    setSaving(true);
    try {
      await updateLeadStatus(id, status);
      await load();
      Alert.alert('Status updated', `Lead moved to “${status.replace(/_/g, ' ')}”.`);
    } catch (e: any) {
      Alert.alert('Unable to update status', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFollowup() {
    if (!id || !editable) return;
    const value = followupDate.trim();
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format, for example 2026-10-12.');
      return;
    }
    setSaving(true);
    try {
      await updateLeadFollowUp(id, value || null, followupNote);
      await load();
      Alert.alert('Follow-up saved', value ? `Next follow-up: ${value}` : 'Follow-up date cleared.');
    } catch (e: any) {
      Alert.alert('Unable to save follow-up', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator /></View></SafeAreaView>;
  }

  if (error || !lead) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>{error || 'Lead not found.'}</Text>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>← Back to Leads</Text></Pressable>

        <Text style={styles.eyebrow}>LEAD DETAILS</Text>
        <Text style={styles.title}>{lead.name || 'Unnamed lead'}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{statusLabel}</Text></View>

        {editable && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Schedule Meeting</Text>
            <TextInput value={meetingTitle} onChangeText={setMeetingTitle} placeholder={'Meeting with ' + (lead.name || 'Customer')} placeholderTextColor="#9AA3AF" style={styles.input} />
            <Text style={styles.helper}>Date: YYYY-MM-DD · Time: HH:mm (India)</Text>
            <View style={styles.row}>
              <TextInput value={meetingDate} onChangeText={setMeetingDate} placeholder="2026-10-12" placeholderTextColor="#9AA3AF" style={[styles.input, styles.half]} maxLength={10} />
              <TextInput value={meetingTime} onChangeText={setMeetingTime} placeholder="10:30" placeholderTextColor="#9AA3AF" style={[styles.input, styles.half]} maxLength={5} />
            </View>
            <Text style={styles.actionLabel}>Meeting type</Text>
            <View style={styles.chips}>{['follow_up','site_visit','office_meeting','customer_home','video_meeting','design_presentation','estimate_discussion'].map((v) => (
              <Pressable key={v} onPress={() => setMeetingType(v)} style={[styles.chip, meetingType === v && styles.chipActive]}><Text style={[styles.chipText, meetingType === v && styles.chipTextActive]}>{v.replace(/_/g,' ')}</Text></Pressable>
            ))}</View>
            <Text style={styles.actionLabel}>Mode</Text>
            <View style={styles.row}>{['digital','physical'].map((v) => <Pressable key={v} onPress={() => setMeetingMode(v)} style={[styles.modeButton, meetingMode === v && styles.modeButtonActive]}><Text style={styles.modeButtonText}>{v}</Text></Pressable>)}</View>
            <Text style={styles.actionLabel}>Co-members (optional)</Text>
            <View style={styles.chips}>{employees.filter((e) => e.id !== profile?.id).map((e) => {
              const selected = selectedParticipants.includes(e.id);
              return <Pressable key={e.id} onPress={() => setSelectedParticipants((p) => selected ? p.filter(x => x !== e.id) : [...p, e.id])} style={[styles.chip, selected && styles.chipActive]}><Text style={[styles.chipText, selected && styles.chipTextActive]}>{e.full_name || e.email || 'Team Member'}</Text></Pressable>;
            })}</View>
            <ActionButton label="Check & Create Meeting" disabled={saving} onPress={async () => {
              if (!profile?.id || !id) return;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) || !/^\d{2}:\d{2}$/.test(meetingTime)) { Alert.alert('Invalid date/time','Use YYYY-MM-DD and HH:mm.'); return; }
              const start = new Date(meetingDate + 'T' + meetingTime + ':00+05:30');
              if (Number.isNaN(start.getTime())) { Alert.alert('Invalid date/time','Please enter a valid India date and time.'); return; }
              const duration = meetingType === 'site_visit' || meetingType === 'customer_home' ? 60 : meetingType === 'estimate_discussion' || meetingType === 'office_meeting' ? 45 : 30;
              const end = new Date(start.getTime() + duration * 60000);
              setSaving(true);
              try {
                const people = [profile.id, ...selectedParticipants];
                const availability: any = await checkCalendarAvailability({ start: start.toISOString(), end: end.toISOString(), userIds: people });
                if (availability?.available === false && Array.isArray(availability?.busy) && availability.busy.length) {
                  const names = availability.busy.map((b: any) => b.user_name || 'Team Member').filter(Boolean).join(', ');
                  Alert.alert('Slot conflict', 'Busy: ' + names + '. Choose another slot.'); return;
                }
                const result = await createSchedule({
                  lead_id: id, title: meetingTitle.trim() || ('Meeting with ' + (lead.name || 'Customer')),
                  meeting_type: meetingType, mode: meetingMode, status: 'scheduled', priority: 'normal',
                  start_at: start.toISOString(), end_at: end.toISOString(), timezone: 'Asia/Kolkata',
                  customer_email: lead.email || null, location_address: meetingMode === 'physical' ? (lead.location || null) : null,
                }, people, [profile.id]);
                setMeetingTitle(''); setMeetingDate(''); setMeetingTime(''); setSelectedParticipants([]);
                Alert.alert('Meeting created', result.schedule.meeting_link ? 'Meeting created with Google Meet link.' : 'Meeting created. Calendar sync may still be pending.');
                await load();
              } catch (e: any) { Alert.alert('Unable to create meeting', e?.message || 'Please try again.'); }
              finally { setSaving(false); }
            }} />
          </View>
        )}
        {editable && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            {!!lead.phone && (
              <Pressable
                disabled={saving}
                style={styles.primaryAction}
                onPress={() => Linking.openURL(`tel:${lead.phone}`)}
              >
                <Text style={styles.primaryActionText}>Call {lead.phone}</Text>
              </Pressable>
            )}
            <Text style={styles.actionLabel}>Call outcome note</Text>
            <TextInput
              value={callNote}
              onChangeText={setCallNote}
              placeholder="Optional note"
              placeholderTextColor="#9AA3AF"
              style={styles.input}
            />
            <View style={styles.row}>
              <ActionButton
                label="✓ Connected"
                disabled={saving}
                onPress={() => handleCall('connected')}
              />
              <ActionButton
                label="Not Connected"
                disabled={saving}
                onPress={() => handleCall('not_connected')}
              />
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lead Information</Text>
          {!!lead.phone && <Info label="Phone" value={lead.phone} />}
          {!!lead.email && <Info label="Email" value={lead.email} />}
          {!!lead.location && <Info label="Location" value={lead.location} />}
          {!!lead.area && <Info label="Area" value={lead.area} />}
          {!!lead.project_type && <Info label="Project" value={lead.project_type} />}
          {!!lead.requirement && <Info label="Requirement" value={lead.requirement} />}
          {!!lead.assigned_profile?.full_name && <Info label="Assigned To" value={lead.assigned_profile.full_name} />}
          {!!lead.last_contact_date && <Info label="Last Contact" value={lead.last_contact_date} />}
          <Info label="Next Follow-up" value={lead.next_followup_date || 'Not set'} />
          {!!lead.reminder_note && <Info label="Reminder Note" value={lead.reminder_note} />}
        </View>

        {editable && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Update Status</Text>
              <View style={styles.chips}>
                {STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    disabled={saving}
                    onPress={() => handleStatus(status)}
                    style={[styles.chip, lead.status === status && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, lead.status === status && styles.chipTextActive]}>
                      {status.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Next Follow-up</Text>
              <Text style={styles.helper}>Date format: YYYY-MM-DD</Text>
              <TextInput
                value={followupDate}
                onChangeText={setFollowupDate}
                placeholder="2026-10-12"
                placeholderTextColor="#9AA3AF"
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                maxLength={10}
              />
              <TextInput
                value={followupNote}
                onChangeText={setFollowupNote}
                placeholder="Reminder note"
                placeholderTextColor="#9AA3AF"
                style={[styles.input, styles.multiline]}
                multiline
              />
              <View style={styles.row}>
                <ActionButton label="Save Follow-up" disabled={saving} onPress={handleFollowup} />
                <ActionButton label="Clear" disabled={saving} onPress={() => { setFollowupDate(''); setFollowupNote(''); }} />
              </View>
            </View>
          </>
        )}

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
      {saving && <View style={styles.savingBar}><ActivityIndicator /><Text style={styles.savingText}>Saving…</Text></View>}
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, disabled && styles.disabled]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F8FB'},
  container:{padding:20,paddingBottom:50},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
  back:{color:'#1261A0',fontWeight:'800',fontSize:12,marginBottom:20},
  eyebrow:{color:'#F28C28',fontWeight:'800',fontSize:11,letterSpacing:1.1},
  title:{color:'#132238',fontSize:28,fontWeight:'800',marginTop:5},
  badge:{alignSelf:'flex-start',marginTop:9,paddingHorizontal:10,paddingVertical:6,borderRadius:20,backgroundColor:'#EAF3FB'},
  badgeText:{color:'#1261A0',fontSize:10,fontWeight:'800',textTransform:'uppercase'},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,padding:16,marginTop:14,borderWidth:1,borderColor:'#E8EDF3'},
  sectionTitle:{color:'#132238',fontSize:15,fontWeight:'800',marginBottom:10},
  actionLabel:{color:'#718096',fontSize:10,fontWeight:'800',textTransform:'uppercase',marginTop:8,marginBottom:5},
  primaryAction:{backgroundColor:'#1261A0',borderRadius:12,paddingVertical:12,alignItems:'center'},
  primaryActionText:{color:'#FFFFFF',fontWeight:'800',fontSize:12},
  input:{borderWidth:1,borderColor:'#DCE3EA',borderRadius:10,paddingHorizontal:11,paddingVertical:10,color:'#132238',fontSize:12,backgroundColor:'#FBFCFD'},
  multiline:{minHeight:72,textAlignVertical:'top'},
  half:{flex:1},
  modeButton:{flex:1,borderWidth:1,borderColor:'#DCE3EA',borderRadius:10,paddingVertical:10,alignItems:'center'},
  modeButtonActive:{backgroundColor:'#EAF3FB',borderColor:'#1261A0'},
  modeButtonText:{color:'#1261A0',fontSize:11,fontWeight:'800',textTransform:'uppercase'},
  row:{flexDirection:'row',gap:8,marginTop:10},
  actionButton:{flex:1,backgroundColor:'#F28C28',borderRadius:10,paddingVertical:11,alignItems:'center'},
  actionButtonText:{color:'#FFFFFF',fontSize:11,fontWeight:'800',textAlign:'center'},
  disabled:{opacity:0.5},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{borderWidth:1,borderColor:'#DCE3EA',borderRadius:18,paddingHorizontal:10,paddingVertical:8,backgroundColor:'#FFFFFF'},
  chipActive:{backgroundColor:'#EAF3FB',borderColor:'#1261A0'},
  chipText:{color:'#4A5568',fontSize:10,fontWeight:'700',textTransform:'capitalize'},
  chipTextActive:{color:'#1261A0'},
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
  helper:{color:'#8A94A3',fontSize:10,marginBottom:7},
  error:{color:'#B42318',textAlign:'center',marginBottom:12},
  savingBar:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:'#E8EDF3',padding:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  savingText:{color:'#4A5568',fontSize:11,fontWeight:'700'},
});
