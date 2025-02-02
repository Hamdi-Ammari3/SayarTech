import React,{useState,useEffect} from 'react'
import { useSignIn,useAuth } from '@clerk/clerk-expo'
import { Link,Redirect } from 'expo-router'
import { View,Text,TouchableOpacity,TextInput,SafeAreaView,StyleSheet,Image,Alert,ActivityIndicator,TouchableWithoutFeedback,Keyboard } from 'react-native'
import { Dropdown } from 'react-native-element-dropdown'
import { collection,getDocs,where,query } from 'firebase/firestore'
import { DB } from '../../firebaseConfig'
import colors from '../../constants/Colors'
import logo from '../../assets/images/logo.jpeg'

export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn,userId } = useAuth()
  const { signOut } = useAuth()

  const [verifying, setVerifying] = useState(false)
  const [countryCode, setCountryCode] = useState('+964')
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

  // Coutries Code
  const countryCodeList = [
    {name:'+964'},
    {name:'+1'},
    {name:'+216'},
  ]

  // Handle country code
  const handleCountryCode = (code) => {
    setCountryCode(code)
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
        identifier: `${countryCode} ${phone}`,
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.form}>
      {verifying ? (
        <>
          <TextInput
            style={styles.customeInput}
            placeholderTextColor={colors.BLACK}
            keyboardType='numeric'
            value={code}
            placeholder="رمز التاكيد"
            onChangeText={(text) => setCode(text)}
          />
          {isVerifyingCode ? (
            <TouchableOpacity style={styles.button}>
                <ActivityIndicator size="small" color={colors.WHITE} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.button}
              onPress={handlerVerification}
              disabled={!code || isVerifyingCode}
            >
              <View style={styles.btnView}>
                <Text style={styles.btntext}>دخول</Text>
              </View>
            </TouchableOpacity>
          )}
          
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
          <View style={styles.input_with_picker}>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={countryCodeList}
              labelField="name"
              valueField="name"
              placeholder=""
              value={countryCode}
              onChange={item => handleCountryCode(item.name)}
            />
            <TextInput
              style={styles.input}
              value={phone}
              placeholder="رقم الهاتف"
              placeholderTextColor={colors.BLACK}
              onChangeText={(text) => setPhone(text)}
              keyboardType='numeric'
            />
          </View>
          {isSigningIn ? (
            <TouchableOpacity style={styles.button}>
                <ActivityIndicator size="small" color={colors.WHITE} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.button} 
              onPress={onSignInPress}
              disabled={!phone || isSigningIn}
            >
              <View style={styles.btnView}>
                <Text style={styles.btntext}>تأكيد</Text>
              </View>
            </TouchableOpacity>
          )}
          
          <Link href={'/signup'}>
            <Text style={styles.link_text}>ليس لديك حساب؟ سجل الآن</Text>
          </Link>
        </>
      )}
      </View>
      </TouchableWithoutFeedback>
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
  customeInput:{
    width:280,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    color:colors.BLACK,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
  },
  input_with_picker:{
    flexDirection:'row',
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    marginBottom:10
  },
  dropdown:{
    width:80,
    height:50,
    backgroundColor:colors.PRIMARY,
    borderTopStartRadius:13,
    borderBottomStartRadius:13,
    justifyContent:'center',
    alignItems:'center'
  },
  dropdownStyle:{
    color:colors.WHITE,
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    fontSize:14,
    lineHeight:50,
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  input:{
    width:200,
    height:50,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    color:colors.BLACK,
  },
  button:{
    width:280,
    height:50,
    marginBottom:10,
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  btnView:{
    alignItems:'center',
    justifyContent:'center',
  },  
  btntext:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE,
    lineHeight:50,
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
  },
})