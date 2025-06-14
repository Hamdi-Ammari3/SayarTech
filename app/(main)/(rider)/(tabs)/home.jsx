import {useState} from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter,Link } from 'expo-router'
import * as Clipboard from 'expo-clipboard';
import { useRiderData } from '../../../stateManagment/RiderContext'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'
import Ionicons from '@expo/vector-icons/Ionicons'
import AntDesign from '@expo/vector-icons/AntDesign'
import Feather from '@expo/vector-icons/Feather'

const home = () => {
  const {userData,fetchingUserDataLoading,rider,fetchingRiderLoading,} = useRiderData() 
  const router = useRouter()
  const [currentRiderIndex, setCurrentRiderIndex] = useState(0)
  const [openAccountBalanceModal,setOpenAccountBalanceModal] = useState(false)

  //Redirect to add data screen
  const redirectToAddDataPage = () => {
    router.push({
      pathname:"/addNewRider",
      params: {
        riderFamily:userData.user_family_name,
        riderUserDocId:userData.id,
        riderUserId:userData.user_id,
        riderPhone:userData.phone_number,
        riderNotification:userData.user_notification_token,
      }
    })
  }

  // Calculate total subs fee amount
  const formatAccountBalanceFee = (amount) => {
    return amount.toLocaleString('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    });
  }

  //Copy feed account info
  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text)
    Alert.alert('تم النسخ', 'تم نسخ النص إلى الحافظة')
  };

  // Format the name to only the first word
  const getFirstWord = (text) => {
    if (!text) return '';
    return text.trim().split(/\s+/)[0];
  }

  // Format the destiantion name to two words only combination
  const getFirstTwoWords = (text) => {
    if (!text) return '';
    return text.trim().split(/\s+/).slice(0, 2).join(' ');
  };

  // Get age from birthdate 
  const getAgeFromBirthDate = (birthdate) => {
    const birthDate = new Date(birthdate.seconds * 1000); // Convert Firestore Timestamp to JS Date
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
  
    // Adjust age if the current date is before the birthdate this year
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  
    return age;
  }

  // Calculate total subs fee amount
  const formatTotalSubscriptionFee = (riderData) => {
    if (!riderData || !riderData.line_id || !riderData.driver_commission || !riderData.company_commission) return "--";

    const total = riderData.driver_commission + riderData.company_commission;

    return total.toLocaleString('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    });
  };

  // Switch to next rider 
  const nextRider = () => {
    setCurrentRiderIndex((prevIndex) =>
      prevIndex === rider.length - 1 ? 0 : prevIndex + 1
    );
  }

  // Switch to previous rider 
  const previousRider = () => {
    setCurrentRiderIndex((prevIndex) =>
      prevIndex === 0 ? rider.length - 1 : prevIndex - 1
    );
  }

  //Loading 
  if (fetchingUserDataLoading ||fetchingRiderLoading) {
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
            <View style={styles.balance_add_riders_box}>
              <View style={styles.balance_add_riders_inside_box}>
                <View style={styles.balance_add_riders_inside_text_box}>
                  <Text style={styles.section_text}>رصيدك</Text>
                  <Text style={styles.section_text}>{formatAccountBalanceFee(userData?.account_balance)}</Text>
                </View>
                <TouchableOpacity style={styles.add_riders_button} onPress={() => setOpenAccountBalanceModal(true)}>
                  <Text style={styles.add_riders_button_text}>تعبئة رصيد</Text>
                </TouchableOpacity>
                <Modal
                  animationType="fade"
                  transparent={true}
                  visible={openAccountBalanceModal}
                  onRequestClose={() => setOpenAccountBalanceModal(false)}
                >
                  <View style={styles.add_balance_modal_container}>
                    <View style={styles.add_balance_modal_box}>
                      <View style={styles.add_balance_box_header}>
                        <TouchableOpacity onPress={() => setOpenAccountBalanceModal(false)}>
                          <AntDesign name="closecircleo" size={20} color="black" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.add_balance_box_main}>
                        <View style={styles.balance_comment_box}>
                          <Text style={styles.balance_comment_text}>
                            لتعبئة حسابك قم بتحويل رصيد من حسابك (زين كاش,اسيا باي,ماستر كارد) الى حساب الشركة مع اضافة اسمك الكامل و المعرف الخاص بك الموجود في الاسفل, في خانة الملاحظات
                          </Text>
                        </View>
                        <View style={styles.add_balance_copy_info_box}>
                          <TouchableOpacity onPress={() => handleCopy(userData.id)}>
                            <Feather name="copy" size={24} color="black" />
                          </TouchableOpacity>                        
                          <Text style={styles.add_balance_copy_info_box_text}>{userData.id}</Text>
                          <Text style={styles.add_balance_copy_info_box_text}>المعرف الخاص:</Text>
                        </View>
                        <View style={styles.add_balance_copy_info_box}>
                          <TouchableOpacity onPress={() => handleCopy("4542789630586155")}>
                            <Feather name="copy" size={24} color="black" />
                          </TouchableOpacity>   
                          <Text style={styles.add_balance_copy_info_box_text}>4542789630586155</Text>
                          <Text style={styles.add_balance_copy_info_box_text}>حساب الشركة:</Text>
                        </View>
                      </View>
                    </View>
                  </View>                
                </Modal>
              </View>
              <View style={styles.balance_add_riders_inside_box}>
                <View style={styles.balance_add_riders_inside_text_box}>
                  <Text style={styles.section_text}>عدد الركاب في حسابك</Text>
                  <Text style={styles.section_text}>{rider?.length}</Text>
                </View>
                <TouchableOpacity style={styles.add_riders_button} onPress={redirectToAddDataPage}>
                  <Text style={styles.add_riders_button_text}>اضف راكب</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.sections_container}>
            {rider.length > 0 && (
              <View style={styles.rider_info_box}>
                <TouchableOpacity onPress={previousRider} style={styles.arrow_button}>
                  <Ionicons name="chevron-back" size={24} color="black" />
                </TouchableOpacity>
                <View style={styles.rider_slide}>
                  <View style={styles.rider_slide_name_age_box}>
                    <Text style={styles.section_text}>{getFirstWord(rider[currentRiderIndex].full_name)}</Text>
                    <Text style={styles.section_text}>-</Text>
                    <Text style={styles.section_text}>{getAgeFromBirthDate(rider[currentRiderIndex].birth_date)} سنة</Text>
                  </View>        
                  <Text style={styles.section_text}>{getFirstTwoWords(rider[currentRiderIndex].destination)}</Text>  
                  {rider[currentRiderIndex].line_id && (
                    <Text style={styles.section_text}>الاشتراك الشهري: {formatTotalSubscriptionFee(rider[currentRiderIndex])}</Text>
                  )}                 
                  {rider[currentRiderIndex].driver_id && (
                    <>
                      <Text style={styles.section_text}>اشتراك صالح الى غاية</Text>
                      <Text style={styles.section_text}>يرجى الدفع قبل</Text>
                      <TouchableOpacity style={styles.add_riders_button}>
                        <Text style={styles.add_riders_button_text}>ادفع الان</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                <TouchableOpacity onPress={nextRider} style={styles.arrow_button}>
                  <Ionicons name="chevron-forward" size={24} color="black" />
                </TouchableOpacity>             
              </View>
            )}
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
      marginTop:30,
      justifyContent:'center',
      alignItems:'center',
    },
    sections_container:{
      flexDirection:'row-reverse',
      justifyContent:'center',
      alignItems:'center',
      marginBottom:20,
    },
    sections_box:{
      width:155,
      height:100,
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
    balance_add_riders_box:{
      width:340,
      height:150,
      borderRadius: 15,
      backgroundColor:'rgba(190, 154, 78, 0.30)',
      alignItems:'center',
      justifyContent:'center',
      gap:10,
    },
    balance_add_riders_inside_box:{
      width:'100%',
      height:60,
      flexDirection:'row-reverse',
      alignItems:'center',
      justifyContent:'center',
      gap:10,
    },
    balance_add_riders_inside_text_box:{
      width:170,
      flexDirection:'row-reverse',
      alignItems:'center',
      justifyContent:'center',
      gap:10,
    },
    add_riders_button:{
      width:110,
      height:40,
      justifyContent:'center',
      alignItems:'center',
      backgroundColor: colors.WHITE,
      borderWidth:1,
      borderColor:colors.PRIMARY,
      borderRadius: 15,
    },
    add_riders_button_text:{
      fontSize: 14,
      fontFamily: 'Cairo_700Bold',
      lineHeight: 40,
    },
    add_balance_modal_container:{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    add_balance_modal_box:{
      width:'90%',
      height:420,
      backgroundColor: '#fff',
      borderRadius: 10,
      paddingVertical:10,
      alignItems: 'center',
    },
    add_balance_box_header:{
      height:50,
      alignItems:'center',
      justifyContent:'center',
    },
    add_balance_box_main:{
      alignItems:'center',
      justifyContent:'center',
      gap:15,
    },
    balance_comment_box:{
      width:300,
      marginBottom:10
    },
    balance_comment_text:{
      fontSize: 14,
      fontFamily: 'Cairo_400Regular',
      lineHeight: 40,
      textAlign:'center'
    },
    add_balance_copy_info_box:{
      width:320,
      height:50,
      flexDirection:'row',
      alignItems:'center',
      justifyContent:'space-around',
      //gap:10,
      borderColor:colors.BLACK,
      borderWidth:1,
      borderRadius:15
    },
    add_balance_copy_info_box_text:{
      fontSize: 14,
      fontFamily: 'Cairo_400Regular',
      lineHeight: 40,
      textAlign:'center'
    },
    rider_info_box:{
      width:340,
      height:270,
      borderRadius: 15,
      backgroundColor:'rgba(190, 154, 78, 0.30)',
      flexDirection: 'row', 
      alignItems:'center',
      justifyContent:'space-between',
    },
    rider_slide:{
      width:280,
      height:'100%',
      justifyContent:'center',
      alignItems:'center',
    },
    rider_slide_name_age_box:{
      width:200,
      flexDirection:'row-reverse',
      justifyContent:'center',
      alignItems:'center',
      gap:10,
    },
    pay_bill_button:{
      width:120,
      height:45,
      marginTop:5,
      justifyContent:'center',
      alignItems:'center',
      backgroundColor: colors.WHITE,
      borderWidth:1,
      borderColor:colors.PRIMARY,
      borderRadius: 15,
    },
    spinner_error_container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    }
})