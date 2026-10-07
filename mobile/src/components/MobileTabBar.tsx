import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchUnreadNotificationCount } from '@/services/notificationService';

const ITEMS = [
  { label: 'Home', path: '/dashboard' },
  { label: 'Leads', path: '/leads' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Customers', path: '/customers' },
  { label: 'Alerts', path: '/notifications' },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetchUnreadNotificationCount().then(count => { if (mounted) setUnread(count); });
    return () => { mounted = false; };
  }, [pathname]);

  return (
    <View style={styles.bar}>
      {ITEMS.map((item) => {
        const active = pathname === item.path;
        return (
          <Pressable key={item.path} accessibilityRole="button" onPress={() => router.replace(item.path)} style={styles.item}>
            <View style={styles.iconRow}>
              <View style={[styles.dot, active && styles.dotActive]} />
              {item.path === '/notifications' && unread > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar:{flexDirection:'row',backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:'#E7ECF2',paddingTop:8,paddingBottom:8},
  item:{flex:1,alignItems:'center',paddingVertical:4},
  iconRow:{height:14,alignItems:'center',justifyContent:'center',position:'relative'},
  dot:{width:6,height:6,borderRadius:3,backgroundColor:'#C8D0DB',marginBottom:4},
  dotActive:{backgroundColor:'#1261A0'},
  badge:{position:'absolute',left:8,top:-5,minWidth:14,height:14,borderRadius:7,backgroundColor:'#F28C28',alignItems:'center',justifyContent:'center',paddingHorizontal:3},
  badgeText:{color:'#FFFFFF',fontSize:8,fontWeight:'800'},
  label:{color:'#718096',fontSize:9,fontWeight:'700'},
  labelActive:{color:'#1261A0'},
});
