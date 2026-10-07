import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';

const ITEMS = [
  { label: 'Home', path: '/dashboard' },
  { label: 'Leads', path: '/leads' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Customers', path: '/customers' },
  { label: 'Alerts', path: '/notifications' },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <View style={styles.bar}>
      {ITEMS.map((item) => {
        const active = pathname === item.path;
        return (
          <Pressable
            key={item.path}
            accessibilityRole="button"
            onPress={() => router.replace(item.path)}
            style={styles.item}
          >
            <View style={[styles.dot, active && styles.dotActive]} />
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
  dot:{width:6,height:6,borderRadius:3,backgroundColor:'#C8D0DB',marginBottom:4},
  dotActive:{backgroundColor:'#1261A0'},
  label:{color:'#718096',fontSize:9,fontWeight:'700'},
  labelActive:{color:'#1261A0'},
});
