import React,{useState,useEffect,useRef} from 'react'
import { Text, View,StyleSheet,Image, Alert,Platform,TouchableOpacity,TextInput,Modal } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import { useSignUp } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import colors from '../../constants/Colors'
import { Link } from 'expo-router'
import { addDoc, collection } from 'firebase/firestore'
import { DB } from '../../firebaseConfig'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Dropdown } from 'react-native-element-dropdown'
import { generate } from 'referral-codes';
import CustomeButton from '../../components/CustomeButton'
import CustomeInput from '../../components/CustomeInput'
import logo from '../../assets/images/logo.jpeg'

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()

  const [compteOwner,setCompteOwner] = useState('')
  const [userName,setUserName] = useState('')
  const [userFamilyName,setUserFamilyName] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [timer, setTimer] = useState(60)
  const [showReferralModal,setShowReferralModal] = useState(false)
  const [referralCode,setReferralCode] = useState('')
  const [referredByFriend,setReferredByFriend] = useState(false)
  const [friendReferralCode, setFriendReferralCode] = useState('')
  const [expoPushToken, setExpoPushToken] = useState('')
  const [notification, setNotification] = useState(false)
  const notificationListener = useRef()
  const responseListener = useRef()

  const compte_owner = [
    {label:'ولي أمر',value:'parent'},
    {label:'طالب',value:'student'},
    {label:'سائق',value:'driver'}
  ]

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

// Function to register for push notifications and save the token in AsyncStorage
  const registerForPushNotificationsAsync = async () => {
  try {

    // Create notification channel for Android 13+
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if(Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        //createAlert('يرجى تفعيل خدمة الاشعارات لتتمكن من استخدام التطبيق');
        console.log('Failed to get push token for push notification...')
        return;
      }
      token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.eas.projectId,
      })
      await AsyncStorage.setItem('expoPushToken', token.data);
      //setExpoPushToken(token.data);
    } else {
      console.log('Must use physical device for Push Notifications...')
    }
    return token.data
  } catch (error) {
    console.error('Error registering for notifications:', error);
  }
}

useEffect(() => {
  registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

  notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
    setNotification(notification);
  });

  responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
    console.log(response);
  });

  return () => {
    Notifications.removeNotificationSubscription(notificationListener.current);
    Notifications.removeNotificationSubscription(responseListener.current);
  };
}, []);


  const handleCompteOwner = (owner) => {
    setCompteOwner(owner)
  }

  const generateReferralCode = (phone) => {
    // Get the last 2 digits of the phone number
    const lastTwoDigits = phone.slice(-2);

  // Generate a 4-character code using the referral-codes library
    const randomCode = generate({
      length: 4,
      count: 1,
    })[0];

    // Combine the random code with the last 2 digits of the phone number
    return `${randomCode}${lastTwoDigits}`;
  }

  const onSignUpPress = async () => {
    if (!isLoaded || isSigningUp) return

    if(!expoPushToken) {
      createAlert('يرجى تفعيل خدمة الاشعارات لتتمكن من استخدام التطبيق')
      return
    }

    setIsSigningUp(true); // Start loading

    try {
      // Generate the user's referral code
      const newReferralCode = generateReferralCode(phone);
      setReferralCode(newReferralCode);

      await signUp.create({
        phoneNumber:`+216${phone}`,
      });

      await signUp.preparePhoneNumberVerification();
      setVerifying(true);
    } catch (err) {
      if(err.errors[0].longMessage === 'phone_number must be a valid phone number according to E.164 international standard.') {
        createAlert('يرجى ادخال رقم هاتف صحيح')
      } else if (err.errors[0].longMessage === 'That phone number is taken. Please try another.') {
        createAlert('يوجد حساب مسجل بهذا الرقم! الرجاء استعمال رقم آخر')
      } else {
        createAlert('يوجد خلل الرجاء المحاولة مرة ثانية')
        console.log(err)
      }
    } finally{
      setIsSigningUp(false) // End Loading
    }
  }

  // Save user data to Firestore
  const saveUserDataToFirestore = async (userId) => {
    try {
      const userInfoCollectionRef = collection(DB,'users')
      const userData = {
        user_id: userId,
        user_full_name: userName,
        user_family_name: userFamilyName,
        compte_owner_type:compteOwner,
        phone_number:`+216${phone}`,
        user_notification_token: expoPushToken,
        user_referral_code:referralCode,
        referred_by_friend:referredByFriend,
        friend_referral_code:friendReferralCode || null,
        user_signup_data: new Date()
      }

      const docRef = await addDoc(userInfoCollectionRef,userData)

    } catch (error) {
      createAlert('يوجد خلل الرجاء المحاولة مرة ثانية')
    }
  }

// Update referredByFriend based on the friendReferralCode input
  useEffect(() => {
    setReferredByFriend(friendReferralCode.trim() !== '');
  }, [friendReferralCode]);

