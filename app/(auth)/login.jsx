import { useSignIn,useAuth } from '@clerk/clerk-expo'
import { Link,Redirect } from 'expo-router'
import { Text, View,SafeAreaView,StyleSheet, Image, Alert,ActivityIndicator } from 'react-native'
import React,{useState,useEffect} from 'react'
import { collection,getDocs,where,query } from 'firebase/firestore'
import { DB } from '../../firebaseConfig'
import colors from '../../constants/Colors'
import CustomeInput from '../../components/CustomeInput'
import CustomeButton from '../../components/CustomeButton'
import logo from '../../assets/images/logo.jpeg'


export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn,userId } = useAuth()
  const { signOut } = useAuth()

  const [verifying, setVerifying] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [userType,setUserType] = useState('')
  const [loadingUserType, setLoadingUserType] = useState(false)
  const [timer, setTimer] = useState(60)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const handleSignOut = async () => {
    try {
      await signOut(); // Sign out from the existing session
    } catch (error) {
      createAlert('حدث خطأ أثناء تسجيل الخروج')
    }
  };

// Fetch the user type from Firestore
    const fetchUserType = async () => {
      if (userId) {
        setLoadingUserType(true)
        try {
          const userInfoCollectionRef = collection(DB, 'users')
          const q = query(userInfoCollectionRef , where('user_id', '==', userId))
          const userInfoSnapshot = await getDocs(q)
          
          if (!userInfoSnapshot.empty) {
            const userData = userInfoSnapshot.docs[0].data()
            setUserType(userData.compte_owner_type)
          } else {
            createAlert('لا يمكن العثور على نوع المستخدم')
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
        } finally {
          setLoadingUserType(false)
        }
      }
    }

  useEffect(() => {
    if (isSignedIn && userId) {
      fetchUserType();
    }
  }, [isSignedIn, userId]);

//SignIn Button
  const onSignInPress = async () => {
    if (!isLoaded || !signIn || isSigningIn) return // Prevent double-click

    // Sign out from any existing session before signing in
    await handleSignOut()
    setIsSigningIn(true); // Start loading
    
    try {
      const {supportedFirstFactors} = await signIn.create({
        identifier: `+216${phone}`
      })

      // Find the phoneNumberId from all the available first factors for the current sign-in
      const firstPhoneFactor = supportedFirstFactors.find((factor) => {
        return factor.strategy === 'phone_code'
      })
      
      const { phoneNumberId } = firstPhoneFactor

      await signIn.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId,
      })

      setVerifying(true)

    } catch (err) {
      if(err.errors[0].longMessage === 'Identifier is invalid.' || err.errors[0].longMessage === `Couldn't find your account.`) {
        createAlert('لا يوجد حساب مسجل بهذا الرقم!')
      }
    } finally {
      setIsSigningIn(false) // End loading
    }
  }

  //Verification Code Button
  const handlerVerification = async () => {
    if (!isLoaded || !signIn || isVerifyingCode) return // Prevent double-click

    setIsVerifyingCode(true) // Start loading

    try {
      // Use the code provided by the user and attempt verification
      const signInAttempt = await signIn.attemptFirstFactor({
        strategy: 'phone_code',
        code,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })

      } else {
        createAlert('رمز التاكيد غير صحيح')
      }
    } catch (err) {
      createAlert('حدث خطأ أثناء التحقق من رمز التاكيد')
    } finally {
      setIsVerifyingCode(false); // End loading
    }
  }

  useEffect(() => {
    let timerInterval;
    if (verifying) {
      timerInterval = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            clearInterval(timerInterval);
            setVerifying(false);
            createAlert('رمز التاكيد لم يصل. الرجاء المحاولة مرة أخرى.');
            return 60;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [verifying]);


  if (loadingUserType) {
    return (
      <View style={styles.spinner_error_container}>
        <ActivityIndicator size="large" color={colors.PRIMARY}/>
      </View>
    )
  }

  if(isSignedIn && userType === 'parent') {
    return <Redirect href={'/(main)/(parent)/(tabs)/home'}/>
  }

  if(isSignedIn && userType === 'student') {
    return <Redirect href={'/(main)/(student)/(tabs)/home'}/>
  }

  if(isSignedIn && userType === 'driver') {
    return <Redirect href={'/(main)/(driver)/(tabs)/home'}/>
  }


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logo}>
        <Image source={logo} style={styles.logo_image}/>
      </View>
      <View style={styles.form}>
      {verifying ? (
        <>
          <CustomeInput
            keyboardType='numeric'
            value={code}
            placeholder="رمز التاكيد"
            onChangeText={(text) => setCode(text)}
          />
          <CustomeButton 
            title="دخول" 
            onPressHandler={handlerVerification}
            disabledStatus={!code || isVerifyingCode}
            loading={isVerifyingCode}
          />
          <View style={styles.timer_container}>
            <View style={styles.timer_box}>
              <Text style={styles.timer_text}>رمز التاكيد سيصل الى</Text>
              <Text style={styles.timer_dynamic}>{phone}</Text>
            </View>
            <View style={styles.timer_box}>
              <Text style={styles.timer_text}>خلال</Text>
              <Text style={styles.timer_dynamic}>{timer}</Text>
              <Text style={styles.timer_text}>ثانية</Text>
            </View>
          </View>
        </>
        
      ) : (
        <>
          <CustomeInput
            value={phone}
            placeholder="رقم الهاتف"
            onChangeText={(text) => setPhone(text)}
            keyboardType='numeric'
          />
          <CustomeButton 
            title="تاكيد" 
            onPressHandler={onSignInPress}
            disabledStatus={!phone || isSigningIn}
            loading={isSigningIn}
          />
          <Link href={'/signup'}>
            <Text style={styles.link_text}>ليس لديك حساب؟ سجل الآن</Text>
          </Link>
        </>
      )}
      </View>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  container:{
    height:'100%',
    backgroundColor: colors.WHITE,
    alignItems:'center',
  },
  logo:{
    width:'100%',
    height:150,
    marginTop:50,
    justifyContent:'center',
    alignItems:'center',
  },
  logo_image:{
    height:120,
    width:120,
    resizeMode:'contain',
  },
  form:{
    width:'100%',
    paddingVertical:20,
    marginTop:20,
    justifyContent:'space-between',
    alignItems:'center',
  },
  input:{
    width:280,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:20,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
},
  link_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:13,
    color:'#295F98',
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer_container:{
    justifyContent:'center',
    alignItems:'center',
    marginTop:20,
  },
  timer_box:{
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    marginVertical:5
  },
  timer_text:{
    color:'#295F98',
    height:25,
    fontFamily:'Cairo_400Regular',
    fontSize:13,
    marginHorizontal:5
  },
  timer_dynamic:{
    color:'#295F98',
    height:25,
    fontFamily:'Cairo_700Bold',
    fontSize:13,
    marginHorizontal:5,
  }
})