import React,{useState,useEffect,useRef} from 'react'
import { StyleSheet,View,ActivityIndicator,Dimensions } from 'react-native'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import { doc,onSnapshot } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import colors from '../constants/Colors'

const RiderTripMap = ({tripData,userData}) => {
    const mapRef = useRef(null)
    const markerRef = useRef(null)

    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [destination, setDestination] = useState(null)
    const [driverCurrentLocation, setDriverCurrentLocation] = useState(null)
    const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true)
    const [mapReady, setMapReady] = useState(false)

    // Fetch rider location
    useEffect(() => {
        if (tripData?.riders && userData?.id) {
        const riderDataInTrip = tripData.riders.find(r => r.rider_id === userData.id);
        if (riderDataInTrip?.location) {
            setDestination({
            latitude: riderDataInTrip.location.latitude,
            longitude: riderDataInTrip.location.longitude,
            });
        }
        }
    }, [tripData, userData?.id]);

    const animatedDriverLocation = useRef(new AnimatedRegion({
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    })).current;
    
    const markerIcon = () => {
        return(
        <Svg height={20} width={20}>
            <Circle
            cx="10"
            cy="10"
            r="10"
            fill="rgba(57, 136, 251, 0.28)"
            stroke="transparent"
            />
            <Circle
            cx="10"
            cy="10"
            r="6"
            fill="rgba(57, 137, 252, 1)"
            stroke="#fff"
            strokeWidth="2"
            />
        </Svg>
        )
    }
    
    const handleMapReady = () => {
        setMapReady(true);
    }

    // Fetch driver location
    useEffect(() => {
        const driverRef = doc(DB, 'drivers', tripData.driver_id)
          
        const unsubscribe = onSnapshot(
            driverRef,
            (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.current_location) {
                const newLocation = data.current_location;
                      
                setDriverCurrentLocation(newLocation)
        
                // Check if the driver has moved 1000 meters or more
                checkAndUpdateOriginLocation(newLocation)
                      
                // Animate driver marker to the new location
                animatedDriverLocation.timing({
                    latitude: newLocation.latitude,
                    longitude: newLocation.longitude,
                    duration: 1000,
                    useNativeDriver: false,
                }).start();
        
                setDriverCurrentLocationLoading(false)
                }
            } else {
                console.log("Driver document doesn't exist or lacks location.")
                setDriverCurrentLocationLoading(false)
            }
            },
            (error) => {
            console.error('Error fetching driver location:', error)
            setDriverCurrentLocationLoading(false)
            }
        );
          
        return () => unsubscribe();

    }, [tripData,driverCurrentLocationLoading]);
    
    // Function to check and update the origin location
    let lastOriginUpdateTime = Date.now();
      
    const checkAndUpdateOriginLocation = (currentLocation) => {
        if (!currentLocation?.latitude || !currentLocation?.longitude) {
            return;
        }
          
        if (!driverOriginLocation) {
            setDriverOriginLocation(currentLocation)
            return;
        }
      
        const now = Date.now();
        if (now - lastOriginUpdateTime < 30000) return; // Prevent updates within 30 seconds
      
        // Calculate the distance between the current location and the origin
        const distance = haversine(driverOriginLocation, currentLocation, { unit: "meter" });
        
        if (isNaN(distance)) {
            return;
        }
        
        if (distance > 400) {
            setDriverOriginLocation(currentLocation)
            lastOriginUpdateTime = now;
        }
    }
    
    // fit coordinate function
    const fitCoordinatesForCurrentTrip = () => {
        if (!mapReady || !mapRef.current || !driverOriginLocation) return;
            
        if (driverOriginLocation && destination) {
        mapRef.current.fitToCoordinates(
            [driverOriginLocation, destination],
            {
            edgePadding: { top: 120, right: 120, bottom: 120, left: 120 },
            animated: true,
            }
        );
        }
    }
        
    useEffect(() => {
        if (mapReady && driverOriginLocation && destination) {
        fitCoordinatesForCurrentTrip();
        }
    }, [mapReady,destination])
        
    // Render the Map
    const renderMap = () => (
        <MapView
        ref={mapRef}
        onMapReady={handleMapReady}
        provider="google"
        initialRegion={{
            latitude: driverCurrentLocation?.latitude || 0,
            longitude: driverCurrentLocation?.longitude || 0,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }}
        loadingEnabled={true}
        style={styles.map}
        >
        
        <Marker.Animated
            ref={markerRef}
            coordinate={animatedDriverLocation}
            title="السائق"
        >
            <View>{markerIcon()}</View>
        </Marker.Animated>
        
        {destination && (
            <Marker
            coordinate={destination}
            title="موقع الركوب"
            pinColor="red"
            />
        )}
        </MapView>
    );

  //Loading 
  if (!driverOriginLocation) {
    return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
    )
  }

  return (
    <View style={styles.map_container}>
        {renderMap()}
    </View>
  )
}

export default RiderTripMap

//get screen height
const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
    map_container:{
        width:SCwidth,
        height:SCheight,
    },
    map: {
        flex:1,
    },
    loadingBox:{
        flex:1,
        alignItems:'center',
        justifyContent:'center'
    }
})