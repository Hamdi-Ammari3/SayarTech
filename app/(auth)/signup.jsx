import React,{useState,useEffect,useRef} from 'react'
import { Text, View,StyleSheet,Image, Alert,Platform,TouchableOpacity,TextInput,Modal,ScrollView } from 'react-native'
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
import Checkbox from 'expo-checkbox'
import { Dropdown } from 'react-native-element-dropdown'
import { generate } from 'referral-codes';
import CustomeButton from '../../components/CustomeButton'
import CustomeInput from '../../components/CustomeInput'
import logo from '../../assets/images/logo.jpeg'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import FontAwesome from '@expo/vector-icons/FontAwesome';


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
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
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
        importance: Notifications.AndroidImportance.MAX,
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

  const openPrivacyTermsModal = () => {
    if(privacyAccepted === false || termsAccepted === false) {
      setShowPrivacyModal(true);
    }
  }

  const handleAccept = () => {
    if (privacyAccepted && termsAccepted) {
      setShowPrivacyModal(false);
    }
  };


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
        user_privacy_policy:privacyAccepted,
        user_terms_of_use:termsAccepted,
        user_signup_data: new Date()
      }

      const docRef = await addDoc(userInfoCollectionRef,userData)

    } catch (error) {
      createAlert('يوجد خلل الرجاء المحاولة مرة ثانية')
    }
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

          <TouchableOpacity style={styles.privacy_terms_approve_btn} onPress={openPrivacyTermsModal}>
            {privacyAccepted && termsAccepted ? (
              <FontAwesome6 name="square-check" size={24} color="#295F98" />
            ) : (
              <FontAwesome name="square-o" size={24} color="#295F98" />
            )}
            
            <Text style={styles.link_text}> أوافق على سياسة الخصوصية وشروط الاستخدام</Text>
          </TouchableOpacity>
          <Modal 
            animationType="fade"
            transparent={true}
            visible={showPrivacyModal}
            onRequestClose={() => setShowPrivacyModal(false)}
          >
            <View style={styles.privacy_modal_container}>
              <View style={styles.privacy_modal_box}>
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.privacy_policy_scrollview} 
                >
                  <View style={{marginBottom:20}}>
                    <Text style={styles.privacy_policy_title}>Privacy Policy for Sayartech</Text>
                    <Text style={styles.privacy_policy_text}>
                    About Sayartech,
                    Sayartech is a dedicated platform designed to facilitate the safe and reliable transportation of children between home and school. Our mission is to provide parents with peace of mind by connecting them with trusted, professional drivers specializing in school transportation.
                    Using Sayartech, parents can:
                    Register their children by providing essential information such as their name, age, gender, school details, and home location.
                    Find and connect with professional drivers who have been carefully vetted and specialize in transporting schoolchildren.
                    Monitor the driver’s navigation and progress in real-time through the app’s tracking system.
                    Receive timely notifications when the driver is approaching their home, when the child arrives at school, and when they are on their way back home.
                    We aim to create a secure, efficient, and stress-free transportation experience for parents and their children.
                    Why We Collect User Data
                    To deliver a seamless and secure experience, Sayartech collects user data to:
                    Personalize Services
                    We use the information provided during registration to ensure the app is tailored to the user’s specific needs, such as matching families with drivers operating in their area and associated with their child’s school.
                    Ensure Safety and Reliability
                    By collecting and verifying user and driver details, we maintain a trustworthy environment where parents feel confident about their child's transportation.
                    Enable Core Features
                    User data powers essential app features like real-time tracking, notification systems, and communication between parents and drivers.
                    Improve the App Experience
                    We analyze user feedback and usage patterns to optimize the app, introduce new features, and ensure its reliability and security.
                    What Data We Collect and How It Is Used
                    We collect the following types of data:
                    1. User Information
                    From Parents:
                    Full name, phone number, and account type (parent).
                    Details of children (name, age, gender, school, home location).
                    Notification preferences.
                    From Drivers:
                    Full name, phone number, and account type (driver).
                    Vehicle details and professional certification.
                    Purpose:
                    This data is used to verify user identity, enable matchmaking between parents and drivers, and deliver notifications.
                    2. Location Data
                    Drivers: Continuous GPS tracking to monitor the trip route in real time.
                    Parents: Home location is used for routing purposes.
                    Purpose:
                    To facilitate navigation, tracking, and ensure accurate notifications.
                    3. Device Information
                    Device type, operating system, app version, and notification tokens.
                    Purpose:
                    This information helps optimize app performance and deliver notifications.
                    4. Communication Data
                    Messages and notifications sent via the app.
                    Purpose:
                    To enable communication between parents and drivers and to notify parents of trip progress.
                    5. Analytics Data
                    Aggregated app usage statistics to improve functionality and user experience.
                    Purpose:
                    To identify areas for improvement and to enhance the overall app experience.
                    Data Collection Practices and Security
                    Sayartech follows strict data privacy and security protocols to comply with global standards and the best practices required by app distribution platforms.:
                    Consent-Based Collection:
                    We collect user data only after obtaining explicit consent during account registration.
                    Users can review and agree to the app's privacy policy and terms of use before proceeding.
                    Data Storage and Encryption:
                    All personal and sensitive data is securely encrypted and stored in compliance with international data protection standards.
                    Limited Data Sharing:
                    Data is shared only with authorized parties (e.g., assigned drivers) and solely for service delivery purposes.
                    We do not sell or share data with third parties for marketing or advertising.
                    Data Retention Policy:
                    Data is retained only as long as necessary to fulfill its purpose.
                    Users can request data deletion at any time by contacting support.
                    Child Safety:
                    We prioritize the safety of children by ensuring that drivers undergo rigorous background checks before being onboarded.
                    How We Protect User Data
                    At Sayartech, user privacy is a top priority. We implement the following measures to protect data:
                    End-to-End Encryption: Ensures that sensitive data, such as location and personal information, is secure during transmission.
                    Authentication Protocols: Verifies user identity before granting access to the app.
                    Regular Security Audits: Our systems are regularly tested to ensure they are protected from potential vulnerabilities.
                    Compliance with Regulations: We adhere to all applicable local and international data privacy laws, including the GDPR and similar frameworks.
                    Transparency and User Rights
                    We are committed to transparency and empowering users to control their data:
                    Privacy Policy Access: Users can review the privacy policy at any time in the app’s settings.
                    Data Access and Control: Users can view, update, or delete their data through the app or by contacting customer support.
                    Notification Preferences: Users can manage notification settings directly from the app.
                    Contact Us
                    For questions or concerns about data privacy or how we handle your data, you can reach out to us at:
                    </Text>
                    <Text style={styles.privacy_policy_contact}>Email: sufiankamel404@gmail.com</Text>
                    <Text style={styles.privacy_policy_contact}>Phone: +964 771 420 0085</Text>
                    <Text style={styles.privacy_policy_text}>Sayartech is dedicated to creating a secure and seamless experience for parents and their children while maintaining the highest standards of data protection.</Text>
                    <View style={{flexDirection:'row',justifyContent:'space-around'}}>
                      <Text style={styles.privacy_policy_title}>I agree to the Privacy Policy</Text>
                      <Checkbox
                        style={styles.checkbox}
                        value={privacyAccepted}
                        onValueChange={(newValue) => setPrivacyAccepted(newValue)}
                        color={privacyAccepted ? '#16B1FF' : undefined}
                      />
                    </View>
                  </View>
                  <View style={{marginBottom:20}}>
                    <Text style={styles.privacy_policy_title}>Terms of Use for Sayartech</Text>
                    <Text style={styles.privacy_policy_text}>
                    Effective Date: November 26, 2024
                    Welcome to Sayartech!
                    These Terms of Use govern your use of the Sayartech mobile application (the "App") and related services provided by Sayartech. By accessing or using the App, you agree to these Terms of Use. If you do not agree to these terms, you may not use the App.
                    1. Overview of Our Services
                    Sayartech is a platform designed to connect parents with trusted, professional drivers specializing in transporting children to and from school. The App allows parents to:
                    Register their children, providing relevant details such as name, age, sex, school, and home location.
                    Book drivers for school transportation.
                    Track drivers in real-time and receive notifications about their child's journey.
                    2. Eligibility to Use the App
                    To use Sayartech:
                    You must be at least 18 years old.
                    If you are registering on behalf of a child, you must have the legal authority to do so.
                    You must provide accurate and complete information when creating an account.
                    3. Account Responsibilities
                    You are responsible for maintaining the confidentiality of your account login credentials.
                    You agree to notify Sayartech immediately if you suspect unauthorized access or use of your account.
                    Sayartech is not responsible for any loss resulting from unauthorized use of your account.
                    4. User Obligations
                    By using the App, you agree:
                    To provide accurate and up-to-date information about your children and yourself.
                    Not to misuse the App, including attempting to disrupt services, gain unauthorized access, or engage in illegal activities.
                    To respect the drivers and ensure clear communication during the transportation process.
                    5. Driver and Parent Conduct
                    Sayartech aims to maintain a safe and professional environment:
                    Parents are expected to ensure that children are ready for pickup on time.
                    Drivers are expected to follow all traffic laws and prioritize safety during journeys.
                    Inappropriate behavior, harassment, or misconduct from either party may result in account suspension or termination.
                    6. Booking and Payment
                    Parents can request services from registered drivers through the App.
                    Payments for transportation services must be made through approved methods in the App or as agreed upon with the driver.
                    7. Notifications and Tracking
                    The App provides real-time notifications and tracking features to enhance safety and convenience.
                    Notifications include alerts for when a driver is arriving at your home, when a child is dropped off at school, and when a child is returning home.
                    You agree to allow location data to be used for these purposes in compliance with our Privacy Policy.
                    8. Intellectual Property
                    All intellectual property rights in the App, including text, graphics, logos, and software, are owned by Sayartech or its licensors.
                    You may not copy, modify, distribute, or create derivative works based on the App without prior written consent.
                    9. Limitation of Liability
                    Sayartech strives to provide reliable services but does not guarantee uninterrupted access to the App.
                    Sayartech is not responsible for delays, cancellations, or issues caused by drivers or external circumstances (e.g., traffic, accidents).
                    In no event shall Sayartech be liable for indirect, incidental, or consequential damages arising from your use of the App.
                    10. Termination of Use
                    Sayartech reserves the right to suspend or terminate accounts at its discretion, including but not limited to cases of:
                    Misuse of the App.
                    Violations of these Terms of Use.
                    Complaints of misconduct from drivers or parents.
                    11. Data Collection and Privacy
                    Your use of the App is governed by our Privacy Policy, which explains how we collect, store, and use your data.
                    By agreeing to these Terms of Use, you also agree to the terms outlined in our Privacy Policy.
                    12. Changes to These Terms
                    Sayartech may update these Terms of Use periodically. Any changes will be effective upon posting in the App. Continued use of the App signifies your acceptance of updated terms.
                    13. Governing Law
                    These Terms of Use shall be governed by and construed in accordance with the laws of the Republic of Iraq.
                    14. Dispute Resolution
                    In the event of a dispute, users agree to first attempt to resolve the issue informally by contacting Sayartech support. If a resolution cannot be reached, disputes may be submitted to binding arbitration in accordance with local laws.
                    15. Contact Us
                    If you have questions about these Terms of Use or the App, please contact us at:
                    </Text>
                    <Text style={styles.privacy_policy_contact}>
                      Email: sufiankamel404@gmail.com
                    </Text>
                    <Text style={styles.privacy_policy_contact}>
                      Phone: +964 771 420 0085
                    </Text>  
                    <View style={{flexDirection:'row',justifyContent:'space-around'}}>
                      <Text style={styles.privacy_policy_title}>I agree to the Terms of Use</Text>
                      <Checkbox
                        style={styles.checkbox}
                        value={termsAccepted}
                        onValueChange={(newValue) => setTermsAccepted(newValue)}
                        color={termsAccepted ? '#16B1FF' : undefined}
                      />
                    </View>
                  </View>
                  </ScrollView>

                {/* Accept Button */}
                {privacyAccepted && termsAccepted && (
                  <TouchableOpacity
                    style={styles.accept_both_button}
                    onPress={handleAccept}
                  >
                    <Text style={styles.accept_both_button_text}>Accept</Text>
                  </TouchableOpacity>
                )}
                
              </View>
            </View>
          </Modal>

          <CustomeButton 
            title="تسجيل" 
            onPressHandler={onSignUpPress} 
            disabledStatus={!compteOwner ||!userName || !userFamilyName || !phone || isSigningUp || !privacyAccepted || !termsAccepted }
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
    paddingVertical:10,
    marginTop:10,
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
    height:30,
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
  privacy_modal_container:{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  privacy_terms_approve_btn:{
    width:290,
    height:50,
    marginBottom:20,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
    alignItems:'center',
    justifyContent:'space-between'
  },
  privacy_modal_box:{
    width: '90%',
    height:'90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  privacy_policy_title:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    textAlign:'center',
    marginBottom:10
  },
  privacy_policy_text:{
    fontFamily:'Cairo_400Regular',
    fontSize:13,
    textAlign:'center',
    marginBottom:10
  },
  privacy_policy_contact:{
    fontFamily:'Cairo_700Bold',
    fontSize:12,
    textAlign:'center',
    marginBottom:10
  },
  accept_both_button:{
    width:100,
    height:40,
    marginTop:10,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  accept_both_button_text:{
    fontFamily:'Cairo_700Bold',
    color:colors.WHITE,
    marginBottom:5
  }, 
  link_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:12,
    color:'#295F98',
    textAlign:'center'
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