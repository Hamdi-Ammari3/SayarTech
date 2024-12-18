import React, { createContext, useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import {DB} from '../../firebaseConfig'
import { useUser } from '@clerk/clerk-expo';

// Create the context
const StudentContext = createContext()

// Provider component
export const StudentProvider = ({ children }) => {
  const { user } = useUser()

  const [students, setStudents] = useState([])
  const [fetchingStudentsLoading,setFetchingStudentsLoading] = useState(true)

  const [userData, setUserData] = useState(null)
  const [fetchingUserDataLoading, setFetchingUserDataLoading] = useState(true)
 
  const [schools, setSchools] = useState(null)
  const [fetchingSchoolsLoading, setFetchingSchoolsLoading] = useState(true)

  const [states, setStates] = useState(null)
  const [fetchingState, setFetchingState] = useState(true)
  
  const [error, setError] = useState(null)

  // Fetch user data once
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userInfoCollectionRef = collection(DB, 'users')
          const q = query(userInfoCollectionRef , where('user_id', '==', user.id))
          const userInfoSnapshot = await getDocs(q);

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

    fetchUserData()
  }, [user])

  // Fetch students registered with the logged-in user ID
  useEffect(() => {
    if (!user) {
      setError('User is not defined');
      setFetchingStudentsLoading(false);
      return;
    }

    const studentInfoCollectionRef = collection(DB, 'students');
    const unsubscribe = onSnapshot(
      studentInfoCollectionRef,
      async (querySnapshot) => {
        const studentList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((student) => student.student_user_id === user.id);

        setStudents(studentList);
        setFetchingStudentsLoading(false);

      },
      (error) => {
        setError('Failed to load students. Please try again.');
        setFetchingStudentsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);


  // Fetch School data 
  useEffect(() => {
    const schoolInfoCollectionRef = collection(DB, 'schools')
    const unsubscribe = onSnapshot(
      schoolInfoCollectionRef,
      async(querySnapshot) => {
        const schoolList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setSchools(schoolList)
          setFetchingSchoolsLoading(false)
        }
    )
    return () => unsubscribe();
  },[])

  
  //Fetch State data
  useEffect(() => {
    const schoolInfoCollectionRef = collection(DB, 'states')
    const unsubscribe = onSnapshot(
      schoolInfoCollectionRef,
      async(querySnapshot) => {
        const stateList = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setStates(stateList)
          setFetchingState(false)
      }
    )
    return () => unsubscribe();
  }, []);

  return (
    <StudentContext.Provider 
      value={{ 
        userData,
        fetchingUserDataLoading,              
        students,
        fetchingStudentsLoading,
        schools,
        fetchingSchoolsLoading,
        states,
        fetchingState,
        error 
      }}>
      {children}
    </StudentContext.Provider>
  );
};

// Custom hook to use driver context
export const useStudentData = () => {
  return useContext(StudentContext);
};