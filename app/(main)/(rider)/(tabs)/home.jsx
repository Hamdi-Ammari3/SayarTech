import { StyleSheet, Text, View, ActivityIndicator,Image,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { useRiderData } from '../../../stateManagment/RiderContext'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'

const home = () => {
  const {userData,fetchingUserDataLoading} = useRiderData()

  //Loading 
  if (fetchingUserDataLoading) {
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
        <View>
          <View style={styles.greeting}>
            <View style={styles.logo}>
              <Image source={logo} style={styles.logo_image}/>
            </View>
            <View style={styles.greeting_text_box}>
              <Text style={styles.greeting_text}>مرحبا</Text>
              <Text style={styles.greeting_text}>, {userData.user_full_name} {userData.user_family_name}</Text>
            </View>
          </View>
          
          <View style={styles.all_sections_container}>

            <View style={styles.sections_container}>
              <View style={styles.sections_box}>
                  <Link href="/lines" asChild>
                    <TouchableOpacity>
                      <Text style={styles.section_text}>خطوط للطلبة و الموظفين</Text>
                    </TouchableOpacity>                   
                  </Link>
              </View>
              <View style={styles.sections_box}>
                <Link href="/dailyTrips" asChild>
                  <TouchableOpacity>
                    <Text style={styles.section_text}>رحلات يومية بين المدن</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            <View style={styles.sections_container}>
              <View style={styles.reward_box}>
                <Text style={styles.section_text}>قم باستدعاء اصدقائك و اربح جوائز و تخفيضات هامة</Text>
              </View>
            </View>

            <View style={styles.sections_container}>
              <View style={styles.reward_box}>
                <Text style={styles.section_text}>اشهارات ...</Text>
              </View>
            </View>

          </View>
          
        </View>
    </SafeAreaView>
  )
}

export default home

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.WHITE,
    },
    greeting:{
      width:'100%',
      height:80,
      paddingHorizontal: 20,
      flexDirection:'row',
      alignItems:'center',
      justifyContent:'space-between',
    },
    greeting_text_box:{
      flexDirection:'row-reverse',
      alignItems:'center',
      justifyContent:'center',
    },
    greeting_text:{
      fontSize: 16,
      fontFamily: 'Cairo_700Bold',
      lineHeight: 40,
      textAlign: 'center',
    },
    logo:{
      width:50,
      height:50,
      alignItems:'center',
      justifyContent:'center',
      borderRadius: 50,
      borderColor: colors.PRIMARY,
      borderWidth: 1,
    },
    logo_image:{
      height:40,
      width:40,
      resizeMode:'contain',
      borderRadius: 40,
    },
    all_sections_container:{
      width:'100%',
      height:500,
      marginTop:30,
      justifyContent:'space-between',
      alignItems:'center',
    },
    sections_container:{
      width:'100%',
      height:150,
      flexDirection:'row-reverse',
      justifyContent:'center',
      alignItems:'center',
    },
    sections_box:{
      width:150,
      height:120,
      paddingHorizontal:30,
      borderRadius: 15,
      marginHorizontal: 15,
      backgroundColor:'rgba(190, 154, 78, 0.30)',
      alignItems:'center',
      justifyContent:'center',
    },
    section_text:{
      fontSize: 15,
      fontFamily: 'Cairo_400Regular',
      lineHeight: 40,
      textAlign: 'center',
    },
    reward_box:{
      width:330,
      height:150,
      paddingHorizontal:20,
      borderRadius: 15,
      backgroundColor:'rgba(190, 154, 78, 0.30)',
      alignItems:'center',
      justifyContent:'center',
    },
    spinner_error_container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    }
})