import { useState,useRef } from 'react'
import { Alert,StyleSheet,Text,View,FlatList,ActivityIndicator,TouchableOpacity,Linking,Modal,Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useAuth,useUser } from '@clerk/clerk-expo'
import { deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import dayjs from "dayjs"
import LottieView from "lottie-react-native"
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useDriverData } from '../../../stateManagment/DriverContext'
import AssignedRiders from '../../../../components/AssignedRiders'
import AntDesign from '@expo/vector-icons/AntDesign'
import Ionicons from '@expo/vector-icons/Ionicons'
import driverWaiting from '../../../../assets/animations/waiting_driver.json'

const profile = () => {
  const {userData,fetchingUserDataLoading,driverData,fetchingDriverDataLoading} = useDriverData()

  const [menuVisible, setMenuVisible] = useState(false)
  const [signOutLoading,setSignOutLoading] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [showLineDataModal,setShowLineDataModal] = useState(false)
  const [selectedLine, setSelectedLine] = useState(null)

  const slideAnim = useRef(new Animated.Value(-250)).current; // Animation for side menu

  const { signOut } = useAuth()
  const {user} = useUser()
  const router = useRouter()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  // Function to toggle the menu
  const toggleMenu = () => {
    if (menuVisible) {
      Animated.timing(slideAnim, {
        toValue: -250, // Hide the menu
        duration: 300,
        useNativeDriver: false,
      }).start(() => setMenuVisible(false));
    } else {
      setMenuVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0, // Show the menu
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }

  // Sign-out handler
  const handleSignOut = async () => {
    try {
      setSignOutLoading(true)
      await signOut();
      router.replace('/(auth)/login')
    } catch (error) {
      createAlert('حدث خطأ أثناء تسجيل الخروج')
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
  
  // Delete account handler
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

  const handleLinePress = (line) => {
    setShowLineDataModal(true)
    setSelectedLine(line)
  };

  const closeLineInfoModal = () => {
    setShowLineDataModal(false)
    setSelectedLine(null)
  }

  // Loading or fetching user type state
  if (fetchingUserDataLoading || fetchingDriverDataLoading || deleteAccountLoading || signOutLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section  */}
      <View style={styles.user_info}>
        <Text style={styles.user_info_text}>{userData.user_full_name}</Text>
        <TouchableOpacity onPress={toggleMenu} style={styles.menu_button}>
          <Ionicons name="menu-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Side Menu Drawer */}
      {menuVisible && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={toggleMenu}
        />
      )}
      <Animated.View style={[styles.side_menu, { left: slideAnim }]}>
        <View style={styles.side_menu_container}>
        <Text style={styles.user_phone_number}>{userData.phone_number}</Text>
        <TouchableOpacity style={styles.logout_button} onPress={handleSignOut}>
          <SimpleLineIcons name="logout" size={20} color="white" />
          <Text style={styles.logout_button_text}>خروج</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.delete_button} onPress={confirmDeleteAccount}>
          <MaterialIcons name="delete-outline" size={24} color="white" />
          <Text style={styles.delete_text}>مسح الحساب</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.privacy_button} onPress={openPrivacyPolicy}>
          <Text style={styles.privacy_button_text}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.privacy_button} onPress={openTermsOfUse}>
          <Text style={styles.privacy_button_text}>Terms of Use</Text>
        </TouchableOpacity>
        </View>
      </Animated.View>

      <FlatList
        data={driverData[0]?.line}
        renderItem={({ item }) => {
          const isSubstituteDriver = item.original_driver && item.active_periode;
          const isOriginalDriver = item.subs_driver && item.desactive_periode;
    
          const activeStart = isSubstituteDriver ? new Date(item.active_periode.start.seconds * 1000).toLocaleDateString("ar-EG") : null;
          const activeEnd = isSubstituteDriver ? new Date(item.active_periode.end.seconds * 1000).toLocaleDateString("ar-EG") : null;
    
          const desactiveStart = isOriginalDriver ? new Date(item.desactive_periode.start.seconds * 1000).toLocaleDateString("ar-EG") : null;
          const desactiveEnd = isOriginalDriver ? new Date(item.desactive_periode.end.seconds * 1000).toLocaleDateString("ar-EG") : null;

          return(
            <TouchableOpacity style={styles.line_item} onPress={() => handleLinePress(item)}>
              <Text style={styles.line_name}>{item?.lineName} {isSubstituteDriver ? " - مؤقت" : ""}</Text>

              {/* Show active period if the driver is handling a temporary line */}
              {isSubstituteDriver && (
                <Text style={styles.line_name}>من {activeStart} الى {activeEnd}</Text>
              )}

              {/* Show message if the original driver is inactive and another driver is handling the line */}
              {isOriginalDriver && (
                <>
                  <Text style={styles.line_name}>سيتم تسليم هذا الخط لسائق آخر خلال الفترة</Text>
                  <Text style={styles.line_name}>من {desactiveStart} الى {desactiveEnd}</Text>
                </>
                
              )}

              <Text style={styles.line_name}>{item?.line_destination}</Text>
              <Text style={styles.line_name}>{item?.riders?.length}  طلاب</Text>
              <View style={styles.line_startTime_container}>   
                {item.lineTimeTable.map(li => (
                  <View key={li.dayIndex} style={styles.line_startTime_day}>
                    <Text style={styles.line_startTime_name}>{li?.arabic_day}</Text>
                    <Text style={styles.line_startTime_name}>
                      {li.active ? dayjs(li?.startTime?.toDate()).format("HH:mm") : "--"}                  
                    </Text>
                  </View>              
                ))}
              </View>
            </TouchableOpacity>
          )
          
        }}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.flatList_style}
        ListEmptyComponent={() => (
          <View style={styles.add_your_data_container}>
            <View style={styles.animation_container}>
              <LottieView
                source={driverWaiting}
                autoPlay
                loop
                style={{ width: 150, height: 150}}
              />
            </View>
            <View style={styles.no_assigned_students_box}>
              <Text style={styles.no_student_text}>
                {
                  driverData.length ? 'جاري ربط حسابك بركاب' : 'الرجاء اضافة بياناتك حتى نتمكن من ربط حسابك بركاب'
                }
              </Text>
            </View>
          </View>
        )}
      />
      {/* Modal for displaying students */}
      {selectedLine && (
        <Modal
         animationType="fade"
          transparent={true} 
          visible={showLineDataModal} 
          onRequestClose={() => setShowLineDataModal(false)}
        >
          <View style={styles.modal_container}>
            <View style={styles.modal_box}>
              <View style={styles.modal_header}>
                <TouchableOpacity onPress={closeLineInfoModal}>
                  <AntDesign name="closecircleo" size={24} color="gray" />
                </TouchableOpacity>
                <Text style={styles.modal_title}>{selectedLine.lineName}</Text>
              </View>
              <FlatList
                data={selectedLine.riders}
                renderItem={({ item }) => <AssignedRiders item={item} />}
                keyExtractor={(item) => item.id}
              />
            </View>
          </View>
        </Modal>
      )}
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
  user_info:{
    width:350,
    height:50,
    borderRadius:15,
    marginVertical:15,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-around',
    backgroundColor:colors.PRIMARY,
  },
  user_info_text:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    color:colors.WHITE,
  },
  side_menu: {
    position: "absolute",
    top: 40,
    left: -250,
    width: 250,
    height: "92%",
    backgroundColor: colors.GRAY,
    paddingTop: 50,
    paddingHorizontal: 20,
    zIndex: 10,
    borderRadius:15,
  },
  menu_item: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  menu_text: {
    color: "white",
    fontSize: 16,
    marginLeft: 10,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 5,
  },
  side_menu_container:{
    width:200,
    alignItems:'center',
  },
  user_phone_number:{
    fontFamily:'Cairo_700Bold',
    fontSize:14,
    color:colors.BLACK,
    marginBottom:30,
  },
  logout_button:{
    width:130,
    height:40,
    marginBottom:15,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  logout_button_text:{
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    marginLeft:10,
    verticalAlign:'middle',
    color:colors.WHITE,
  },
  delete_button:{
    width:130,
    height:40,
    marginBottom:15,
    backgroundColor:'#d11a2a',
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  delete_text:{
    color:colors.WHITE,
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    marginLeft:7,
    verticalAlign:'middle',
  },
  privacy_button:{
    width:130,
    height:40,
    marginBottom:15,
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  privacy_button_text:{
    color:colors.BLACK,
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    verticalAlign:'middle',
  },
  line_item:{
    width:350,
    minHeight:200,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    marginBottom:10,
    alignItems:'center',
    justifyContent:'space-around'
  },
  line_name:{
    height:25,
    lineHeight:25,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  line_startTime_container:{
    flexDirection:'row-reverse',
  },
  line_startTime_day:{
    alignItems:'center',
    marginHorizontal:2,
    width:45,
  },
  line_startTime_name:{
    fontFamily:'Cairo_400Regular',
    fontSize:13,
    color:colors.WHITE,
  },
  flatList_style:{
    marginTop:20,
    paddingBottom:40,
  },
  add_your_data_container:{
    width:350,
    height:250,
    backgroundColor:colors.GRAY,
    borderRadius:15,
    alignItems:'center',
  },
  animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  no_assigned_students_box:{
    width:'100%',
    justifyContent:'center',
    alignItems:'center',
  },
  no_student_text: {
    fontFamily: 'Cairo_400Regular',
    color:colors.BLACK,
    textAlign:'center',
  },
  spinner_error_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  },
  modal_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_box:{
    width: '95%',
    height:'80%',
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  modal_header:{
    width:'100%',
    height:40,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    marginBottom:10
  },
  modal_title:{
    height:40,
    verticalAlign:'middle',
    fontFamily:'Cairo_700Bold',
    fontSize:18,
    marginLeft:10,
  },
})

/*
data={driverData[0]?.line.filter(line => {
          const iraqiTodayDate = new Date().toLocaleDateString("fr-CA", { timeZone: "Asia/Baghdad" });
      
          // If the driver is a substitute driver, only show the line during the active period
          if (line.original_driver && line.active_periode) {
            const { start, end } = line.active_periode;
            const startDate = new Date(start.seconds * 1000).toISOString().split("T")[0];
            const endDate = new Date(end.seconds * 1000).toISOString().split("T")[0];
      
            return iraqiTodayDate >= startDate && iraqiTodayDate <= endDate;
          }
      
          return true; // Show other lines normally
        })}
*/