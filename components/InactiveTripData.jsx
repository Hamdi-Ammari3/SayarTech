import { useState,useEffect } from 'react'
import { StyleSheet,Text,View,Image,TouchableOpacity,ActivityIndicator,Alert } from 'react-native'
import { doc,onSnapshot,writeBatch,getDoc} from "firebase/firestore"
import { DB } from '../firebaseConfig'
import { useDriverData } from '../app/stateManagment/DriverContext'
import colors from '../constants/Colors'
import logo from '../assets/images/logo.jpg'
import FontAwesome from '@expo/vector-icons/FontAwesome'

const InactiveTripData = () => {
  const {driverData} = useDriverData()

  const [intercityTripData, setIntercityTripData] = useState(null)
  const [loadingTrip, setLoadingTrip] = useState(false)
  const [oppositeSwitching, setOppositeSwitching] = useState(false)

  //Fetch driver intercity trip
  useEffect(() => {
    if (driverData[0]?.intercityTripId) {
      setLoadingTrip(true)
        
      const tripRef = doc(DB, 'intercityTrips', driverData[0].intercityTripId)
      const unsubscribe = onSnapshot(tripRef, (docSnap) => {
        if (docSnap.exists()) {
          setIntercityTripData({ id: docSnap.id, ...docSnap.data() })
        } else {
          console.log('No trip data found!')
          setIntercityTripData(null)
        }
        setLoadingTrip(false)
      }, (error) => {
        console.log('Error listening to active trip:', error)
        setLoadingTrip(false)
      })
      return () => unsubscribe()
    }
  }, [driverData[0]?.intercityTripId])

  // Ask users first if they really want to delete their account
  const confirmSwitchTripStart = () => {
    Alert.alert(
      'تاكيد تغيير نقطة الانطلاق', // Title
      'هل أنت متأكد أنك تريد التبديل إلى الاتجاه المقابل؟', // Message
      [
        {
          text: 'الغاء',
          style: 'cancel', // Cancels the alert
        },
        {
          text: 'تاكيد', // If the user confirms, proceed with deletion
          style: 'destructive', // Styling to indicate it's a destructive action
          onPress: handleSwitchOpposite, // Call the delete function if user confirms
        },
      ],
      { cancelable: true } // Allow dismissal by tapping outside
    );
  };

  // Switch to opposite
  const handleSwitchOpposite = async () => {
    if (!intercityTripData?.oppositeTrip) return;
    setOppositeSwitching(true);

    try {
      const oppositeTripRef = doc(DB, 'intercityTrips', intercityTripData.oppositeTrip);
      const currentTripRef = doc(DB, 'intercityTrips', intercityTripData.id);
      const driverRef = doc(DB, 'drivers', driverData[0].id);

      const driverObject = intercityTripData.inStation.find(
        (d) => d.id === driverData[0].id
      );

      if (!driverObject) {
        throw new Error('Driver not found in current trip');
      }

      // Remove driver object from current trip
      const updatedCurrentInStation = intercityTripData.inStation.filter(
        (d) => d.id !== driverData[0].id
      );

      // You need to fetch the opposite trip's full data to get its current inStation list
      const oppositeTripSnap = await getDoc(oppositeTripRef);
      let oppositeTripInStation  = [];

      if (oppositeTripSnap.exists()) {
        const oppositeData = oppositeTripSnap.data();
        oppositeTripInStation = oppositeData.inStation || [];
      } else {
        throw new Error('Opposite trip does not exist');
      }

      // Add driver object to opposite trip
      const updatedOppositeInStation = [...oppositeTripInStation, driverObject];
  
      const batch = writeBatch(DB);

      // Remove driver from current trip's inStation
      batch.update(currentTripRef, {
        inStation: updatedCurrentInStation,
      });

      // Add driver to opposite trip's inStation
      batch.update(oppositeTripRef, {
        inStation: updatedOppositeInStation,
      });

      // Update driver document to point to the new intercityTripId
      batch.update(driverRef, {
        intercityTripId: intercityTripData.oppositeTrip,
      });

      await batch.commit();
      alert('تم التبديل بنجاح إلى الاتجاه المقابل');
    } catch (err) {
      console.log('خطأ أثناء التبديل:', err);
      alert('حدث خطأ أثناء التبديل');
    } finally {
      setOppositeSwitching(false);
    }
  };
  
  //Loading trip
  if(loadingTrip || !intercityTripData || !intercityTripData.inStation) {
    return (
      <View style={styles.spinner_error_container}>
        <ActivityIndicator size="large" color={colors.PRIMARY} />
      </View>
    )
  }

  console.log('loadingTrip',loadingTrip)
  console.log('intercityTripData',intercityTripData)

  let driversBefore = intercityTripData?.inStation?.findIndex(
    (driver) => driver.id === driverData[0]?.id
  );
  
  driversBefore = driversBefore === -1 ? 0 : driversBefore;

  return (
    <View style={styles.inactiveTripBox}>
      <View style={styles.logo}>
        <Image source={logo} style={styles.logo_image}/>
      </View>
      <View style={styles.tripFromToBox}>
        <Text style={styles.tripFromToText}>{intercityTripData?.from}</Text>
        <FontAwesome name="long-arrow-left" size={12} color="black" />
        <Text style={styles.tripFromToText}>{intercityTripData?.to}</Text>
      </View>
      <View style={styles.tripStatusSectionBox}>
        <View style={styles.carsBeforeYou}>
          {driversBefore === 0 ? (
            <Text style={styles.carsBeforeYouText}>عدد الركاب 0</Text>
          ) : (
            <View style={styles.carsBeforeYouBox}>
              <Text style={styles.carsBeforeYouText}>عدد السيارات امامك</Text>
              <Text style={styles.carsBeforeYouText}>{driversBefore}</Text>
            </View>
          )}
        </View>
        <View style={styles.driverCarInfoImageBox}>
          <Image 
            source={{uri:driverData[0]?.driver_car_image}} 
            style={styles.driverCarInfoImage}
          />
        </View>
        <TouchableOpacity 
          style={styles.search_trip_btn}
          onPress={confirmSwitchTripStart}
          disabled={oppositeSwitching}
        >
          <Text style={styles.search_trip_btn_text}>
            {oppositeSwitching ? '...' : 'هل تريد تغيير نقطة البداية؟'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default InactiveTripData

const styles = StyleSheet.create({
  inactiveTripBox:{
    alignItems:'center',
  },
  logo:{
    width:'100%',
    height:180,
    alignItems:'center',
    justifyContent:'center',
  },
  logo_image:{
    height:180,
    width:180,
    resizeMode:'contain',
  },
  tripFromToBox:{
    width:200,
    height:40,
    backgroundColor:colors.WHITE,
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius:15,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-around'
  },
  tripFromToText:{
    lineHeight:30,      
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
  },
  tripStatusSectionBox:{
    flex:1,
    alignItems: 'center',
  },
  carsBeforeYou:{
    width:200,
    height:40,
    marginTop:10,
  },
  carsBeforeYouBox:{
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:10
  },
  carsBeforeYouText:{
    lineHeight:40,
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    fontSize:13,
  },
  driverCarInfoImageBox:{
    width: 200,
    height: 200,
    marginTop:10,
    marginBottom:30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  driverCarInfoImage:{
    height:'100%',
    width:'100%',
    resizeMode: 'contain',
    borderRadius: 12,
  },
  search_trip_btn:{
    width:200,
    height:50,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    justifyContent:'center',
    alignItems:'center',
  },
  search_trip_btn_text:{
    lineHeight:50,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.WHITE,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})