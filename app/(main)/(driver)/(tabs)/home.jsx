import { useState } from 'react'
import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { useDriverData } from '../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpeg'
import LinePage from '../../../../components/LinePage'

const Home = () => {
  const {driverData,fetchingDriverDataLoading} = useDriverData()
  const { isLoaded } = useUser()
  const [selectedLine,setSelectedLine] = useState(0)


  //Loading State
  if( fetchingDriverDataLoading  || !isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    )
  }
  
  // if the driver haven't yet registered his info
  if(!driverData?.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.no_registered_students_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.no_registered_students}>
            <Text style={styles.no_student_text}>الرجاء اضافة بياناتك الخاصة</Text>
            <Link href="/addData" style={styles.link_container}>
              <Text style={styles.link_text}>اضف الآن</Text>
            </Link>
          </View>
        </View>        
      </SafeAreaView>
    )
  }
  
  //if the driver have no assigned students
  if(driverData?.length > 0 && driverData[0].line.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.no_registered_students_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.no_assigned_students_box}>
            <Text style={styles.no_student_text}>ليس لديك خطوط في حسابك</Text>
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
          contentContainerStyle={styles.line_name_buttons_container}
        >
          {driverData[0].line.map((li,index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.line_name_button,
                selectedLine === index && styles.active_line_name_button, // Apply active style if selected
              ]}
              onPress={() => setSelectedLine(index)}
            >
              <Text
                style={[
                  styles.line_name_button_text,
                  selectedLine === index && styles.active_line_name_button_text, // Apply active text style if selected
                ]}
              >
                {li.lineName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.student_info_container}>
        {driverData[0].line[selectedLine] && (
          <LinePage line={driverData[0].line[selectedLine]} selectedLine={selectedLine}/>
        )}
      </View>
    </SafeAreaView>
  )
}

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    no_assigned_students_box:{
      height:50,
      width:300,
      marginTop:95,
      backgroundColor:colors.GRAY,
      borderRadius:15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    no_student_text: {
      height:50,
      verticalAlign:'middle',
      fontFamily: 'Cairo_400Regular',
    },
    scrollViewContainer:{
      height:60,
      width:'100%',
      position:'absolute',
      top:60,
      left:0,
      zIndex:100,
      alignItems:'center',
      justifyContent:'center',
    },
    line_name_buttons_container:{
      flexDirection:'row',
      alignItems:'center',
      justifyContent:'center',
    },
    line_name_button:{
      backgroundColor:colors.WHITE,
      borderColor:'#ddd',
      borderWidth:1,
      minWidth:150,
      height:40,
      borderRadius:15,
      alignItems:'center',
      justifyContent:'center',
      marginHorizontal: 5
    },
    line_name_button_text:{
      height:40,
      verticalAlign:'middle',
      textAlign:'center',
      fontFamily: 'Cairo_400Regular',
      fontSize:13,
    },
    active_line_name_button:{
      backgroundColor:colors.PRIMARY,
      borderColor:colors.PRIMARY,
    },
    active_line_name_button_text:{
      color:colors.WHITE,
      fontFamily: 'Cairo_700Bold',
    },
    student_info_container:{
      flex:1,
      alignItems:'center',
      justifyContent:'center',
      position:'relative',
    },
})