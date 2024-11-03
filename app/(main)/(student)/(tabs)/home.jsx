import { Alert,StyleSheet, Text, View, ActivityIndicator,Image,TouchableOpacity,TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser } from '@clerk/clerk-expo'
import { useState, useEffect } from 'react'
import { Link } from 'expo-router'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import axios from 'axios'
import { doc,updateDoc } from 'firebase/firestore'
import {DB} from '../../../../firebaseConfig'
import { useStudentData } from '../../../stateManagment/StudentState'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpeg'

const GOOGLE_MAPS_APIKEY = 'google maps api key'

const home = () => {
  const { isLoaded } = useUser()
  const [driverLocation, setDriverLocation] = useState(null)
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [loadingRoutes,setLoadingRoutes] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelText, setCancelText] = useState('');

  const {students,fetchingStudentsLoading,assignedToDriver,fetchingAssignedToDriversLoading} = useStudentData()
  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  useEffect(() => {
    if(
      !students[0]?.driver_id || 
      !students[0]?.picked_up || 
      fetchingAssignedToDriversLoading || 
      fetchingStudentsLoading || 
      students[0]?.student_trip_status === 'at home' || 
      students[0]?.student_trip_status === 'at school'
    ) {
      return;
    }

    const trackDriver = async () => {
      setLoadingRoutes(true)
      try {
        if (assignedToDriver[students[0].driver_id]?.current_location) {
          setDriverLocation(assignedToDriver[students[0].driver_id]?.current_location);
  
          // Determine the destination based on the student's trip status
          let destinationCoords;
          if (students[0]?.student_trip_status === 'going to school') {
            destinationCoords = students[0]?.student_school_location;
          } else if (students[0]?.student_trip_status === 'going to home') {
            destinationCoords = students[0]?.student_home_location?.coords;
          }
  
          // Fetch route if there's a valid destination and driver location
          if (destinationCoords && assignedToDriver[students[0].driver_id]?.current_location) {
          fetchRoute(assignedToDriver[students[0].driver_id]?.current_location, destinationCoords);
          }
  
        }
      } catch (error) {
        createAlert('حدث خطأ أثناء تحديث الموقع')
        setLoadingRoutes(false)
      }finally{
        setLoadingRoutes(false)
      }
    }
    trackDriver();
  }, [
      students[0]?.driver_id,
      students[0]?.picked_up,
      fetchingAssignedToDriversLoading,
      fetchingStudentsLoading,
      students[0]?.student_trip_status,
      assignedToDriver
]);

