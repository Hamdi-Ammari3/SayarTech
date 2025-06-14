import { useState } from 'react'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,Linking,Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useAuth,useUser } from '@clerk/clerk-expo'
import { deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import { useDriverData } from '../../../stateManagment/DriverContext'
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import Ionicons from '@expo/vector-icons/Ionicons'
import AntDesign from '@expo/vector-icons/AntDesign'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import Fontisto from '@expo/vector-icons/Fontisto'

const profile = () => {
  const {userData,fetchingUserDataLoading} = useDriverData()

  const [openUpPersonalInfo,setOpenUpPersonalInfo] = useState(false)
  const [openUpCustomerSupport,setOpenUpCustomerSupport] = useState(false)
  const [signOutLoading,setSignOutLoading] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)

  const { signOut } = useAuth()
  const {user} = useUser()
  const router = useRouter()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const handleSignOut = async () => {
    try {
      setSignOutLoading(true)
      await signOut();
      router.replace('/(auth)/login')
    } catch (error) {
      createAlert('خطأ أثناء تسجيل الخروج')
    } finally {
      setSignOutLoading(false)
    }
  };

  // Ask users first if they really want to delete their account
  const confirmDeleteAccount = () => {
    Alert.alert(
      'تاكيد مسح الحساب', // Title
      'هل ترغب فعلا في مسح حسابك', // Message
      [
        {
          text: 'الغاء',
          style: 'cancel', // Cancels the alert
        },
        {
          text: 'تاكيد', // If the user confirms, proceed with deletion
          style: 'destructive', // Styling to indicate it's a destructive action
          onPress: handleDeleteAccount, // Call the delete function if user confirms
        },
      ],
      { cancelable: true } // Allow dismissal by tapping outside
    );
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteAccountLoading(true);
      // Step 1: Delete user from Clerk
      await user.delete(); // Deletes the current user from Clerk

      // Step 2: Delete user data from Firebase Firestore
      const userInfoCollectionRef = collection(DB, 'users');
      const q = query(userInfoCollectionRef, where('user_id', '==', user.id));
      const userDocs = await getDocs(q);

      if (!userDocs.empty) {
        // Deleting all user's related data
        const userDocRef = userDocs.docs[0].ref;
        await deleteDoc(userDocRef);
      }

      // Step 3: Log out user and redirect
      await signOut();
      router.replace('/welcome'); // Redirect to login or another screen

      createAlert('تم مسح حسابك بنجاح');
    } catch (error) {
      console.error('Error deleting account:', error);
      createAlert('حدث خطأ أثناء مسح الحساب');
    }finally{
      setDeleteAccountLoading(false);
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://sayartech.com/privacy-policy');
  };
  
  const openTermsOfUse = () => {
    Linking.openURL('https://sayartech.com/terms-of-use');
  };

  const userTypeArabic = (riderType) => {
    if(riderType === 'rider') {
      return 'راكب'
    } else if (riderType === 'driver') {
      return 'سائق'
    }
  }

  //Loading 
  if (fetchingUserDataLoading || deleteAccountLoading || signOutLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    );
  }

   return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profile_header}>
        <Text style={styles.profile_header_text}>{userData.user_full_name} {userData.user_family_name}</Text>
      </View>
      <View style={styles.profile_main}>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={() => setOpenUpPersonalInfo(true)}>
          <Text style={styles.profile_main_box_button_text}>المعلومات الشخصية</Text>
          <FontAwesome5 name="user" size={20} color="black" />
        </TouchableOpacity>
        <Modal
          animationType="fade"
          transparent={true}
          visible={openUpPersonalInfo}
          onRequestClose={() => setOpenUpPersonalInfo(false)}
        >
          <View style={styles.personal_info_container}> 
            <View style={styles.personal_info_box}>
              <View style={styles.personal_info_box_header}>
                <Text style={styles.personal_info_box_header_text}>المعلومات الشخصية</Text>
                <TouchableOpacity onPress={() => setOpenUpPersonalInfo(false)}>
                  <AntDesign name="closecircleo" size={20} color="black" />
                </TouchableOpacity>
              </View>
              <View style={styles.personal_info_box_main}>
                <View style={styles.personal_info_box_main_box}>
                  <Text style={styles.personal_info_box_main_box_text}>الاسم و اللقب:</Text>
                  <Text style={styles.personal_info_box_main_box_text}>{userData?.user_full_name} {userData?.user_family_name}</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <Text style={styles.personal_info_box_main_box_text}>نوع الحساب:</Text>
                  <Text style={styles.profile_main_box_button_text}>{userTypeArabic(userData?.compte_owner_type)}</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <Text style={styles.personal_info_box_main_box_text}>رقم الهاتف:</Text>
                  <Text style={styles.profile_main_box_button_text}>{userData?.phone_number}</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={() => setOpenUpCustomerSupport(true)}>
          <Text style={styles.profile_main_box_button_text}>خدمة العملاء</Text>
          <Ionicons name="help-buoy-outline" size={24} color="black" />
        </TouchableOpacity>
        <Modal
          animationType="fade"
          transparent={true}
          visible={openUpCustomerSupport}
          onRequestClose={() => setOpenUpCustomerSupport(false)}
        >
          <View style={styles.personal_info_container}> 
            <View style={styles.personal_info_box}>
              <View style={styles.personal_info_box_header}>
                <Text style={styles.personal_info_box_header_text}>تواصل معنا</Text>
                <TouchableOpacity onPress={() => setOpenUpCustomerSupport(false)}>
                  <AntDesign name="closecircleo" size={20} color="black" />
                </TouchableOpacity>
              </View>
              <View style={styles.personal_info_box_main}>
                <View style={styles.personal_info_box_main_box}>
                  <FontAwesome name="whatsapp" size={24} color="black" />
                  <Text style={styles.personal_info_box_main_box_text}>+964 771 420 0085</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <Fontisto name="email" size={24} color="black" />
                  <Text style={styles.profile_main_box_button_text}>support@sayartech.com</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <SimpleLineIcons name="location-pin" size={24} color="black" />
                  <Text style={styles.profile_main_box_button_text}>الفلوجة - الانبار - العراق</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={openPrivacyPolicy}>
          <Text style={styles.profile_main_box_button_text}>سياسة الخصوصية</Text>
          <AntDesign name="Safety" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={openTermsOfUse}>
          <Text style={styles.profile_main_box_button_text}>شروط الاستخدام</Text>
          <AntDesign name="profile" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={handleSignOut}>
          <Text style={styles.profile_main_box_button_text}>تسجيل الخروج</Text>
          <MaterialIcons name="logout" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={confirmDeleteAccount}>
          <Text style={styles.profile_main_box_button_text}>حذف الحساب</Text>
          <Ionicons name="trash-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
