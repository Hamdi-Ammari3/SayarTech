import { createContext,useState,useEffect,useContext } from 'react'
import { collection,onSnapshot } from 'firebase/firestore'
import {DB} from '../../firebaseConfig'

// Create the context
const LinesContext = createContext()

// Provider component
export const LinesProvider = ({ children }) => {
  
    const [lines,setLines] = useState([])
    const [fetchingLinesLoading,setFetchingLinesLoading] = useState(false)

    // Fetch lines data 
    useEffect(() => {
        const linesInfoCollectionRef = collection(DB, 'lines')
        const unsubscribe = onSnapshot(
            linesInfoCollectionRef,
            async(querySnapshot) => {
                const linesList = querySnapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                setLines(linesList)
                setFetchingLinesLoading(false)
            }
        )
        return () => unsubscribe();
    },[])

  return (
    <LinesContext.Provider value={{ 
      lines,
      fetchingLinesLoading
    }}>
      {children}
    </LinesContext.Provider>
  );
};

// Custom hook to use driver context
export const useLinesData = () => {
  return useContext(LinesContext);
};

export default LinesContext;
