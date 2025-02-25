import React, { createContext, useState, useEffect, useContext } from 'react'
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore'
import {DB} from '../../firebaseConfig'
import { useUser } from '@clerk/clerk-expo'

// Create the context
const EmployeeContext = createContext()

// Provider component
export const EmployeeProvider = ({ children }) => {
    const { user } = useUser()

    const [employee, setEmployee] = useState([])
    const [fetchingEmployeesLoading,setFetchingEmployeesLoading] = useState(true)
    
    const [userData, setUserData] = useState(null)
    const [fetchingUserDataLoading, setFetchingUserDataLoading] = useState(true)

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
        }
        fetchUserData()
    }, [user])

    // Fetch employee registered with the logged-in user ID
    useEffect(() => {
        if (!user) {
          setError('User is not defined');
          setFetchingEmployeesLoading(false);
          return;
        }
    
        const employeeInfoCollectionRef = collection(DB, 'employees');
        const unsubscribe = onSnapshot(
            employeeInfoCollectionRef,
            async (querySnapshot) => {
                const employeeList = querySnapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                .filter((employee) => employee.employee_user_id === user.id);
    
                setEmployee(employeeList);
                setFetchingEmployeesLoading(false);
            },
            (error) => {
                setError('Failed to load students. Please try again.');
                setFetchingEmployeesLoading(false);
            }
        );
        return () => unsubscribe();
    }, [user]);

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
        <EmployeeContext.Provider 
          value={{ 
            userData,
            fetchingUserDataLoading,              
            employee,
            fetchingEmployeesLoading,
            states,
            fetchingState,
            error 
          }}>
          {children}
        </EmployeeContext.Provider>
      );
}

// Custom hook to use driver context
export const useEmployeeData = () => {
  return useContext(EmployeeContext);
}

export default EmployeeContext;