export default profile

const styles = StyleSheet.create({
  container:{
    flex:1,
    alignItems:'center',
    backgroundColor: colors.WHITE,
  },  
  profile_header:{
    width:350,
    marginVertical:30,
  },
  profile_header_text:{
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 40,
    textAlign: 'center',
  },
  profile_main:{
    marginTop:80
  },
  profile_main_box_button:{
    width:300,
    height:70,
    flexDirection:'row',
    justifyContent:'flex-end',
    alignItems:'center',
    gap:10,
    borderBottomColor:colors.GRAY,
    borderBottomWidth:1,
  },
  profile_main_box_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 50,
  },
  personal_info_container:{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  personal_info_box:{
    width: '90%',
    height:450,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical:10,
    alignItems: 'center',
  },
  personal_info_box_header:{
    height:50,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:10,
  },
  personal_info_box_header_text:{
    fontFamily: 'Cairo_700Bold',
    lineHeight: 50,
    textAlign: 'center',
  },
  personal_info_box_main:{
    marginTop:50,
    alignItems:'center',
    justifyContent:'center',
  },
  personal_info_box_main_box:{
    width:300,
    height:70,
    flexDirection:'row-reverse',
    justifyContent:'flex-start',
    alignItems:'center',
    gap:10,
    borderBottomColor:colors.GRAY,
    borderBottomWidth:1,
  },
  personal_info_box_main_box_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 50,
  },
  spinner_error_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  }
})
