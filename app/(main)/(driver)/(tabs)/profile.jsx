import { useState } from 'react'
import { Alert,StyleSheet, Text, View,FlatList,ActivityIndicator,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useAuth,useUser } from '@clerk/clerk-expo'
import { deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useDriverData } from '../../../stateManagment/DriverContext'
import AssignedStudents from '../../../../components/AssignedStudents'

const profile = () => {
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const { signOut } = useAuth()
  const {user} = useUser()
  const router = useRouter()

  const {userData,fetchingUserDataLoading,assignedStudents} = useDriverData()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login')
    } catch (error) {
      createAlert('حدث خطأ أثناء تسجيل الخروج')
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

  // Loading or fetching user type state
  if (fetchingUserDataLoading || deleteAccountLoading) {
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
            <Text style={styles.logout_text}>خروج</Text>
            <SimpleLineIcons name="logout" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.delete_button} onPress={confirmDeleteAccount}>
            <Text style={styles.delete_text}>مسح الحساب</Text>
            <MaterialIcons name="delete-outline" size={24} color="#898989" />
          </TouchableOpacity>
        </View>

      </View>
      <FlatList
        data={assignedStudents}
        renderItem={({item}) => <AssignedStudents item={item}/>}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.flatList_style}
        ListEmptyComponent={() => (
          <View style={styles.no_registered_students}>
            <Text style={styles.no_student_text}>ليس لديك طلاب في حسابك بعد</Text>
          </View>
        )}
        />
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
    paddingTop:20,
    marginVertical:30,
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
    marginBottom:10
  },
  user_info_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:14,
    color:colors.WHITE
  },
  button_container:{
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    width:340,
    height:60,
    marginBottom:10
  },
  logout_button:{
    width:140,
    height:50,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  logout_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    color:colors.WHITE,
    marginRight:10
  },
  delete_button:{
    width:140,
    height:50,
    borderColor:'#DAD9D8',
    borderWidth:1,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  delete_text:{
    color:'#898989',
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    marginRight:10
  },
  flatList_style:{
    marginTop:30,
    paddingBottom:40,
  },
  no_registered_students: {
    height:100,
    width:350,
    marginTop:95,
    backgroundColor:'#F6F8FA',
    borderRadius:15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_student_text: {
    fontFamily: 'Cairo_400Regular',
  },
  spinner_error_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  },
  error_text:{
    fontFamily:'Cairo_400Regular',
    fontSize:16,
    color:'darkred'
  },
})

