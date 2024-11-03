import React, { createContext, useState, useEffect, useContext } from 'react';
import { collection, onSnapshot,getDocs, query,where } from 'firebase/firestore';
import {DB} from '../../firebaseConfig'
import { useUser } from '@clerk/clerk-expo';

// Create the context
const DriverContext = createContext()

// Provider component
export const DriverProvider = ({ children }) => {
  const { user } = useUser()
  const [allStudents,setAllStudents] = useState([])
  const [fetchingAllStudents,setFetchingAllStudents] = useState(true)

  const [driverData, setDriverData] = useState([])
  const [fetchingDriverDataLoading,setFetchingDriverDataLoading] = useState(true)

  const [userData, setUserData] = useState(null)
  const [fetchingUserDataLoading, setFetchingUserDataLoading] = useState(true)

  const [assignedStudents,setAssignedStudents] = useState([])
  const [fetchingAssignedStudetns,setFetchingAssignedStudetns] = useState(true)
  
  const [error, setError] = useState(null)


// Fetch driver data once
  useEffect(() => {
    if (!user) {
      setError('User is not defined')
      setFetchingDriverDataLoading(false)
      return;
    }

    const driverInfoCollectionRef = collection(DB, 'drivers')
    const unsubscribe = onSnapshot(
      driverInfoCollectionRef,
      (querySnapshot) => {
        const driverList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((driver) => driver.driver_user_id === user.id);

        setDriverData(driverList)
        setFetchingDriverDataLoading(false)
      },
      (error) => {
        setError('Failed to load drivers. Please try again.')
        setFetchingDriverDataLoading(false)
      }
    );

    return () => unsubscribe();
  }, [user]);


// Fetch user data once
useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userInfoCollectionRef = collection(DB, 'users')
          const q = query(userInfoCollectionRef , where('user_id', '==', user.id))
          const userInfoSnapshot = await getDocs(q)

          if (!userInfoSnapshot.empty) {
            const userData = userInfoSnapshot.docs[0].data();
            setUserData(userData);
          } else {
            setError('No user data found');
          }
        } catch (error) {
          setError('Failed to load user data. Please try again.');
        } finally {
            setFetchingUserDataLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user]);


//Fetching All students
  useEffect(() => {
    if(!user) {
      setError('User is not defined')
      setFetchingAllStudents(false)
      return;
    }

    const studentInfoCollectionRef = collection(DB, 'students')
    const unsubscribe = onSnapshot(
      studentInfoCollectionRef,
      async(querySnapshot) => {
        const studentList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setAllStudents(studentList)
          setFetchingAllStudents(false)
        }
    )
    return () => unsubscribe();
  },[user,driverData])


//Fetching Assigned Students
  useEffect(() => {  
     
    if(!user) {
      setError('User is not defined')
      setFetchingAssignedStudetns(false)
      return;
    }

    const studentsQuery = query(collection(DB,'students'),where('driver_id', '==', user.id))
    const unsubscribe = onSnapshot(
      studentsQuery,
      (querySnapshot) => {
        const studentsList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setAssignedStudents(studentsList)
          setFetchingAssignedStudetns(false)
      },
      (error) => {
        setError('Failed to load drivers. Please try again.');
        setFetchingAssignedStudetns(false);
      }
    )
    return () => unsubscribe();
    
  }, [user,allStudents])


  return (
    <DriverContext.Provider value={{ 
      userData,
      fetchingUserDataLoading,
      driverData, 
      fetchingDriverDataLoading,
      allStudents, 
      fetchingAllStudents,
      assignedStudents,
      fetchingAssignedStudetns,
      error }}>
      {children}
    </DriverContext.Provider>
  );
};

// Custom hook to use driver context
export const useDriverData = () => {
  return useContext(DriverContext);
};
