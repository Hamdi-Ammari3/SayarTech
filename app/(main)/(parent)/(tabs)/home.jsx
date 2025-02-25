import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser } from '@clerk/clerk-expo'
import { useState,useEffect } from 'react'
import { Link } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useRiderData } from '../../../stateManagment/RiderContext'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpeg'
import StudentHomePage from '../../../../components/StudentHomePage'

const home = () => {
  const { isLoaded } = useUser()
  const {rider,fetchingRiderLoading} = useRiderData()
  const [selectedStudent,setSelectedStudent] = useState(0)

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });
    return () => subscription.remove();
  }, []);
  
  // Wait untill data load
  if (fetchingRiderLoading || !isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  // if the user have no registered students yet
  if(!rider.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.no_registered_students_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.no_registered_students}>
            <Text style={styles.no_student_text}>ليس لديك طلاب مسجلين بالتطبيق</Text>
            <Link href="/addData" style={styles.link_container}>
              <Text style={styles.link_text}>اضف الآن</Text>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>
      <View style={styles.scrollViewContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.student_name_buttons_container}
        >
          {rider.map((student,index) => (
           <TouchableOpacity
              key={index}
              style={[
               styles.student_name_button,
                selectedStudent === index && styles.active_student_name_button,
              ]}
              onPress={() => setSelectedStudent(index)}
            >
              <Text style={[
                styles.student_name_button_text,
                selectedStudent === index && styles.active_student_name_button_text,
                ]}
              >
                {student.full_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.student_info_container}>
        {rider[selectedStudent] && (
          <StudentHomePage student={rider[selectedStudent]} selectedStudent={selectedStudent}/>
        )}
      </View>
   </SafeAreaView>
  )}

export default home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  no_registered_students_container:{
    height:400,
    paddingTop:30,
    alignItems:'center',
    justifyContent:'space-between',
  },
  logo:{
    width:'100%',
    height:150,
    justifyContent:'center',
    alignItems:'center',
  },
  logo_image:{
    height:120,
    width:120,
    resizeMode:'contain',
  },
  no_registered_students: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_student_text: {
    fontFamily: 'Cairo_400Regular',
  },
  link_container: {
    backgroundColor: colors.PRIMARY,
    width:100,
    height:50,
    textAlign:'center',
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    lineHeight:50,
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  scrollViewContainer:{
    height:60,
    width:'100%',
    position:'absolute',
    top:40,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center',
  },
  student_name_buttons_container:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
  },
  student_name_button:{
    backgroundColor:colors.WHITE,
    borderColor:'#ddd',
    borderWidth:1,
    minWidth:150,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
    marginHorizontal: 5
  },
  student_name_button_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
  },
  active_student_name_button:{
    backgroundColor:colors.PRIMARY,
    borderColor:colors.PRIMARY,
  },
  active_student_name_button_text:{
    color:colors.WHITE,
    fontFamily: 'Cairo_700Bold',
  },
  student_info_container:{
    flex:1,
    alignItems:'center',
    justifyContent:'center',
    position:'relative',
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
})