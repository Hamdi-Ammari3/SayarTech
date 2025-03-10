import { useState } from 'react'
import { Alert,StyleSheet, Text, View,FlatList,ActivityIndicator,TouchableOpacity,Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link,useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import StudentCard from '../../../../components/StudentCard'
import { useAuth,useUser } from '@clerk/clerk-expo'
import { deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRiderData } from '../../../stateManagment/RiderContext'

const profile = () => {
  const [signOutLoading,setSignOutLoading] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const { signOut } = useAuth()
  const {user} = useUser()
  const router = useRouter()

  const {userData,fetchingUserDataLoading,rider,fetchingRiderLoading} = useRiderData()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const handleSignOut = async () => {
    try {
      setSignOutLoading(true)
      await signOut();
      router.replace('/(auth)/login')
    } catch (error) {
      createAlert('Error signing out')
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

  //Loading user data
  if (fetchingRiderLoading || fetchingUserDataLoading || deleteAccountLoading || signOutLoading) {
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
      data={rider}
      renderItem={({item}) => <StudentCard item={item}/>}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.flatList_style}
      ListEmptyComponent={() => (
        <View style={styles.no_registered_students}>
          <Text style={styles.no_student_text}>الرجاء اضافة بياناتك الخاصة</Text>
          <Link href="/addData" style={styles.link_container}>
            <Text style={styles.link_text}>اضف الآن</Text>
          </Link>
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
    justifyContent:'space-around',
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
  },
  user_info_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:14,
    color:colors.WHITE,
    lineHeight:50,
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
  flatList_style:{
    marginTop:100,
    paddingBottom:40,
  },
  no_registered_students: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop:75
  },
  no_student_text: {
    fontFamily: 'Cairo_400Regular',
  },
  link_container: {
    backgroundColor: colors.PRIMARY,
    padding: 15,
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  spinner_error_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  }
})
