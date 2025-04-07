import React,{useState,useEffect} from 'react'
import { useSignIn,useAuth } from '@clerk/clerk-expo'
import { Link,Redirect } from 'expo-router'
import { View,Text,TouchableOpacity,TextInput,SafeAreaView,StyleSheet,Image,Alert,ActivityIndicator,TouchableWithoutFeedback,Keyboard } from 'react-native'
import { Dropdown } from 'react-native-element-dropdown'
import { collection,getDocs,where,query } from 'firebase/firestore'
import { DB } from '../../firebaseConfig'
import axios from 'axios'
import colors from '../../constants/Colors'
import logo from '../../assets/images/logo.jpeg'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import AntDesign from '@expo/vector-icons/AntDesign'

export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn,userId,signOut } = useAuth()

  const TWILIO_SERVICE_SID = "";
  const TWILIO_ACCOUNT_SID = "";
  const TWILIO_AUTH_TOKEN = "";
  const TWILIO_API_URL = ``;
  const TWILIO_VERIFY_URL = ``;

  const [verifying, setVerifying] = useState(false)
  const [countryCode, setCountryCode] = useState('+964')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [userType,setUserType] = useState('')
  const [loadingUserType, setLoadingUserType] = useState(false)
  const [timer, setTimer] = useState(60)
  const [whatsapp,setWatsapp] = useState(true)
  const [sms,setSms] = useState(false)
  const [guestModeSigninLoading,setGuestModeSigninLoading] = useState(false)

  const HARDCODED_PASSWORD = "SecurePass123!";

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  // Coutries Code
  const countryCodeList = [{name:'+964'},{name:'+1'},{name:'+216'}]

  // Handle country code
  const handleCountryCode = (code) => setCountryCode(code)

  // Using whatsapp for code
  const whatsappChannelHandler = () => {
    setWatsapp(true)
    setSms(false)
  }
  
  // Using sms for code
  const smsChannelHandler = () => {
    setSms(true)
    setWatsapp(false)
  }

  // Sign out from the existing session
  const handleSignOut = async () => {
    try {
      await signOut()
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
        console.log('Error fetching user data:', error)
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

  // Check if the User Exists in Clerk Before Sending OTP
  const checkUserExists = async () => {
    try {
      const username = `user_${phone}`;

      const signInAttempt = await signIn.create({
        identifier: username,
      });

      if (signInAttempt.status === "needs_first_factor") {
        return true; // User exists
      }
      return false; // User does not exist
    } catch (error) {
      if (error.errors?.[0]?.longMessage?.includes("Couldn't find your account")) {
        return false; // User does not exist
      }
      return "error"; // Some other error occurred
    }
  };

  // Send OTP Only If User Exists
  const handleSendOTP = async () => {
    if (!isLoaded || !signIn || isSigningIn) return;

    if (!phone) {
      createAlert("الرجاء إدخال رقم الهاتف");
      return;
    }

    await handleSignOut()

    setIsSigningIn(true)

    try {
      // Check if the user exists
      const userExists = await checkUserExists();
      if (userExists === false) {
        createAlert("لا يوجد حساب مسجل بهذا الرقم! الرجاء التسجيل أولا");
        setIsSigningIn(false);
        return;
      } else if (userExists === "error") {
        createAlert("حدث خطأ أثناء التحقق من الحساب");
        setIsSigningIn(false);
        return;
      }

      // Step 2: Send OTP if the user exists
      const otpResponse = await sendOTP();
      if (!otpResponse.success) {
        createAlert("فشل إرسال رمز التحقق، حاول مرة أخرى");
      }
    } catch (error) {
      createAlert("حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى");
    } finally {
      setIsSigningIn(false);
    }
  };

  // Function to send OTP
  const sendOTP = async () => {
    try {
      const response = await axios.post(
        TWILIO_API_URL,
        new URLSearchParams({
          To: `${countryCode} ${phone}`,
          Channel: whatsapp ? 'whatsapp' : 'sms',
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          },
        }
      );

      setVerifying(true)
      
      return { success: true, message: "OTP sent successfully" };
    } catch (error) {
      console.log("Error sending OTP:", error.response?.data || error.message);
      return { success: false, message: "Failed to send OTP" };
    }
  };

  // Verify code handler
  const onVerifyPress = async () => {
    if (!isLoaded || !signIn || isVerifyingCode) return;

    if (!code) {
      createAlert('يرجى ادخال الكود')
      return;
    }

    setIsVerifyingCode(true) // Start loading
  
    const verificationResult = await verifyOTP(`${countryCode}${phone}`, code);
  
    if (verificationResult.success) {
      try {
        const username = `user_${phone}`;

        const signInAttempt = await signIn.create({
          identifier: username,
          password: HARDCODED_PASSWORD,
        });

        if (signInAttempt.status === "complete") {
          await setActive({ session: signInAttempt.createdSessionId });

        } else {
          createAlert("حدث خطأ أثناء تسجيل الدخول");
        }     
      } catch (error) {
        createAlert("حدث خطأ أثناء تسجيل الدخول");
      } finally {
        setIsVerifyingCode(false)
      }
    } else {
      createAlert("رمز التاكيد غير صحيح");
      setIsVerifyingCode(false)
    }
  };

  // Function to verify OTP
  const verifyOTP = async (phoneNumber, code) => {
    try {
      const response = await axios.post(
        TWILIO_VERIFY_URL,
        new URLSearchParams({
          To: phoneNumber,
          Code: code,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          },
        }
      );
    
      if (response.data.status === "approved") {
        return { success: true, message: "OTP verified successfully" };
      } else {
        return { success: false, message: "Invalid OTP" };
      }
    } catch (error) {
      console.log("Error verifying OTP:", error.response?.data || error.message);
      return { success: false, message: "Failed to verify OTP" };
    } finally {
    }
  };
  
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


  // Guest Mode signin handler
  const guestModeSigninHandler = async () => {
    if (!isLoaded || !signIn) return;
    
    setGuestModeSigninLoading(true) // Start loading
        
    try {
      const username = `user_${phone}`;

      if(username === 'user_2015550101' || username === 'user_2015550102' || username === 'user_2015550104' || username === 'user_2015550105') {
        const signInAttempt = await signIn.create({
          identifier: username,
          password: HARDCODED_PASSWORD,
        });
    
        if (signInAttempt.status === "complete") {
          await setActive({ session: signInAttempt.createdSessionId });
    
        } else {
          createAlert("حدث خطأ أثناء تسجيل الدخول");
        }  
      } else {
        createAlert('please enter a valid number')
        setGuestModeSigninLoading(false)
      }
    } catch (error) {
      createAlert("حدث خطأ أثناء تسجيل الدخول")
      setGuestModeSigninLoading(false)
    } finally {
      setGuestModeSigninLoading(false)
    }
  };


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

  if(isSignedIn && userType === 'employee') {
    return <Redirect href={'/(main)/(employee)/(tabs)/home'}/>
  }

  if(isSignedIn && userType === 'driver') {
    return <Redirect href={'/(main)/(driver)/(tabs)/home'}/>
  }

  // Guest Mode
  if(countryCode === '+1') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.logo}>
          <Image source={logo} style={styles.logo_image}/>
        </View>
        <View style={styles.form}>

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
          {guestModeSigninLoading ? (
            <TouchableOpacity style={styles.button}>
              <ActivityIndicator size="small" color={colors.WHITE} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.button} 
              onPress={guestModeSigninHandler}
              disabled={guestModeSigninLoading}
            >
              <View style={styles.btnView}>
                <Text style={styles.btntext}>Guest Mode</Text>
              </View>
            </TouchableOpacity>
          )}
          <Link href={'/signup'}>
            <Text style={styles.link_text}>ليس لديك حساب؟ سجل الآن</Text>
          </Link>
        </View>
      </SafeAreaView>
    )
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
              onPress={onVerifyPress}
              disabled={isVerifyingCode}
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

          <View style={styles.whatsapp_sms_container}>
            <View style={styles.whatsapp_sms_check}>
              <TouchableOpacity 
                style={[styles.whatsapp_sms_check_btn,whatsapp && styles.whatsapp_sms_check_btn_active]} 
                onPress={whatsappChannelHandler}
              >
                <FontAwesome name="whatsapp" size={24} color={whatsapp ? colors.WHITE : colors.BLACK} />
              </TouchableOpacity>
            </View>
            <View style={styles.whatsapp_sms_check}>
              <TouchableOpacity 
                style={[styles.whatsapp_sms_check_btn,sms && styles.whatsapp_sms_check_btn_active]} 
                onPress={smsChannelHandler}
              >
                <AntDesign name="message1" size={21} color={sms ? colors.WHITE : colors.BLACK} />
              </TouchableOpacity>
            </View>       
          </View>

          {isSigningIn ? (
            <TouchableOpacity style={styles.button}>
                <ActivityIndicator size="small" color={colors.WHITE} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleSendOTP}
              disabled={isSigningIn}
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
    fontFamily:'Cairo_400Regular',
  },
  input_with_picker:{
    flexDirection:'row',
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    marginBottom:20
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
  whatsapp_sms_container:{
    width:200,
    height:40,
    marginBottom:20,
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    alignItems:'center',
  },
  whatsapp_sms_check_btn:{
    width:70,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
    backgroundColor:colors.GRAY
  },
  whatsapp_sms_check_btn_active:{
    width:70,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
    backgroundColor:colors.PRIMARY
  },
  whatsapp_sms_check:{
    width:70,
    flexDirection:'row-reverse',
    justifyContent:'space-between',
    alignItems:'center',
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