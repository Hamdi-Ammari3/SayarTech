import React,{useState,useEffect,useRef} from 'react'
import { Text,View,StyleSheet,Image, Alert,ActivityIndicator,Platform,TouchableOpacity,TextInput,Modal,ScrollView,Keyboard,TouchableWithoutFeedback} from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import { useSignUp,useSignIn } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import colors from '../../constants/Colors'
import { Link } from 'expo-router'
import { addDoc, collection } from 'firebase/firestore'
import { DB } from '../../firebaseConfig'
import axios from 'axios'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import Checkbox from 'expo-checkbox'
import { Dropdown } from 'react-native-element-dropdown'
import logo from '../../assets/images/logo.jpeg'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import AntDesign from '@expo/vector-icons/AntDesign'


export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const { signIn } = useSignIn()
  const router = useRouter()
  const notificationListener = useRef()
  const responseListener = useRef()

  const TWILIO_SERVICE_SID = "";
  const TWILIO_ACCOUNT_SID = "";
  const TWILIO_AUTH_TOKEN = "";
  const TWILIO_API_URL = ``;
  const TWILIO_VERIFY_URL = ``;

  const [compteOwner,setCompteOwner] = useState('')
  const [userName,setUserName] = useState('')
  const [userFamilyName,setUserFamilyName] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [countryCode, setCountryCode] = useState('+964')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [timer, setTimer] = useState(60)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [expoPushToken, setExpoPushToken] = useState('')
  const [notification, setNotification] = useState(false)
  const [whatsapp,setWatsapp] = useState(true)
  const [sms,setSms] = useState(false)

  const HARDCODED_PASSWORD = "SecurePass123!";

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

  // Account owner type
  const compte_owner = [
    {label:'ولي أمر',value:'parent'},
    {label:'طالب',value:'student'},
    {label:'موظف',value:'employee'},
    {label:'سائق',value:'driver'}
  ]

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
          console.log('Failed to get push token for push notification...')
          return;
        }

        const token = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig.extra.eas.projectId,
        })

        await AsyncStorage.setItem('expoPushToken', token.data);
        return token.data
        //setExpoPushToken(token.data);
      } else {
        console.log('Must use physical device for Push Notifications...')
      }
    } catch (error) {
      console.log('Error registering for notifications:', error);
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

  // Open privacy terms
  const openPrivacyTermsModal = () => {
    if(privacyAccepted === false || termsAccepted === false) {
      setShowPrivacyModal(true);
    }
  }

  // Accept terms of use
  const handleAccept = () => {
    if (privacyAccepted && termsAccepted) {
      setShowPrivacyModal(false);
    }
  };

  const handleCompteOwner = (owner) => {
    setCompteOwner(owner)
  }

  // Check if User Exists Before Sending OTP
  const checkUserExists = async () => {
    try {
      const username = `user_${phone}`;

      // Try to sign in with a dummy password to check if the account exists
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
  }

  // Sign up button
  const onSignUpPress = async () => {
    if (!isLoaded || isSigningUp) return

    if(!expoPushToken) {
      createAlert('يرجى تفعيل خدمة الاشعارات لتتمكن من استخدام التطبيق')
      return;
    }

    if(!compteOwner) {
      createAlert('الرجاء تحديد نوع الحساب')
      return;
    }

    if(!userName) {
      createAlert('الرجاء ادخال الاسم')
      return;
    }

    if(!userFamilyName) {
      createAlert('الرجاء ادخال اللقب')
      return;
    }

    if(!phone) {
      createAlert('الرجاء ادخال رقم الهاتف')
      return;
    }

    if(!privacyAccepted) {
      createAlert('يجب الموافقة على سياسة الخصوصية قبل الدخول')
      return;
    }

    if(!termsAccepted) {
      createAlert('يجب الموافقة على شروط الاستخدام قبل الدخول')
      return;
    }

    setIsSigningUp(true)

    try {
      // Check if the user already exists
      const userExists = await checkUserExists();
      if (userExists === true) {
        createAlert("يوجد حساب مسجل بهذا الرقم! الرجاء استعمال رقم آخر");
        setIsSigningUp(false);
        return;
      } else if (userExists === "error") {
        createAlert("حدث خطأ أثناء التحقق من الحساب");
        setIsSigningUp(false);
        return;
      }

      // Send OTP only if user does not exist
      const otpResponse = await sendOTP();
      if (!otpResponse.success) {
        createAlert("فشل إرسال رمز التحقق، حاول مرة أخرى");
      }

    } catch (err) {
      createAlert("حدث خطأ أثناء التسجيل، حاول مرة أخرى");
    } finally{
      setIsSigningUp(false) // End Loading
    }
  }

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
      console.log(error)
      return { success: false, message: "Failed to send OTP" };
    }
  };

  // Verify code handler
  const onPressVerify = async () => {
    if (!isLoaded || isVerifying) return;

    if(!code) {
      createAlert('يرجى ادخال الكود')
      return;
    }
  
    setIsVerifying(true);
  
    try {
      // Verify OTP via Twilio
      const verificationResult = await verifyOTP(`${countryCode}${phone}`, code);
  
      if (!verificationResult.success) {
        createAlert("رمز التحقق غير صحيح");
        return;
      }
  
      // Create Clerk User
      const username = `user_${phone}`;
      const signUpAttempt = await signUp.create({
        identifier: username,
        password: HARDCODED_PASSWORD,
        username: username,
      });
  
      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
  
        //Save user data in Firestore
        await saveUserDataToFirestore(signUpAttempt.createdUserId);
  
        //Redirect user to the correct page
        if (compteOwner === 'parent') {
          router.replace('(main)/(parent)/(tabs)/home');
        } else if (compteOwner === 'student') {
          router.replace('(main)/(student)/(tabs)/home');
        } else if (compteOwner === 'employee') {
          router.replace('(main)/(employee)/(tabs)/home');
        } else if (compteOwner === 'driver') {
          router.replace('(main)/(driver)/(tabs)/home');
        }
      } else {
        createAlert('يوجد خلل الرجاء المحاولة مرة ثانية');
      }
    } catch (error) {
      createAlert('حدث خطأ أثناء التسجيل');
      console.log(error)
    } finally {
      setIsVerifying(false);
    }
  };
  
  // Save user data to Firestore
  const saveUserDataToFirestore = async (userId) => {
    try {
      const userInfoCollectionRef = collection(DB,'users')
      const userData = {
        user_id: userId,
        user_full_name: userName,
        user_family_name: userFamilyName,
        compte_owner_type:compteOwner,
        phone_number:`${countryCode} ${phone}`,
        user_notification_token: expoPushToken,
        user_privacy_policy:privacyAccepted,
        user_terms_of_use:termsAccepted,
        user_signup_data: new Date()
      }

      const docRef = await addDoc(userInfoCollectionRef,userData)

    } catch (error) {
      createAlert('يوجد خلل الرجاء المحاولة مرة ثانية')
    }
  }

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
      return { success: false, message: "Failed to verify OTP" };
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.form}>
      {!verifying ? (
        <>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.dropdownStyle}
            selectedTextStyle={styles.dropdownStyle}
            itemTextStyle={styles.dropdownTextStyle}
            data={compte_owner}
            labelField="label"
            valueField="value"
            placeholder= 'صاحب الحساب'
            value={compteOwner}
            onChange={item => {
              handleCompteOwner(item.value)
              }}
          />
          <TextInput
            style={styles.customeInput}
            value={userName}
            placeholder="الاسم الكامل"
            placeholderTextColor={colors.BLACK}
            onChangeText={(text) => setUserName(text)}
          />
          <TextInput
            style={styles.customeInput}
            value={userFamilyName}
            placeholder="اللقب"
            placeholderTextColor={colors.BLACK}
            onChangeText={(text) => setUserFamilyName(text)}
          />
          <View style={styles.input_with_picker}>
            <Dropdown
              style={styles.country_code_dropdown}
              placeholderStyle={styles.country_code_dropdownStyle}
              selectedTextStyle={styles.country_code_dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={countryCodeList}
              labelField="name"
              valueField="name"
              placeholder=""
              value={countryCode}
              onChange={item => handleCountryCode(item.name)}
            />
            <TextInput
              style={styles.phone_input}
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
          
          <TouchableOpacity style={styles.privacy_terms_approve_btn} onPress={openPrivacyTermsModal}>
            {privacyAccepted && termsAccepted ? (
              <FontAwesome6 name="square-check" size={24} color="#295F98" />
            ) : (
              <FontAwesome name="square-o" size={24} color="#295F98" />
            )}
            
            <Text style={styles.privacy_terms_approve_btn_text}> أوافق على سياسة الخصوصية وشروط الاستخدام</Text>
          </TouchableOpacity>
          <Modal 
            animationType="fade"
            transparent={true}
            visible={showPrivacyModal}
            onRequestClose={() => setShowPrivacyModal(false)}
          >
            <View style={styles.privacy_modal_box}>

              <View style={styles.privacy_policy_box}>
                <Text style={styles.privacy_policy_title}>Privacy Policy for Sayartech</Text>

                <View style={styles.privacy_policy_scrollview}>
                <ScrollView
                  vertical
                  showsVerticalScrollIndicator={true}
                >
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
                </ScrollView>
                </View>

                <View style={styles.privacy_policy_contact_box}>
                  <Text style={styles.privacy_policy_contact}>Email: sufiankamel404@gmail.com</Text>
                  <Text style={styles.privacy_policy_contact}>Phone: +964 771 420 0085</Text>
                  <Text style={styles.privacy_policy_text}>Sayartech is dedicated to creating a secure and seamless experience for parents and their children while maintaining the highest standards of data protection.                     
                  </Text>
                </View>

                <View style={styles.privacy_terms_check_box}>
                  <Text style={styles.privacy_terms_check_box_text}>I agree to the Privacy Policy</Text>
                  <Checkbox
                    style={styles.checkbox}
                    value={privacyAccepted}
                    onValueChange={(newValue) => setPrivacyAccepted(newValue)}
                    color={privacyAccepted ? '#16B1FF' : undefined}
                  />
                </View>

              </View>
                    
              <View style={styles.term_of_use_box}>
                <Text style={styles.privacy_policy_title}>Terms of Use for Sayartech</Text>

                <View style={styles.privacy_policy_scrollview}>
                <ScrollView               
                  vertical
                  showsVerticalScrollIndicator={true}
                >
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
                </ScrollView>
                </View>

                <View style={styles.term_of_use_contact_box}>
                  <Text style={styles.privacy_policy_contact}>Email: sufiankamel404@gmail.com</Text>
                  <Text style={styles.privacy_policy_contact}>Phone: +964 771 420 0085</Text> 
                </View>

                <View style={styles.privacy_terms_check_box}>
                  <Text style={styles.privacy_terms_check_box_text}>I agree to the Terms of Use</Text>
                  <Checkbox
                    style={styles.checkbox}
                    value={termsAccepted}
                    onValueChange={(newValue) => setTermsAccepted(newValue)}
                    color={termsAccepted ? '#16B1FF' : undefined}
                  />
                </View>

              </View>
              
                <View style={styles.privacy_terms_accept_btn_container}>      
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

          {isSigningUp ? (
            <TouchableOpacity style={styles.button}>
                <ActivityIndicator size='small' color={colors.WHITE} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={onSignUpPress}
              disabled={isSigningUp}
            >
              <View style={styles.btnView}>
                <Text style={styles.btntext}>تسجيل</Text>
              </View>
              
            </TouchableOpacity>
          )}
          
          <Link href={'/login'}>
            <Text style={styles.link_text}>لديك حساب بالفعل؟ ادخل الان</Text>
          </Link>
        </>
      ) : (
        <>
          <TextInput
            style={styles.customeInput}
            keyboardType='numeric'
            value={code} 
            placeholder="رمز التاكيد" 
            placeholderTextColor={colors.BLACK}
            onChangeText={(code) => setCode(code)} 
          />
          {isVerifying ? (
            <TouchableOpacity style={styles.button}>
                <ActivityIndicator size="small" color={colors.WHITE} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={onPressVerify}
              disabled={isVerifying}
            >
              <View style={styles.btnView}>
                <Text style={styles.btntext}>تاكيد</Text>
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
      )}
      </View>
      </TouchableWithoutFeedback>
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
  dropdown:{
    width:280,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    justifyContent:'center',
    alignItems:'center'
  },
  dropdownStyle:{
    height:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14,
    lineHeight:50
  },
  dropdownTextStyle:{
    textAlign:'center',
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
  country_code_dropdown:{
    width:80,
    height:50,
    backgroundColor:colors.PRIMARY,
    borderTopStartRadius:13,
    borderBottomStartRadius:13,
    justifyContent:'center',
    alignItems:'center'
  },
  country_code_dropdownStyle:{
    color:colors.WHITE,
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    fontSize:14,
    lineHeight:50
  },
  phone_input:{
    width:200,
    height:50,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
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
    height:30,
    fontFamily:'Cairo_700Bold',
    fontSize:12,
    color:'#295F98',
    textAlign:'center',
    verticalAlign:'middle',
  },
  rfCode_modal_container:{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  rfCode_modal_box:{
    width: 280,
    height:200,
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    justifyContent:'center'
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
  whatsapp_sms_container:{
    width:200,
    height:40,
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
  privacy_terms_approve_btn:{
    width:290,
    height:50,
    marginBottom:10,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
    alignItems:'center',
    justifyContent:'space-between',
  },
  privacy_terms_approve_btn_text:{
    lineHeight:50,
    fontFamily:'Cairo_700Bold',
    fontSize:12,
    color:'#295F98',
    textAlign:'center',
    verticalAlign:'middle',
  },
  privacy_modal_box:{
    flex:1,
    alignItems: 'center',
    justifyContent:'center',
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 20,
  },
  privacy_policy_box:{
    height:'52%',
    marginVertical:10,
  },
  term_of_use_box:{
    height:'41%',
  },
  privacy_policy_title:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    textAlign:'center',
  },
  privacy_policy_scrollview:{
    height:200,
    alignItems:'center',
    justifyContent:'center',
  },
  privacy_policy_contact_box:{
    height:130,
    marginTop:5,
    alignItems:'center',
    justifyContent:'center',
  },
  term_of_use_contact_box:{
    height:50,
    marginTop:5,
    alignItems:'center',
    justifyContent:'space-between',
  },
  privacy_policy_contact:{
    fontFamily:'Cairo_700Bold',
    fontSize:12,
    textAlign:'center',
    marginBottom:5,
  },
  privacy_policy_text:{
    fontFamily:'Cairo_400Regular',
    fontSize:13,
    textAlign:'center',
    marginBottom:5,
  },
  privacy_terms_check_box:{
    height:25,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  privacy_terms_check_box_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:13,
    textAlign:'center',
    marginRight:10,
  },
  privacy_terms_accept_btn_container:{
    width:290,
    height:50,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  accept_both_button:{
    width:100,
    height:40,
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
    textAlign:'center',
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

/*

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
  // Generate the user's referral code
  const newReferralCode = generateReferralCode(phone);
  setReferralCode(newReferralCode);


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


<TouchableOpacity style={styles.referralBtn} onPress={() => setShowReferralModal(true)}>
            <Text style={styles.referralBtnText}>هل تمت دعوتك من قبل صديق؟</Text>
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
                  placeholderTextColor={colors.BLACK}
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
*/