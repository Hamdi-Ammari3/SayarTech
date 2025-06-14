import { StyleSheet,Text,View,ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import LottieView from "lottie-react-native"
import { useRiderData } from '../../../stateManagment/RiderContext'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'
import addDataAnimation from '../../../../assets/animations/adding_data.json'
import RiderLineStatus from '../../../../components/RiderLineStatus'

const lines = () => {
  const {userData,fetchingUserDataLoading,rider,fetchingRiderLoading} = useRiderData()
  const router = useRouter()
  const [selectedRider,setSelectedRider] = useState(0)

  //Redirect to add data screen
  const redirectToAddDataPage = () => {
    router.push({
      pathname:"/addNewRider",
      params: {
        riderFamily:userData.user_family_name,
        riderUserId:userData.user_id,
        riderPhone:userData.phone_number,
        riderNotification:userData.user_notification_token,
      }
    })
  }

  // Format the name to only the first word
  const getFirstWord = (text) => {
    if (!text) return '';
    return text.trim().split(/\s+/)[0];
  };
  
  // Wait untill data load
  if (fetchingRiderLoading || fetchingUserDataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  // if the user have no registered riders yet
  if(!rider.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.add_your_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.animation_container}>
            <LottieView
              source={addDataAnimation}
              autoPlay
              loop
              style={{ width: 200, height: 200}}
            />
          </View>
          <View style={styles.add_your_data_text_container}>
            <Text style={styles.add_your_data_text}>لا يوجد ركاب في حسابك</Text>
            <TouchableOpacity style={styles.add_data_button} onPress={redirectToAddDataPage}>
              <Text style={styles.add_data_button_text}>اضف الآن</Text>
            </TouchableOpacity>
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
          {rider.map((rider,index) => (
           <TouchableOpacity
              key={index}
              style={[
                styles.student_name_button,
                selectedRider === index && styles.active_student_name_button,
              ]}
              onPress={() => setSelectedRider(index)}
            >
              <Text style={[
                styles.student_name_button_text,
                selectedRider === index && styles.active_student_name_button_text,
                ]}
              >
                {getFirstWord(rider.full_name)}
              </Text>
            </TouchableOpacity>
          ))}          
        </ScrollView>
      </View>
      <View style={styles.student_info_container}>
        {rider[selectedRider] && (
          <RiderLineStatus rider={rider[selectedRider]}/>
        )}
      </View>
   </SafeAreaView>
  )}

export default lines;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  add_your_data_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  logo:{
    width:'100%',
    height:200,
    alignItems:'center',
    justifyContent:'center',
  },
  logo_image:{
    height:180,
    width:180,
    resizeMode:'contain',
  },
  animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
    marginTop:25,
  },
  add_your_data_text_container:{
    width:'100%',
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  add_your_data_text:{
    fontFamily: 'Cairo_400Regular',
  },
  add_data_button:{
    width:110,
    height:40,
    marginTop:20,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius: 15,
  },
  add_data_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 35,
  },
  scrollViewContainer:{
    height:60,
    width:'100%',
    position:'absolute',
    top:30,
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
    minWidth:110,
    height:40,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
    marginHorizontal: 5
  },
  student_name_button_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    lineHeight:40,
  },
  active_student_name_button:{
    //backgroundColor:colors.PRIMARY,
    //borderColor:colors.PRIMARY,
    backgroundColor:colors.BLUE,
    borderColor:colors.BLUE,
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