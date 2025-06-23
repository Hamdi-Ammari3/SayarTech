import React, { createContext, useState, useEffect, useContext } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import {DB} from '../../firebaseConfig'
import { useUser } from '@clerk/clerk-expo'

// Create the context
const RiderContext = createContext()

// Provider component
export const RiderProvider = ({ children }) => {
    const { user } = useUser()

    const [userData, setUserData] = useState(null)
    const [fetchingUserDataLoading, setFetchingUserDataLoading] = useState(true)

    const [rider, setRider] = useState([])
    const [fetchingRiderLoading,setFetchingRiderLoading] = useState(true)

    const [intercityTrips,setInterCityTrips] = useState([])
    const [fetchingIntercityTrips,setFetchingIntercityTrips] = useState(false)
      
    const [error, setError] = useState(null)

    // Fetch user data once with real-time updates
    useEffect(() => {
        if (!user) {
            setError('User is not defined');
            setFetchingUserDataLoading(false);
            return;
        }

        const userInfoCollectionRef = collection(DB, 'users');
        const q = query(userInfoCollectionRef, where('user_id', '==', user.id));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    const userDataWithId = {
                        id: userDoc.id,
                        ...userDoc.data(),
                    };
                    setUserData(userDataWithId);
                } else {
                    setError('No user data found');
                }
                setFetchingUserDataLoading(false);
            },
            (error) => {
                console.error('Error fetching user data:', error);
                setError('Failed to load user data. Please try again.');
                setFetchingUserDataLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);


    // Fetch riders registered with the logged-in user ID
    useEffect(() => {
        if (!user) {
          setError('User is not defined');
          setFetchingRiderLoading(false);
          return;
        }
    
        const riderInfoCollectionRef = collection(DB, 'riders');
        const unsubscribe = onSnapshot(
            riderInfoCollectionRef,
            async (querySnapshot) => {
                const riderList = querySnapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                .filter((rider) => rider.user_id === user.id);
    
                setRider(riderList);
                setFetchingRiderLoading(false);
            },
            (error) => {
                setError('Failed to load students. Please try again.');
                setFetchingRiderLoading(false);
            }
        );
        return () => unsubscribe();
    }, [user])

    // Fetch intercity trips
    useEffect(() => {
        const linesInfoCollectionRef = collection(DB, 'intercityTrips')
        const unsubscribe = onSnapshot(
            linesInfoCollectionRef,
            async(querySnapshot) => {
                const linesList = querySnapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                setInterCityTrips(linesList)
                setFetchingIntercityTrips(false)
            }
        )
    return () => unsubscribe();
  },[])

    return (
        <RiderContext.Provider
          value={{ 
            userData,
            fetchingUserDataLoading,              
            rider,
            fetchingRiderLoading,
            intercityTrips,
            fetchingIntercityTrips,
            error 
          }}>
          {children}
        </RiderContext.Provider>
    )
}

// Custom hook to use driver context
export const useRiderData = () => {
  return useContext(RiderContext);
}

export default RiderContext;