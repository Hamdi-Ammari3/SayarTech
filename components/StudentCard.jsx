import { StyleSheet, Text, View, ActivityIndicator,Image,TouchableOpacity,Modal } from 'react-native'
import React,{useState} from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import LottieView from "lottie-react-native"
import colors from '../constants/Colors'
import AntDesign from '@expo/vector-icons/AntDesign'
import driverWaiting from '../assets/animations/waiting_driver.json'

const ChildCard = ({ item }) => {
  const [showDriverInfo,setShowDriverInfo] = useState(false)
  const [driverData, setDriverData] = useState(null)
  const [loadingDriver, setLoadingDriver] = useState(false)
  const [error, setError] = useState(null)

  const openDriverInfoModal = async () => {
    try {
      setLoadingDriver(true);
      setShowDriverInfo(true);

      if (!item.driver_id) {
        setError('No driver assigned for this student.')
        setLoadingDriver(false);
        return;
      }

      // Fetch driver data using driver_id
      const driverDocRef = doc(DB, 'drivers', item.driver_id);
      const driverSnapshot = await getDoc(driverDocRef);

      if (driverSnapshot.exists()) {
        setDriverData(driverSnapshot.data());
      } else {
        setError('لا يوجد معلومات');
      }

    } catch (error) {
      setError('خلل في محاولة البحث عن السائق. الرجاء المحاولة مرة ثانية');
      console.log(error)
    } finally {
      setLoadingDriver(false);
    }

  }

  const closeDriverInfoModal = () => {
    setShowDriverInfo(false)
    setDriverData(null)
    setError(null)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ar-IQ", {
      style: "currency",
      currency: "IQD",
      maximumFractionDigits: 0, // No decimals for IQD
    })
      .format(amount)
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.student_info_box}>
        <Text style={styles.info_text}>{item.destination}</Text>
        <Text style={styles.info_text}>{item.full_name}</Text>
      </View>
      {item.driver_id ? (
      <View style={styles.driver_car_box}>
        <View style={styles.driver_car_box_inner}>
          <TouchableOpacity style={styles.driver_car_box_inner_btn} onPress={openDriverInfoModal}>
            <Text style={styles.driver_car_box_inner_btn_text}>بيانات السائق</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.driver_car_box_inner}>
          <Text style={styles.info_text}>الاشتراك الشهري</Text>
          <Text style={styles.info_text_bold}>{item.monthly_sub ? formatCurrency(item.monthly_sub) : "-"}</Text>
        </View>
       
        <Modal 
          animationType="fade"
          transparent={true}
          visible={showDriverInfo}
          onRequestClose={() => setShowDriverInfo(false)}
        >
          <View style={styles.driver_info_modal_container}>
            <View style={styles.driver_info_modal_box}>
              <View style={styles.driver_info_modal_inner_box}>
                <TouchableOpacity onPress={closeDriverInfoModal}>
                  <AntDesign name="closecircleo" size={24} color="gray" />
                </TouchableOpacity>
              </View>

              <View style={styles.driver_info_modal_inner_box}>
                {loadingDriver && (
                  <View style={styles.spinner_error_container}>
                    <ActivityIndicator size="large" color={colors.PRIMARY} />
                  </View>
                )}

                {error && (
                  <View style={styles.spinner_error_container}>
                    <Text style={styles.info_text}>{error}</Text>
                  </View>
                )}

                {driverData && (
                  <View style={styles.driver_details_box}>

                    <View style={styles.driver_info}> 
                      <Image source={{uri:driverData.driver_personal_image}} style={styles.driver_photo}/> 
                      <Text style={styles.info_text}>{driverData.driver_full_name} {driverData.driver_family_name}</Text>
                      <Text style={styles.info_text}>{driverData.driver_phone_number}</Text>
                    </View>

                    <View style={styles.driver_info}>
                      <Image source={{uri:driverData.driver_car_image}} style={styles.driver_photo}/>
                      <Text style={styles.info_text}>نوع السيارة: {driverData.driver_car_type}</Text>
                      <Text style={styles.info_text}>موديل السيارة: {driverData.driver_car_model}</Text>
                      <Text style={styles.info_text}>رقم السيارة: {driverData.driver_car_plate}</Text>
                    </View>

                  </View>
                )}
              </View>            
            </View>
          </View>
        </Modal>
      </View>
      ) : (
        <View style={styles.animation_container}>
          <LottieView
            source={driverWaiting}
            autoPlay
            loop
            style={{ width: 150, height: 150}}
          />
          <View style={styles.not_connected_to_driver}>
            <Text style={styles.not_connected_to_driver_text}>جاري ربط الحساب بسائق</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export default ChildCard

const styles = StyleSheet.create({
  container:{
    margin:10,
    height:250,
    paddingVertical:10,
    alignItems:'center',
    backgroundColor:colors.GRAY,
    borderRadius:15
  },
  student_info_box:{
    width:350,
    height:30,
    flexDirection:'row',
    justifyContent:'space-around',
    alignItems:'center',
  },
  info_text:{
    lineHeight:30,
    fontFamily:'Cairo_400Regular',
    fontSize:14,
  },
  info_text_bold:{
    lineHeight:30,
    fontFamily:'Cairo_700Bold',
    fontSize:14,
    marginRight:7
  },
  driver_car_box:{
    width:'100%',
    height:200,
    flexDirection:'column-reverse',
    alignItems:'center',
    justifyContent:'center',
  },
  driver_car_box_inner:{
    flexDirection:'row-reverse',
    alignItems:'center',
    marginVertical:15,
  },
  driver_car_box_inner_btn:{
    width:150,
    height:40,
    alignItems:'center',
    backgroundColor:colors.BLUE,
    borderRadius:15,
  },
  driver_car_box_inner_btn_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    color:colors.WHITE
  },
  driver_info_modal_container:{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  driver_info_modal_box:{
    width: '90%',
    height:'70%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    justifyContent:'space-around',
    alignItems: 'center',
  },
  driver_info_modal_inner_box:{
    width:'90%',
    alignItems:'center',
    justifyContent:'center',
  },
  driver_details_box:{
    width:'90%',
  },
  driver_info:{
    marginVertical:10,
    alignItems:'center',
  },
  driver_photo:{
    height:130,
    width:130,
    borderRadius:5,
    resizeMode:'contain',
  },
  animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  not_connected_to_driver:{
    width:'100%',
    height:30,
    justifyContent:'center',
    alignItems:'center',
  },
  not_connected_to_driver_text:{
    fontFamily: 'Cairo_400Regular',
    color:colors.BLACK,
    lineHeight:30
  },
  spinner_error_container:{
    height:"80%",
    justifyContent:'center'
  }
})
