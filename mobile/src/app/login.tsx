import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';

const BLUE = '#1261A0';
const ORANGE = '#F28C28';

export default function LoginScreen() {
  const { session, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && session) router.replace('/dashboard');
  }, [authLoading, session]);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    void rememberMe;
    // Navigation is driven by the AuthProvider session effect above.
    // Do not navigate here as well: the auth-state update can otherwise
    // trigger competing replace() calls and cause a navigation update loop.
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <View style={styles.logoMark}><Text style={styles.logoText}>S</Text></View>
          <Text style={styles.title}>SANKALP BMS</Text>
          <Text style={styles.subtitle}>Business Management System</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Welcome Back</Text>
          <Text style={styles.helper}>Sign in with your existing BMS account.</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#8A94A6" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#8A94A6" secureTextEntry style={styles.input} />
          <Pressable onPress={() => setRememberMe((v) => !v)} style={styles.remember}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]} />
            <Text style={styles.rememberText}>Keep me signed in</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={handleLogin} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>SIGN IN</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F6F8FB'},
  container:{flex:1,justifyContent:'center',padding:24},
  brand:{alignItems:'center',marginBottom:28},
  logoMark:{width:68,height:68,borderRadius:20,backgroundColor:BLUE,alignItems:'center',justifyContent:'center',marginBottom:12},
  logoText:{color:'#FFFFFF',fontSize:34,fontWeight:'800'},
  title:{color:'#132238',fontSize:24,fontWeight:'800',letterSpacing:1},
  subtitle:{color:'#6B778C',marginTop:4,fontSize:13},
  card:{backgroundColor:'#FFFFFF',borderRadius:22,padding:22,shadowColor:'#000000',shadowOpacity:0.08,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:4},
  heading:{color:'#132238',fontSize:22,fontWeight:'800'},
  helper:{color:'#718096',marginTop:5,marginBottom:20},
  input:{height:52,borderWidth:1,borderColor:'#E1E7EF',borderRadius:13,paddingHorizontal:15,color:'#172033',marginBottom:12,backgroundColor:'#FAFBFD'},
  remember:{flexDirection:'row',alignItems:'center',marginTop:2},
  checkbox:{width:18,height:18,borderRadius:5,borderWidth:1.5,borderColor:'#C4CCD8',marginRight:8},
  checkboxActive:{backgroundColor:ORANGE,borderColor:ORANGE},
  rememberText:{color:'#536174',fontSize:13},
  error:{color:'#C0392B',fontSize:13,marginTop:12},
  button:{height:52,borderRadius:13,backgroundColor:BLUE,alignItems:'center',justifyContent:'center',marginTop:18},
  buttonPressed:{opacity:0.82},
  buttonText:{color:'#FFFFFF',fontWeight:'800',letterSpacing:0.8},
});
