import { useState,useEffect } from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,Modal,ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link,useRouter } from 'expo-router'
import dayjs from '../../../../utils/dayjs'
import { useDriverData } from '../../../stateManagment/DriverContext'
import AntDesign from '@expo/vector-icons/AntDesign'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'

const home = () => {
  const {userData,fetchingUserDataLoading,driverData,fetchingDriverDataLoading} = useDriverData()
  const router = useRouter()
  const [completedTripsCount, setCompletedTripsCount] = useState(0)
  const [unpaidTicketsCount, setUnpaidTicketsCount] = useState(0)
  const [openUpLinesDetails,setOpenUpLinesDetails] = useState(false)
  const [selectedLine,setSelectedLine] = useState(null)
  const driverDailyTracking = driverData[0]?.dailyTracking || {}

  useEffect(() => {
    const getCompletedTripsCount = () => {
      if (!driverDailyTracking) return setCompletedTripsCount(0);

      const iraqTime = dayjs().utcOffset(180)
      const yearMonthKey = `${iraqTime.year()}-${String(iraqTime.month() + 1).padStart(2, "0")}`

      const monthData = driverDailyTracking[yearMonthKey];
      if (!monthData) return setCompletedTripsCount(0);

      let count = 0;

      Object.values(monthData).forEach((dayEntry) => {
        if (dayEntry.today_lines && Array.isArray(dayEntry.today_lines)) {
          dayEntry.today_lines.forEach((line) => {
            const firstPhase = line.first_phase;
            const secondPhase = line.second_phase;

            if (firstPhase?.phase_finished === true && firstPhase.handled_by_other_driver !== true) {
              count += 1;
            }

            if (secondPhase?.phase_finished === true && secondPhase.handled_by_other_driver !== true) {
              count += 1;
            }
          });
        }
      });

      setCompletedTripsCount(count)
    };

    const countUnpaidTickets = () => {
      if (!driverData[0]?.tickets || !Array.isArray(driverData[0].tickets)) {
        return setUnpaidTicketsCount(0);
      }

      const iraqNow = dayjs().utcOffset(180)
      const currentMonth = iraqNow.month(); // 0-indexed
      const currentYear = iraqNow.year();

      const unpaidTickets = driverData[0].tickets.filter(ticket => {
        const ticketDate = dayjs(ticket.date);
        return (
          ticket.payed === false &&
          ticketDate.month() === currentMonth &&
          ticketDate.year() === currentYear
        );
      });

      setUnpaidTicketsCount(unpaidTickets.length);
    };

    getCompletedTripsCount();
    countUnpaidTickets();

  }, [driverDailyTracking]);

  //Redirect to add data screen
  const redirectToAddDataPage = () => {
    router.push({
      pathname:"/addDriverData",
      params: {
        driverName: userData.user_full_name,
        driverFamily:userData.user_family_name,
        driverUserId:userData.user_id,
        driverPhone:userData.phone_number,
        driverNotification:userData.user_notification_token,
      }
    })
  }

  //Redirect to add new line screen
  const redirectToFindLinesPage = () => {
    router.push({
      pathname:"/driverAddNewLine",
      params: {
        driverData: JSON.stringify(driverData[0])
      }
    })
  }

  useEffect(() => {
    if (openUpLinesDetails && driverData?.[0]?.lines?.length) {
      setSelectedLine(driverData[0].lines[0]);
    }
  }, [openUpLinesDetails])

  //Loading 
  if (fetchingUserDataLoading || fetchingDriverDataLoading) {
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
              <Text style={styles.greeting_text}>, {userData?.user_full_name} {userData?.user_family_name}</Text>
            </View>
          </View>
          <View style={styles.all_sections_container}>

            <View style={styles.sections_container}>
              <View style={styles.sections_box}>
                <Link href="/lines" asChild>
                  <TouchableOpacity>
                    <Text style={styles.section_text}>خطوط الطلبة و الموظفين</Text>
                  </TouchableOpacity>                   
                </Link>
              </View>
              <View style={styles.sections_box}>
                <Link href="/(dailyTrips)/driverDailyTripsMain" asChild>
                  <TouchableOpacity>
                    <Text style={styles.section_text}>رحلات يومية بين المدن</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            <View style={styles.sections_container}>
              <View style={styles.reward_box}>
                {driverData[0] ? (
                  <>

                    {driverData[0].service_type === 'خطوط' ? (
                      <View style={styles.riders_count_box}>
                        <Text style={styles.section_text}>عدد الخطوط في حسابك</Text>
                        <Text style={styles.section_text}>{driverData[0]?.lines?.length}</Text>
                      </View>
                    ) : (
                      <View style={styles.riders_count_box}>
                        <Text style={styles.section_text}>عدد الرحلات في حسابك</Text>
                        <Text style={styles.section_text}>{driverData[0]?.intercityTrips?.length}</Text>
                      </View>
                    )}

                    <View style={styles.driver_manageLines_buttons}>
                      {
                        driverData?.length > 0 && 
                        (driverData[0].lines?.length || 0) < 2 && 
                        driverData[0].service_type === 'خطوط' && 
                      (
                        <TouchableOpacity style={styles.add_lines_button} onPress={redirectToFindLinesPage}>
                          <Text style={styles.add_lines_button_text}>اضف خط جديد</Text>
                        </TouchableOpacity>
                      )}
                      {driverData?.length > 0 && (driverData[0].lines?.length || 0) > 0 && (
                        <TouchableOpacity style={styles.add_lines_button} onPress={() => setOpenUpLinesDetails(true)}>
                          <Text style={styles.add_lines_button_text}>تفاصيل الخطوط</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Modal
                      animationType="fade"
                      transparent={true}
                      visible={openUpLinesDetails}
                      onRequestClose={() => setOpenUpLinesDetails(false)}
                    >
                      <View style={styles.line_details_container}>
                        <View style={styles.line_details_box}>
                          <View style={styles.line_details_box_header}>
                            <Text style={styles.line_details_box_header_text}>تفاصيل الخطوط</Text>
                            <TouchableOpacity onPress={() => setOpenUpLinesDetails(false)}>
                              <AntDesign name="closecircleo" size={20} color="black" />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.line_details_box_main}>
                            {selectedLine && (
                              <>
                                <View style={styles.scrollViewContainer}>
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.line_name_buttons_container}
                                  >
                                    {driverData[0].lines.map((line,index) => (
                                      <TouchableOpacity 
                                        key={index}
                                        style={[styles.line_name_button, selectedLine.id === line.id && styles.active_line_name_button]}
                                        onPress={() => setSelectedLine(line)}
                                      >
                                        <Text style={[styles.line_name_button_text, selectedLine.id === line.id && styles.active_line_name_button_text]}>
                                          {line.name}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                                <View style={styles.line_info_container}>
                                  <View style={styles.line_name_box}>
                                    <Text style={styles.line_name}>{selectedLine?.destination}</Text>
                                  </View>
                                  <View style={styles.line_name_box}>
                                    <Text style={styles.line_name}>{selectedLine?.riders?.length} ركاب</Text>
                                  </View>
                                  <View style={styles.line_name_box}>
                                    <Text style={styles.line_name}>
                                      {(selectedLine?.riders || []).reduce((sum, rider) => sum + (rider.driver_commission || 0), 0).toLocaleString()} د.ع
                                    </Text>
                                  </View>
                                  <View style={styles.line_startTime_container}>   
                                    {selectedLine?.timeTable?.map(li => (
                                      <View key={li.dayIndex} style={styles.line_startTime_day}>
                                        <Text style={styles.line_startTime_name}>{li?.day}</Text>
                                        <Text style={styles.line_startTime_name}>
                                          {li.active ? dayjs(li?.startTime?.toDate()).format("HH:mm") : "--"}                  
                                        </Text>
                                        <Text style={styles.line_startTime_name}>
                                          {li.active ? dayjs(li?.endTime?.toDate()).format("HH:mm") : "--"}                  
                                        </Text>
                                      </View>              
                                    ))}
                                  </View>
                                </View>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    </Modal>  
                  </>
                ) : (
                  <View style={styles.riders_count_box}>
                    <TouchableOpacity style={styles.add_lines_button} onPress={redirectToAddDataPage}>
                      <Text style={styles.add_lines_button_text}>اضف بياناتك</Text>
                    </TouchableOpacity>
                  </View>
                )}     
              </View>
            </View>

            {driverData[0] && (
              <View style={styles.sections_container}>
                <View style={styles.reward_box}>
                  {driverData[0].service_type === 'خطوط' ? (
                    <Text style={styles.section_text}>عدد رحلات الخطوط المكتملة هذا الشهر: {completedTripsCount}</Text>
                  ) : (
                    <Text style={styles.section_text}>عدد الرحلات المنتهية: {unpaidTicketsCount}</Text>
                  )}
                </View>
              </View>
            )}          
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
      marginBottom:25,
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
    reward_box:{
      width:330,
      height:155,
      paddingHorizontal:20,
      borderRadius: 15,
      backgroundColor:'rgba(190, 154, 78, 0.30)',
      alignItems:'center',
      justifyContent:'center',
    },
    riders_count_box:{
      flexDirection:'row-reverse',
      alignItems:'center',
      justifyContent:'center',
      gap:10,
    },
    driver_manageLines_buttons:{
      marginTop:10,
      flexDirection:'row',
      gap:10,
    },
    add_lines_button:{
      width:130,
      height:45,
      justifyContent:'center',
      alignItems:'center',
      backgroundColor: colors.WHITE,
      borderWidth:1,
      borderColor:colors.PRIMARY,
      borderRadius: 15,
    },
    add_lines_button_text:{
      fontSize: 14,
      fontFamily: 'Cairo_700Bold',
      lineHeight: 45,
    },
    line_details_container:{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    line_details_box:{
      width:'95%',
      height:600,
      backgroundColor: '#fff',
      borderRadius: 10,
      paddingVertical:10,
      alignItems: 'center',
    },
    line_details_box_header:{
      height:50,
      flexDirection:'row-reverse',
      alignItems:'center',
      justifyContent:'center',
      gap:10,
    },
    line_details_box_header_text:{
      fontFamily: 'Cairo_700Bold',
      lineHeight: 50,
      textAlign: 'center',
    },
    line_details_box_main:{
      alignItems:'center',
      justifyContent:'center',
    },
    scrollViewContainer:{
      height:50,
      width:'100%',
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
      minWidth:130,
      height:35,
      borderRadius:15,
      alignItems:'center',
      justifyContent:'center',
      marginHorizontal: 5
    },
    line_name_button_text:{
      lineHeight:30,
      textAlign:'center',
      fontFamily: 'Cairo_400Regular',
      fontSize:13,
    },
    active_line_name_button:{
      backgroundColor:'rgba(190, 154, 78, 0.30)',
      borderColor:colors.BLACK,
    },
    active_line_name_button_text:{
      color:colors.BLACK,
      fontFamily: 'Cairo_700Bold',
    },
    line_info_container:{
      marginTop:50,
      alignItems:'center',
      justifyContent:'space-around'
    },
    line_name_box:{
      width:300,
      height:65,
      justifyContent:'center',
      alignItems:'center',
      borderBottomColor:colors.GRAY,
      borderBottomWidth:1,
    },
    line_name:{
      width:200,
      lineHeight:50,
      textAlign:'center',
      fontFamily:'Cairo_400Regular',
      fontSize:14,
    },
    line_startTime_container:{
      height:100,
      justifyContent:'center',
      alignItems:'center',
      flexDirection:'row-reverse',
      borderBottomColor:colors.GRAY,
      borderBottomWidth:1,
    },
    line_startTime_day:{
      alignItems:'center',
      marginHorizontal:2,
      width:45,
    },
    line_startTime_name:{
      fontFamily:'Cairo_400Regular',
      fontSize:13,
    },
    spinner_error_container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    }
})