// Function to get route between driver and student
  const fetchRoute = async (startingPoint, nextDestinationCoords) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${startingPoint.latitude},${startingPoint.longitude}&destination=${nextDestinationCoords.latitude},${nextDestinationCoords.longitude}&key=${GOOGLE_MAPS_APIKEY}`
      );

      if (response.data.routes.length) {
        const points = decodePolyline(response.data.routes[0].overview_polyline.points);
        setRouteCoordinates(points);
      }
    } catch (error) {
      createAlert('حدث خطأ أثناء تحديث الموقع')
    }
  };

// Function to decode the polyline points from Google Directions API
  const decodePolyline = (encoded) => {
    let points = [];
    let index = 0;
    let len = encoded.length;
    let lat = 0;
    let lng = 0;
  
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
         result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
  
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
  
      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5
      });
    }
  
    return points;
  };

// Function to handle canceling the trip
  const handleCancelTrip = async () => {
    if (cancelText.trim() === 'نعم') {
      try {
        const studentDoc = doc(DB, 'students', students[0].id);
        await updateDoc(studentDoc, {
          tomorrow_trip_canceled: true,
        });
        createAlert('تم إلغاء رحلة الغد بنجاح');
        setIsCanceling(false);
        setCancelText('');
      } catch (error) {
        createAlert('حدث خطأ أثناء إلغاء الرحلة. حاول مرة أخرى.');
      }
    } else {
      createAlert('لتاكيد الالغاء يرجى كتابة نعم');
    }
  };

  const handleDenyCancelTrip = () => {
    setIsCanceling(false);
    setCancelText('');
  }

  // Wait untill data load
  if (loadingRoutes||fetchingStudentsLoading || fetchingAssignedToDriversLoading || !isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

// if the student haven't yet registered his info
  if(!students.length) {
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

if(!students[0].driver_id) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.finding_driver_container}>
          <View style={styles.finding_driver_loading_box}>
            <ActivityIndicator size={'small'} color={colors.WHITE}/>
            <Text style={styles.finding_driver_loading_text}>جاري ربط حسابك بسائق</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if(students[0].driver_id && students[0]?.student_trip_status === 'at home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.student_box}>
            <Text style={styles.student_text}>الطالب في المنزل 😴</Text>
          </View>
          {!students[0].tomorrow_trip_canceled && (
            <View>
            <TouchableOpacity style={styles.cancel_trip_btn} onPress={() => setIsCanceling(true)}>
              <Text style={styles.cancel_trip_btn_text}>الغاء رحلة الغد</Text>
            </TouchableOpacity>
            {isCanceling && (
              <View style={styles.cancel_trip_confirmation}>
                <TextInput
                  style={styles.cancel_trip_input}
                  value={cancelText}
                  onChangeText={setCancelText}
                  placeholder="للتاكيد اكتب كلمة نعم هنا"
                />
                <View style={styles.confirm_deny_canceling_btn}>
                  <TouchableOpacity style={styles.confirm_cancel_btn} onPress={handleCancelTrip}>
                    <Text style={styles.confirm_cancel_btn_text}>تأكيد</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deny_cancel_btn} onPress={handleDenyCancelTrip}>
                   <Text style={styles.deny_cancel_btn_text}>رفض</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          )}
        </View>
      </SafeAreaView>
    )
  }

  if(students[0].driver_id && students[0]?.student_trip_status === 'at school') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.student_box}>
            <Text style={styles.student_text}>الطالب في المدرسة 📖</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if(students[0].driver_id && (students[0]?.student_trip_status === 'going to school' || students[0]?.student_trip_status === 'going to home')) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_map_container}>
        <MapView
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: assignedToDriver[students[0].driver_id].current_location.latitude || 0,
          longitude: assignedToDriver[students[0].driver_id].current_location.longitude || 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        style={styles.map}
        userInterfaceStyle="light"
        showsUserLocation
        >
  
        {students[0].student_school_location && students[0]?.student_trip_status === 'going to school' && (
          <Marker
            key={`مدرسة ${students[0]?.id}`}
            coordinate={students[0]?.student_school_location}
            title={'المدرسة'}
          />
        )}
  
        {students[0].student_home_location?.coords && students[0]?.student_trip_status === 'going to home' && (
          <Marker
            key={`منزل ${students[0]?.id}`}
            coordinate={students[0].student_home_location.coords}
            title={'المنزل'}
          />
        )}
  
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="blue"
            strokeWidth={4}
          />
        )}
  
        </MapView>
        </View>
      </SafeAreaView>
    )
  }
}
export default home;

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor: colors.WHITE,
  },
  no_registered_students_container:{
    height:400,
    paddingTop:25,
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
    padding: 15,
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  finding_driver_container:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center'
  }, 
  finding_driver_loading_box:{
    width:250,
    padding:10,
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-around'
  },
  finding_driver_loading_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  }, 
  student_container:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center'
  },
  student_box:{
    backgroundColor:'#16B1FF',
    width:250,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  cancel_trip_btn:{
    backgroundColor:'#FF4C51',
    width:250,
    padding:10,
    borderRadius:15,
    marginTop:10
  },
  cancel_trip_btn_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  cancel_trip_input:{
    width:250,
    padding:10,
    borderRadius:15,
    borderColor:'#ddd',
    borderWidth:1,
    marginTop:10,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
  },
  confirm_deny_canceling_btn:{
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-around',
  },
  confirm_cancel_btn:{
    backgroundColor:'#16B1FF',
    width:100,
    padding:10,
    borderRadius:15,
    marginTop:10
  },
  deny_cancel_btn:{
    borderWidth:1,
    borderColor:'#16B1FF',
    width:100,
    padding:10,
    borderRadius:15,
    marginTop:10
  },
  confirm_cancel_btn_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
  },
  deny_cancel_btn_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:'#16B1FF'
  },
  student_name_container:{
    backgroundColor:'#16B1FF',
    width:250,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_name:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    color:colors.WHITE,
  },
  student_map_container:{
    width:'100%',
    height:'100%',
    position:'relative',
  },
  student_route_status_container:{
    width:'100%',
    position:'absolute',
    top:90,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center'
  },
  student_route_status_box:{
    backgroundColor:colors.WHITE,
    width:250,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_route_status_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
  },
  map: {
    flex:1,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
})