// Press no for referred by friend
  const closeReferredBy = () => {
    setReferredByFriend(false)
    setFriendReferralCode('')
    setShowReferralModal(false)
  }

  // Press Yes for referred by friend
  const confirmReferredBy = () => {
    setShowReferralModal(false)
  }

  const onPressVerify = async () => {
    if (!isLoaded || isVerifying) return // Prevent double-click

    setIsVerifying(true) // Start loading

    try {
      // Attempt to verify the SMS code
      const completeSignUp = await signUp.attemptPhoneNumberVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId })

        //save user data to firestore
        await saveUserDataToFirestore(completeSignUp.createdUserId)
        
        if(compteOwner === 'parent') {
          router.replace('(main)/(parent)/(tabs)/home')
        } else if (compteOwner === 'student') {
          router.replace('(main)/(student)/(tabs)/home')
        } else if (compteOwner === 'driver') {
          router.replace('(main)/(driver)/(tabs)/home')
        }
      } else {
        createAlert('يوجد خلل الرجاء المحاولة مرة ثانية')
      }
    } catch (err) {
      if(err.errors[0].longMessage === 'Incorrect code') {
        createAlert('الرجاء التثبت من رمز التاكيد')
      }
    } finally {
      setIsVerifying(false)
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logo}>
        <Image source={logo} style={styles.logo_image}/>
      </View>
      <View style={styles.form}>
      {!verifying ? (
        <>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.dropdownStyle}
            selectedTextStyle={styles.dropdownStyle}
            data={compte_owner}
            labelField="label"
            valueField="value"
            placeholder= 'صاحب الحساب'
            value={compteOwner}
            onChange={item => {
              handleCompteOwner(item.value)
              }}
          />
          <CustomeInput
            value={userName}
            placeholder="الاسم الكامل"
            onChangeText={(text) => setUserName(text)}
          />
          <CustomeInput
            value={userFamilyName}
            placeholder="اللقب"
            onChangeText={(text) => setUserFamilyName(text)}
          />
          <CustomeInput
            value={phone}
            placeholder="رقم الهاتف"
            keyboardType='numeric'
            onChangeText={(text) => setPhone(text)}
          />
          <TouchableOpacity style={styles.referralBtn} onPress={() => setShowReferralModal(true)}>
            <Text style={styles.link_text}>هل تمت دعوتك من قبل صديق؟</Text>
          </TouchableOpacity>
          <Modal
            animationType="fade"
            transparent={true}
            visible={showReferralModal}
            onRequestClose={() => setShowReferralModal(false)}
          >
            <View style={styles.rfCode_modal_container}>
              <View style={styles.rfCode_modal_box}>
                <TextInput
                  style={styles.rfCode_input}
                  value={friendReferralCode}
                  onChangeText={setFriendReferralCode}
                  placeholder="ادخل الكود"
                />
                <View style={styles.rfCode_btn_container}>
                  <TouchableOpacity style={styles.deny_rfCode_btn} onPress={closeReferredBy}>
                    <Text style={styles.deny_rfCode_btn_text}>لا</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.add_rfCode_btn} onPress={confirmReferredBy}>
                    <Text style={styles.add_rfCode_btn_text}>اضف</Text>
                  </TouchableOpacity>
                </View>
                
              </View>
            </View>
          </Modal>
          <CustomeButton 
            title="تسجيل" 
            onPressHandler={onSignUpPress} 
            disabledStatus={!compteOwner ||!userName || !userFamilyName || !phone || isSigningUp }
            loading={isSigningUp}
          />
          <Link href={'/login'}>
            <Text style={styles.link_text}>لديك حساب بالفعل؟ ادخل الان</Text>
          </Link>
        </>
      ) : (
        <>
          <CustomeInput
           keyboardType='numeric'
           value={code} 
           placeholder="رمز التاكيد" 
           onChangeText={(code) => setCode(code)} 
          />
          <CustomeButton
            title="تاكيد" 
            onPressHandler={onPressVerify}
            disabledStatus={!code || isVerifying}
            loading={isVerifying}
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
      )}
      </View>
    </SafeAreaView>
)}


const styles = StyleSheet.create({
  container:{
    height:'100%',
    backgroundColor: colors.WHITE,
    alignItems:'center'
  },
  logo:{
    width:'100%',
    height:150,
    marginTop:25,
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
  dropdown:{
    width:280,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.PRIMARY,
    borderRadius:20,
  },
  dropdownStyle:{
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  referralBtn:{
    width:280,
    height:50,
    marginBottom:10,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
  },
  referralBtnText:{
    fontFamily:'Cairo_400Regular',
    fontSize:14,
  },
  rfCode_modal_container:{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  rfCode_modal_box:{
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  rfCode_input:{
    width:160,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    color:colors.BLACK,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
  },
  rfCode_btn_container:{
    width:160,
    flexDirection:'row',
    justifyContent:'space-between'
  },
  add_rfCode_btn:{
    width:70,
    height:50,
    marginBottom:10,
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'  
  },
  add_rfCode_btn_text:{
    fontFamily:'Cairo_700Bold',
    color:colors.WHITE
  },  
  deny_rfCode_btn:{
    width:70,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'  
  },
  deny_rfCode_btn_text:{
    fontFamily:'Cairo_700Bold',
    color:colors.PRIMARY
  },  
  link_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:13,
    color:'#295F98'
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