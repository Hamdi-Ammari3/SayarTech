import { useState } from 'react'
import { Alert,StyleSheet, Text, View,FlatList,ActivityIndicator,TouchableOpacity,Linking,Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useAuth,useUser } from '@clerk/clerk-expo'
import { deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import dayjs from "dayjs"
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useDriverData } from '../../../stateManagment/DriverContext'
import AssignedRiders from '../../../../components/AssignedRiders'
import AntDesign from '@expo/vector-icons/AntDesign'

const profile = () => {
  const {userData,fetchingUserDataLoading,driverData,fetchingDriverDataLoading} = useDriverData()

  const [signOutLoading,setSignOutLoading] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [showLineDataModal,setShowLineDataModal] = useState(false)
  const [selectedLine, setSelectedLine] = useState(null)

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
      <View style={styles.header}>
        <View style={styles.user_info}>
          <Text style={styles.user_info_text}>{userData.user_full_name}</Text>
          <Text style={styles.user_info_text}>{userData.phone_number}</Text>
        </View>

        <View style={styles.button_container}>
          <TouchableOpacity style={styles.logout_button} onPress={handleSignOut}>
            <Text style={styles.logout_button_text}>خروج</Text>
            <SimpleLineIcons name="logout" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.delete_button} onPress={confirmDeleteAccount}>
            <Text style={styles.delete_text}>مسح الحساب</Text>
            <MaterialIcons name="delete-outline" size={24} color="#898989" />
          </TouchableOpacity>
        </View>

        <View style={styles.privacy_button_container}>
          <TouchableOpacity style={styles.privacy_button} onPress={openPrivacyPolicy}>
            <Text style={styles.privacy_button_text}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.privacy_button} onPress={openTermsOfUse}>
            <Text style={styles.privacy_button_text}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={driverData[0]?.line}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.line_item} onPress={() => handleLinePress(item)}>
            <Text style={styles.line_name}>{item?.lineName}</Text>
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
        )}
        keyExtractor={item => item.lineName}
        contentContainerStyle={styles.flatList_style}
        ListEmptyComponent={() => (
          <View style={styles.no_registered_students}>
            <Text style={styles.no_student_text}>ليس لديك خطوط في حسابك</Text>
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
  header:{
    justifyContent:'center',
    alignItems:'center',
    marginVertical:15,
    borderRadius:15,
  },
  user_info:{
    width:340,
    height:50,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-around',
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    marginBottom:0
  },
  user_info_text:{
    lineHeight:50,
    fontFamily:'Cairo_700Bold',
    fontSize:14,
    color:colors.WHITE
  },
  button_container:{
    width:340,
    height:40,
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    alignItems:'center',
    marginVertical:7,
  },
  logout_button:{
    width:130,
    height:40,
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
    marginRight:10,
    verticalAlign:'middle',
    color:colors.WHITE,
  },
  delete_button:{
    width:130,
    height:40,
    borderColor:'#DAD9D8',
    borderWidth:1,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  delete_text:{
    color:'#898989',
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    marginRight:10,
    verticalAlign:'middle',
  },
  privacy_button_container:{
    width:340,
    height:35,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-around',
  },
  privacy_button:{
    width:120,
    height:35,
    backgroundColor:'#F6F8FA',
    borderRadius:7,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  privacy_button_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    lineHeight:35,
  },
  line_item:{
    width:350,
    height:160,
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
    marginTop:50,
    paddingBottom:40,
  },
  no_registered_students: {
    height:50,
    width:300,
    marginTop:95,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_student_text: {
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
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