import { Alert,View,ActivityIndicator,StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useState,useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo'
import { collection, getDocs,query,where } from 'firebase/firestore'
import {DB} from '../firebaseConfig'
import colors from '../constants/Colors'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'

const index = () => {

  const { isSignedIn,userId } = useAuth()
  const [userType,setUserType] = useState('')
  const [fetchingUserType, setFetchingUserType] = useState(true)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Fetch the user type from Firestore
  useEffect(() => {
    const fetchUserType = async () => {
      if (isSignedIn) {
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
          createAlert('حدث خطأ أثناء جلب بيانات المستخدم')
        } finally {
          setFetchingUserType(false) // Set loading state to false
        }
      } else {
        setFetchingUserType(false)
      }
    }

    fetchUserType()
  }, [])


  // Loading or fetching user type state
    if (fetchingUserType) {
      return (
        <>
        <StatusBar style="auto"/>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
        </>
      )
    }

    if(!isSignedIn) {
      return <Redirect href={'/(auth)/welcome'}/>
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
}

const styles = StyleSheet.create({
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
})

export default index