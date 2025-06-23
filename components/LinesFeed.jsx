import {useState,useEffect} from 'react'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,FlatList,Modal,Platform } from 'react-native'
import haversine from 'haversine'
import Checkbox from 'expo-checkbox'
import DateTimePicker from '@react-native-community/datetimepicker'
import { doc,writeBatch,onSnapshot,collection,arrayUnion,getDoc,Timestamp,getDocs } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import { Dropdown } from 'react-native-element-dropdown'
import dayjs from "dayjs"
import colors from '../constants/Colors'
import AntDesign from '@expo/vector-icons/AntDesign'

const LinesFeed = ({rider}) => {
    const [institutions, setInstitutions] = useState([])
    const [fetchingInstitutions, setFetchingInstitutions] = useState(true)
    const [groupedLines,setGroupedLines] = useState([])
    const [lines,setLines] = useState(null)
    const [fetchingLinesLoading,setFetchingLinesLoading] = useState(false)
    const [lineCarType,setLineCarType] = useState('')
    const [showAddNewLineModal,setShowAddNewLineModal] = useState(false)
    const [addNewlineCarType,setAddNewLineCarType] = useState('')
    const [pickerVisible, setPickerVisible] = useState(false)
    const [currentPicker, setCurrentPicker] = useState({ day: null, field: null })
    const [pickerTime, setPickerTime] = useState(new Date())
    const [firstDayTimes, setFirstDayTimes] = useState(null)
    const [addingNewLineLoading,setAddingNewLineLoading] = useState(false)
    const [joiningLineLoading,setJoiningLineLoading] = useState(false)

    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
    }

    //Fetch B2B institutions
    useEffect(() => {
        const fetchInstitutions = async () => {
            try {
                const snapshot = await getDocs(collection(DB, 'institutions'));
                const fetchedInstitutions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setInstitutions(fetchedInstitutions);
            } catch (error) {
                console.log("Failed to fetch institutions:", error);
            } finally {
                setFetchingInstitutions(false);
            }
        };

        fetchInstitutions();
    }, [])

    // Fetch lines data 
    useEffect(() => {
        if (!rider || rider.line_id) return;
    
        const fetchLines = () => {
            setFetchingLinesLoading(true)
            try {
                const linesInfoCollectionRef = collection(DB, 'lines');
                const unsubscribe = onSnapshot(linesInfoCollectionRef, (querySnapshot) => {
                    const eligibleLines = querySnapshot.docs
                    ?.map((doc) => {
                        const data = doc.data();
                        const currentRidersCount = data.riders ? data.riders?.length : 0;
                        return {
                            id: doc.id,
                            ...data,
                            currentRidersCount,
                        };
                    })
                    .filter((line) => {
                        const sameDestination = line.destination === rider.destination
                        const hasFreeSeats = line.currentRidersCount < line.seats_capacity
                        const riderAge = getAgeFromBirthDate(rider.birth_date)
                        const isAgeInRange = riderAge >= line.age_range?.minAge && riderAge <= line.age_range?.maxAge

                        const riderLocation = {
                            latitude: rider.home_location?.latitude,
                            longitude: rider.home_location?.longitude,
                        }
    
                        const lineCenter = {
                            latitude: line.center_point_location?.latitude,
                            longitude: line.center_point_location?.longitude,
                        }
    
                        // check the distance range
                        const distance = haversine(riderLocation, lineCenter, { unit: 'km' });
                        const isWithinDistanceRange = distance <= 3;
                        
                        return sameDestination && hasFreeSeats && isAgeInRange && isWithinDistanceRange;
                    });
    
                    // Group by line_type
                    const grouped = eligibleLines.reduce((acc, line) => {
                        const type = line.line_type;
                        if (!acc[type]) acc[type] = [];
                        acc[type].push(line);
                        return acc;
                    }, {});
    
                    // Convert object to array format for FlatList
                    const groupedArray = Object.entries(grouped)
                    setGroupedLines(groupedArray)
                    setLines(eligibleLines)
                    setFetchingLinesLoading(false)
                });
                return () => unsubscribe()
            } catch (error) {
                setFetchingLinesLoading(false)
            }
        }
        fetchLines()
    }, [rider]);

    //Line Car type array
    const lineCars = [
        {name: 'صالون'},
        {name:'ميني باص ١٢ راكب'},
        {name:'ميني باص ١٨ راكب'},
    ]

    // line time table
    const [schoolTimetable, setSchoolTimetable] = useState([
        { dayIndex:0,day: "الأحد", active: false, startTime: null, endTime: null },
        { dayIndex:1,day: "الاثنين", active: false, startTime: null, endTime: null },
        { dayIndex:2,day: "الثلاثاء", active: false, startTime: null, endTime: null },
        { dayIndex:3,day: "الأربعاء", active: false, startTime: null, endTime: null },
        { dayIndex:4,day: "الخميس", active: false, startTime: null, endTime: null },
        { dayIndex:5,day: "الجمعة", active: false, startTime: null, endTime: null },
        { dayIndex:6,day: "السبت", active: false, startTime: null, endTime: null },
    ]);

    // Open the time-table picker
    const handleTimeSelect = (day, field) => {
        const selectedDay = schoolTimetable.find((item) => item.day === day);

        // Use the existing time or fallback to the current time
        const initialTime = selectedDay[field] ? new Date(selectedDay[field]) : new Date();

        // Set a neutral base date for consistent handling
        initialTime.setFullYear(2000, 0, 1);

        setPickerTime(initialTime);
        setCurrentPicker({ day, field });
        setPickerVisible(true);
    };

    // Handle picker time change
    const handlePickerChange = (event, selectedTime) => {
        if (Platform.OS === "ios") {
          if (selectedTime) {
            const neutralTime = new Date(selectedTime);
            neutralTime.setFullYear(2000, 0, 1);
            setPickerTime(neutralTime);
          }
        } else if (event.type === "set" && selectedTime) {
          setPickerVisible(false);
          const neutralTime = new Date(selectedTime);
          neutralTime.setFullYear(2000, 0, 1);
          setPickerTime(neutralTime);
    
          setSchoolTimetable((prev) =>
            prev?.map((item) =>
              item.day === currentPicker.day
                ? { ...item, [currentPicker.field]: neutralTime }
                : item
            )
          )
        }
    };

    // Confirm time-table selection (for iOS)
    const confirmPickerSelection = () => {
        if (pickerTime) {
            setSchoolTimetable((prev) =>
                prev?.map((item) =>
                item.day === currentPicker.day
                    ? { ...item, [currentPicker.field]: pickerTime }
                    : item
                )
            );
            setPickerVisible(false);
        }
    };

    // Select active days
    const toggleDayActive = (dayId) => {
        const updatedTimetable = schoolTimetable?.map((item) => {
            if (item.dayIndex === dayId) {
                // Reset startTime and endTime when day is deselected
                return item.active
                ? { ...item, active: false, startTime: null, endTime: null }
                : { ...item, active: true }; // Keep times intact if re-activating
            }
            return item;
        });
        setSchoolTimetable(updatedTimetable);
    };

    // Track the first day times select for copy to all btn
    useEffect(() => {
        const firstDayWithTimes = schoolTimetable.find(
          (item) => item.startTime && item.endTime
        );
        if (firstDayWithTimes) {
          setFirstDayTimes({
            startTime: new Date(firstDayWithTimes.startTime),
            endTime: new Date(firstDayWithTimes.endTime),
          });
        } else {
          setFirstDayTimes(null); // Clear the state if no valid day is found
        }
    }, [schoolTimetable]);

    // Utility function to format time as HH:mm
    const formatTime = (date) => {
        if (!(date instanceof Date) || isNaN(date)) return "00:00"; // Fallback for invalid dates
        const hours = date.getHours()?.toString().padStart(2, "0");
        const minutes = date.getMinutes()?.toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    };

    // School time-table component
    const SchoolTimetableComponent = ({ timetable, onUpdate, onTimeSelect }) => {    
        return (
            <FlatList
                data={timetable}
                keyExtractor={(item) => item.dayIndex}
                extraData={timetable} 
                contentContainerStyle={styles.flatList_style}
                renderItem={({ item }) => (
                    <View style={styles.dayRow}>
                        <Checkbox
                            style={styles.checkbox}
                            value={item.active}
                            onValueChange={() => toggleDayActive(item.dayIndex)}
                            color={item.active ? '#16B1FF' : undefined}
                        />
                        <Text style={styles.dayText}>{item.day}</Text>
                        <TouchableOpacity
                            style={[styles.timeInput, !item.active && styles.disabledInput]}
                            onPress={() => {
                                if (item.active) {
                                    onTimeSelect(item.day, "startTime");
                                }
                            }}
                            disabled={!item.active}
                        >
                            <Text style={[styles.timeText, item.active && styles.activeTimeText]}>
                                {item.active && item.startTime ? formatTime(item.startTime) : "الدخول"}
                            </Text>
                        </TouchableOpacity>
    
                        <Text style={styles.timeSeparator}>-</Text>
                        <TouchableOpacity
                            style={[styles.timeInput, !item.active && styles.disabledInput]}
                            onPress={() => {
                                if (item.active) {
                                    onTimeSelect(item.day, "endTime");
                                }
                            }}
                            disabled={!item.active}
                        >
                            <Text style={[styles.timeText, item.active && styles.activeTimeText]}>
                                {item.active && item.endTime ? formatTime(item.endTime) : "الخروج"}
                            </Text>
                        </TouchableOpacity>
    
                    </View>
                )}
            />
        );
    };

    // Check if there is active days to render the copy to all btn
    const hasActiveDays = schoolTimetable.some((item) => item.active);

    //Open add new line modal
    const openAddNewLineModal = () => {
        setShowAddNewLineModal(true)
    }

    //Close add new line modal
    const closeAddNewLineModal = () => {
        setShowAddNewLineModal(false)
        setAddNewLineCarType('')
        setSchoolTimetable([
            { dayIndex:0,day: "الأحد", active: false, startTime: null, endTime: null },
            { dayIndex:1,day: "الاثنين", active: false, startTime: null, endTime: null },
            { dayIndex:2,day: "الثلاثاء", active: false, startTime: null, endTime: null },
            { dayIndex:3,day: "الأربعاء", active: false, startTime: null, endTime: null },
            { dayIndex:4,day: "الخميس", active: false, startTime: null, endTime: null },
            { dayIndex:5,day: "الجمعة", active: false, startTime: null, endTime: null },
            { dayIndex:6,day: "السبت", active: false, startTime: null, endTime: null },
        ]);
    }

    //Line age Range
    const getAgeRange = (age) => {
        if (age < 6) return { minAge: 0, maxAge: 5 };
        if (age <= 12) return { minAge: 6, maxAge: 12 };
        if (age <= 15) return { minAge: 13, maxAge: 15 };
        if (age <= 18) return { minAge: 16, maxAge: 18 };
        return { minAge: 19, maxAge: 999 };
    }

    //Line seat capacity
    const getSeatsCapacity = (carType, ageRange) => {
        const config = {
            'صالون': {
                '0-5': 5, '6-12': 5, '13-15': 5, '16-18': 4, '19-100': 4,
            },
            'ميني باص ١٢ راكب': {
                '0-5': 14, '6-12': 14, '13-15': 14, '16-18': 12, '19-100': 12,
            },
            'ميني باص ١٨ راكب': {
                '0-5': 20, '6-12': 20, '13-15': 20, '16-18': 18, '19-100': 18,
            },
        };

        const key = `${ageRange.minAge}-${ageRange.maxAge}`;
        return config[carType]?.[key] || 5;
    }

    // Get age from birthdate 
    const getAgeFromBirthDate = (birthdate) => {
        const birthDate = new Date(birthdate.seconds * 1000); // Convert Firestore Timestamp to JS Date
        const today = new Date();
    
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();
  
        // Adjust age if the current date is before the birthdate this year
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
  
        return age;
    }

    const pricingCarTypeCategory = (arabicType) => {
        if (arabicType === "صالون") return "salon";
        if (arabicType.includes("ميني باص")) return "mini_bus";
        return "salon";
    };

    const getPricingBracket = (distanceKm) => {
        if (distanceKm <= 2) return "0-2";
        if (distanceKm <= 5) return "3-5";
        if (distanceKm <= 8) return "6-8";
        if (distanceKm <= 11) return "9-11";
        if (distanceKm <= 14) return "12-14";
        if (distanceKm <= 19) return "15-19";
        if (distanceKm <= 39) return "20-39";
        if (distanceKm <= 69) return "40-69";
        return "70-1000";
    };

    //Create new line
    const createNewLine = async () => {
        if (!rider) return createAlert('المستخدم غير معرف');
        if(!addNewlineCarType) return createAlert('يرجى تحديد نوع الخط');
        if (!firstDayTimes) return createAlert("يرجى ادخال الجدول الزمني");
    
        const incompleteTimetable = schoolTimetable.find(
          (entry) => entry.active && (!entry.startTime || !entry.endTime)
        )
        if (incompleteTimetable) {
          return createAlert(`يرجى تحديد وقت الدخول والخروج ليوم ${incompleteTimetable.day}`);
        }
    
        setAddingNewLineLoading(true)

        try {
    
            // Prevent duplicate lines
            const duplicateLine = lines.find((line) => {
                const sameCarType = line.line_type === addNewlineCarType;
                const sameDestination = line.destination === rider.destination;
          
                const sameTimetable =
                    line.timeTable.length === schoolTimetable.length &&
                    line.timeTable.every((entry, index) => {
                        const newEntry = schoolTimetable[index];
    
                        // Convert newEntry times from Date to seconds (timestamp format)
                        const newStartSeconds = newEntry.startTime instanceof Date
                            ? Math.floor(newEntry.startTime.getTime() / 1000)
                            : newEntry.startTime?.seconds ?? null;
    
                        const newEndSeconds = newEntry.endTime instanceof Date
                            ? Math.floor(newEntry.endTime.getTime() / 1000)
                            : newEntry.endTime?.seconds ?? null;
    
                        const entryStartSeconds = entry.startTime?.seconds ?? null;
                        const entryEndSeconds = entry.endTime?.seconds ?? null;
    
                        return (
                            entry.dayIndex === newEntry.dayIndex &&
                            entry.active === newEntry.active &&
                            entryStartSeconds === newStartSeconds &&
                            entryEndSeconds === newEndSeconds
                        );
                    });
                return sameCarType && sameDestination && sameTimetable;
            });
    
            if (duplicateLine) {
                return createAlert('يوجد خط بنفس الوجهة ونوع السيارة والجدول الزمني، يمكنك الانضمام إليه .');
            }

            const pricingDoc = await getDoc(doc(DB, 'pricing', 'aYSYZAcfqPIWtgZcgjAG'));
            if (!pricingDoc.exists()) {
                return createAlert('❌ لم يتم العثور على جدول التسعير.');
            }
    
            // Generate rider age,age_range,seats capcity and subs fee
            const riderAge  = getAgeFromBirthDate(rider.birth_date);
            const ageRange = getAgeRange(riderAge);
            const seatsCapacity = getSeatsCapacity(addNewlineCarType,ageRange);
            const lineName = rider.destination.split(' ').slice(0, 2).join(' ');
            const pricingAgeKey = riderAge <= 15 ? "0-15" : "16-999";
            const pricingCarTypeKey = pricingCarTypeCategory(addNewlineCarType);
            const pricingDistanceKey = getPricingBracket(Math.floor(rider.distance));
            const pricingData = pricingDoc.data();
            const driverCommission = pricingData[pricingAgeKey]?.[pricingCarTypeKey]?.[pricingDistanceKey];

            if (!driverCommission) {
                return createAlert('❌ تعذر حساب السعر بناءً على العمر والمسافة.');
            }

            const isInstitutionRider = institutions.some(inst => inst.name === rider.destination)

            // Define commissions
            const companyCommission = 6000;

            const totalLineCost = driverCommission + companyCommission;

            // Get user account to check balance
            const userRef = doc(DB, 'users', rider.user_doc_id);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                return createAlert('❌ تعذر العثور على حساب المستخدم.');
            }

            const userData = userSnap.data();
            const currentBalance = userData.account_balance || 0;

            if (!isInstitutionRider && currentBalance < totalLineCost) {
                return createAlert(`الرصيد غير كافٍ لإنشاء الخط. المبلغ المطلوب هو ${totalLineCost.toLocaleString()} د.ع. يرجى تعبئة الرصيد.`);
            }

            // Prepare rider data to store in line
            const riderData = {
                name: rider.full_name,
                family_name: rider.family_name,
                id: rider.id,
                birth_date: rider.birth_date,
                phone_number: rider.phone_number,
                notification_token: rider.user_notification_token,
                home_address: rider.home_address,
                home_location: {
                    latitude: rider.home_location.latitude,
                    longitude: rider.home_location.longitude,
                },
                driver_commission: driverCommission || 50000,
                company_commission:6000
            };
    
            // Passed all checks — Proceed with adding the new line
            const newLine = {
                name:lineName,
                destination: rider.destination,
                destination_location:rider.destination_location,
                driver_id:null,
                driver_notification_token:null,
                driver_phone_number:null,
                line_type: addNewlineCarType,
                timeTable: schoolTimetable,
                riders: [riderData],
                seats_capacity: seatsCapacity,
                age_range: ageRange,
                center_point_location: {
                    latitude: rider.home_location.latitude,
                    longitude: rider.home_location.longitude,
                },
                standard_driver_commission: driverCommission || 50000,
                standard_company_commission:6000
            }

            const lineRef = doc(collection(DB, 'lines'))
            const riderRef = doc(DB, 'riders', rider.id)
    
            const batch = writeBatch(DB)
    
            // Save the new line
            batch.set(lineRef, newLine)
    
            // Update the rider with the new line ID
            batch.update(riderRef, {
                line_id: lineRef.id,
                temporary_hold_amount: isInstitutionRider ? 0 : totalLineCost,
                driver_commission: driverCommission || 50000,
                company_commission:6000
            });

            // Deduct from user's account balance
            if (!isInstitutionRider) {
                batch.update(userRef, {
                    account_balance: currentBalance - totalLineCost,
                });
            }
    
            await batch.commit();
            createAlert('تم إنشاء الخط بنجاح');
        } catch (err) {
            createAlert('حدث خطأ أثناء إنشاء الخط');
        } finally{
            setAddingNewLineLoading(false)
            setShowAddNewLineModal(false)
            setAddNewLineCarType('')
            setSchoolTimetable([
                { dayIndex:0,day: "الأحد", active: false, startTime: null, endTime: null },
                { dayIndex:1,day: "الاثنين", active: false, startTime: null, endTime: null },
                { dayIndex:2,day: "الثلاثاء", active: false, startTime: null, endTime: null },
                { dayIndex:3,day: "الأربعاء", active: false, startTime: null, endTime: null },
                { dayIndex:4,day: "الخميس", active: false, startTime: null, endTime: null },
                { dayIndex:5,day: "الجمعة", active: false, startTime: null, endTime: null },
                { dayIndex:6,day: "السبت", active: false, startTime: null, endTime: null },
            ]);
        }
    }

    // Handle notification sending
    const sendNotification = async (token, title, body) => {
        try {
            const message = {
                to: token,
                sound: 'default',
                title: title,
                body: body 
            };

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });
      
        } catch (error) {
            console.log("Error sending notification:", error);
        }
    }

    //Join a Line
    const joinLine = async(line) => {
        if (!rider || !line) return createAlert('المستخدم أو الخط غير معرف');
        setJoiningLineLoading(true)
    
        try {
            const riderRef = doc(DB, 'riders', rider.id)
            const lineRef = doc(DB, 'lines', line.id)
            const userRef = doc(DB, 'users', rider.user_doc_id)
    
            const batch = writeBatch(DB)

            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                return createAlert('❌ تعذر العثور على حساب المستخدم.');
            }
            const userData = userSnap.data();
            const currentBalance = userData.account_balance || 0;

            // Check if rider is from an institution
            const isInstitutionRider = institutions.some(inst => inst.name === line.destination);

            const driverCommission = line.standard_driver_commission || 50000;
            const companyCommission = line.standard_company_commission || 6000;
            const totalLineCost = driverCommission + companyCommission;

            if (!isInstitutionRider && currentBalance < totalLineCost) {
                return createAlert(`الرصيد غير كافٍ للانضمام لهذا الخط. المبلغ المطلوب هو ${totalLineCost.toLocaleString()} د.ع. يرجى تعبئة الرصيد.`);
            }
    
            // Prepare rider data to add to line
            const riderData = {
                name: rider.full_name,
                family_name: rider.family_name,
                id: rider.id,
                birth_date: rider.birth_date,
                phone_number: rider.phone_number,
                notification_token: rider.user_notification_token,
                home_address: rider.home_address,
                home_location: {
                    latitude: rider.home_location.latitude,
                    longitude: rider.home_location.longitude,
                },
                driver_commission: driverCommission,
                company_commission:companyCommission
            };    
    
            // If line has a driver assigned, push rider to driver.lines
            if (line.driver_id) {
                const now = new Date();
                let end = new Date();

                if(isInstitutionRider) {
                    const currentYear = now.getFullYear()
                    const endYear = now.getMonth() >= 5 ? currentYear + 1 : currentYear
                    end = new Date(endYear, 5, 15);
                } else {
                    end.setDate(now.getDate() + 30);
                }
                
                const startTimestamp = Timestamp.fromDate(now);
                const endTimestamp = Timestamp.fromDate(end);

                riderData.service_period = {
                    start_date: startTimestamp,
                    end_date: endTimestamp,
                };

                const driverRef = doc(DB, 'drivers', line.driver_id);
    
                // 1 pdate line's riders array
                batch.update(lineRef, {
                    riders: arrayUnion(riderData)
                });
    
                // 2 Update driver's lines array
                const driverSnap = await getDoc(driverRef);
                if (!driverSnap.exists()) return createAlert('❌ لم يتم العثور على السائق.');
                const driverData = driverSnap.data();
                const driverLines = driverData.lines || [];

                const updatedLines = driverLines.map(l => {
                    if (l.id === line.id) {
                        const exists = l.riders?.some(r => r.id === rider.id);
                        if (!exists) {
                            return {
                                ...l,
                                riders: [...(l.riders || []), riderData]
                            };
                        }
                    }
                    return l;
                });

                batch.update(driverRef, {
                    lines: updatedLines
                });
    
                // 3 Update rider document with driver_id
                batch.update(riderRef, {
                    line_id: line.id,
                    driver_id: line.driver_id,
                    driver_commission: driverCommission,
                    company_commission:companyCommission,
                    service_period: {
                        start_date: startTimestamp,
                        end_date: endTimestamp,
                    },
                });

                //Send notification (if token exists)
                if (line.driver_notification_token) {
                    await sendNotification(
                        line.driver_notification_token,
                        "راكب جديد",
                        `${line.name} راكب جديد انضم إلى الخط`
                    );
                }
            } else {
                //Push rider to line's riders array
                batch.update(lineRef, {
                    riders: arrayUnion(riderData)
                });
    
                //Update rider document with line_id
                batch.update(riderRef, {
                    line_id: line.id,
                    driver_commission: driverCommission,
                    company_commission:companyCommission,
                    temporary_hold_amount: isInstitutionRider ? 0 : totalLineCost
                });
            }

            // Deduct from user's account balance
            if(!isInstitutionRider) {
                batch.update(userRef, {
                    account_balance: currentBalance - totalLineCost,
                })
            }
    
            await batch.commit();
            createAlert('تم الانضمام إلى الخط بنجاح');
        } catch (error) {
            createAlert('حدث خطأ أثناء الانضمام إلى الخط');
        } finally {
            setJoiningLineLoading(false)
        }
    }

    //Format line age range text
    const formatAgeRangeText = (ageRange) => {
        const { minAge, maxAge } = ageRange;

        if (minAge === 0 && maxAge === 5) {
            return 'أقل من 6 سنوات';
        }

        if (minAge === 19 && maxAge === 999) {
            return 'أكبر من 18 سنة';
        }

        return `من ${minAge} إلى ${maxAge} سنة`;
    };

    // Fomrmat line total subs amount
    const formatTotalSubscriptionFee = (driverCom,companyCom) => {
        const total = driverCom + companyCom;

        return total.toLocaleString('ar-IQ', {
        style: 'currency',
        currency: 'IQD',
        minimumFractionDigits: 0,
        });
    };

    //Loading ...
    if (fetchingLinesLoading || fetchingInstitutions) {
        return(
            <View style={styles.loading_container}>
                <ActivityIndicator size="large" color={colors.PRIMARY} />
            </View>
        )
    }

    return (
        <View style={styles.lines_container}>
            <View style={styles.lines_pick_type_and_add_line}>
                <Dropdown
                    style={styles.dropdown}
                    placeholderStyle={styles.dropdownStyle}
                    selectedTextStyle={styles.dropdownStyle}
                    itemTextStyle={styles.dropdownTextStyle}
                    data={lineCars}
                    labelField="name"
                    valueField="name"
                    placeholder= 'نوع الخط'
                    value={lineCarType}
                    onChange={item => setLineCarType(item.name)}
                />
                <TouchableOpacity 
                    style={styles.add_new_line_button} 
                    onPress={openAddNewLineModal}
                >
                    <Text style={styles.add_new_line_button_text}>ابدا خط جديد</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={groupedLines.filter(([type]) =>
                    lineCarType ? type === lineCarType : true
                )}
                keyExtractor={([type]) => type}
                contentContainerStyle={styles.available_lines_flatList_style}
                renderItem={({ item: [type, lines] }) => (
                    <View style={styles.lines_group}>
                        <Text style={styles.lines_group_text}>{type} ({lines?.length})</Text>
                        {lines?.map((line,index) => (
                            <View key={index} style={styles.line_data_box}>
                                <View style={styles.line_data_box_title}>
                                    <Text style={styles.line_data_text}>{line.name}</Text>
                                    <Text style={styles.line_age_data_text}>
                                        ({formatAgeRangeText(line.age_range)})
                                    </Text>                              
                                </View>   
                                <View style={styles.line_data_box_title}>
                                    <Text style={styles.line_data_text}>الاشتراك الشهري   </Text>
                                    <Text style={styles.line_age_data_text}>
                                        {formatTotalSubscriptionFee(line.standard_driver_commission,line.standard_company_commission)}
                                    </Text>  
                                </View>                         
                                <View style={styles.line_startTime_container}>   
                                    {line.timeTable?.map(li => (
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
                                <TouchableOpacity 
                                    style={styles.join_this_line_button}
                                    onPress={() => joinLine(line)}
                                    disabled={joiningLineLoading}
                                >
                                    <Text style={styles.join_this_line_button_text}>{joiningLineLoading ? '...' : 'انضم إلى هذا الخط'}</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.no_lines_under_this_type}>
                        <Text style={styles.no_lines_under_this_type_text}>لا يوجد خطوط</Text>
                    </View>
                )}
            />
            <Modal
                animationType="fade"
                transparent={true} 
                visible={showAddNewLineModal} 
                onRequestClose={() => setShowAddNewLineModal(false)}
            >
                <View style={styles.modal_container}>
                    <View style={styles.modal_box}>
                        <View style={styles.modal_header}>
                            <TouchableOpacity 
                                onPress={closeAddNewLineModal}
                                disabled={addingNewLineLoading}
                            >
                                <AntDesign name="closecircleo" size={24} color="gray" />
                            </TouchableOpacity>
                        </View>                   
                        <View style={styles.modal_main}>
                            <Text style={styles.modal_main_text}>{rider.destination}</Text>
                            <Dropdown
                                style={styles.add_new_line_dropdown}
                                placeholderStyle={styles.add_new_line_dropdownStyle}
                                selectedTextStyle={styles.add_new_line_dropdownStyle}
                                itemTextStyle={styles.add_new_line_dropdownTextStyle}
                                data={lineCars}
                                labelField="name"
                                valueField="name"
                                placeholder= 'نوع الخط'
                                value={addNewlineCarType}
                                onChange={item => setAddNewLineCarType(item.name)}
                            />
                            <View style={styles.worktimeContainer}>
                                <SchoolTimetableComponent
                                    timetable={schoolTimetable}
                                    onUpdate={setSchoolTimetable}
                                    onTimeSelect={handleTimeSelect}
                                />
                                {pickerVisible && (
                                    Platform.OS === "ios" ? (
                                        <Modal transparent animationType="slide" visible={pickerVisible}>
                                            <View style={styles.modalContainer}>
                                                <View style={styles.pickerContainer}>
                                                    <DateTimePicker
                                                        value={pickerTime || new Date()}
                                                        mode='time'
                                                        display="spinner"
                                                        onChange={handlePickerChange}
                                                        is24Hour={false}
                                                        minimumDate={new Date(1980, 0, 1)}
                                                        maximumDate={new Date(new Date().getFullYear() - 1, 0, 1)}
                                                    />
                                                    <TouchableOpacity onPress={confirmPickerSelection} style={styles.doneButton}>
                                                        <Text style={styles.doneButtonText}>تأكيد</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </Modal>
                                    ) : (
                                        <DateTimePicker
                                            value={pickerTime}
                                            mode="time"
                                            display='spinner'
                                            onChange={handlePickerChange}
                                            is24Hour={false}
                                        />
                                    )             
                                )}
                                {firstDayTimes && hasActiveDays  && (
                                    <View style={styles.copyButtonContainer}>
                                        <TouchableOpacity
                                            style={styles.copyButton}
                                            onPress={() => {
                                                const newTimetable = schoolTimetable?.map((item) => {
                                                    if (item.day !== "الجمعة" && item.day !== "السبت") {
                                                    return {
                                                        ...item,
                                                        active:true,
                                                        startTime: firstDayTimes.startTime,
                                                        endTime: firstDayTimes.endTime,
                                                    };
                                                    }
                                                    return item;
                                                });
                                                setSchoolTimetable(newTimetable);
                                            }}
                                        >
                                            <Text style={styles.copyButtonText}>نسخ لجميع الأيام</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            {addingNewLineLoading ? (
                                <View style={styles.add_new_line_button}>
                                    <ActivityIndicator size="small" color={colors.BLACK} />
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    style={styles.add_new_line_button}
                                    onPress={createNewLine}
                                    disabled={addingNewLineLoading}
                                >
                                    <Text style={styles.add_new_line_button_text}>أضف</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>                
                </View>
            </Modal>
        </View>
    )
}

export default LinesFeed

const styles = StyleSheet.create({
  loading_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  },
  modal_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_box:{
    width: '95%',
    height:650,
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  modal_header:{
    width:'100%',
    height:40,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  modal_main:{
    width:'100%',
    marginTop:10,
    justifyContent:'center',
    alignItems:'center',
  },
  modal_main_text:{
    width:300,
    lineHeight:40,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
    marginBottom:15,
  },
  add_new_line_dropdown:{
    width:260,
    height:43,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
    marginBottom:15,
  },
  add_new_line_dropdownStyle:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14,
  },
  add_new_line_dropdownTextStyle:{
    textAlign:'center',
  },
  worktimeContainer:{
    width:280,
    marginBottom:15
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: colors.DARKGRAY,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems:'center',
    justifyContent:'center'
  },
  dayRow: {
    width:260,
    height:40,
    marginBottom: 6,
    paddingHorizontal:7,
    flexDirection: "row-reverse",
    alignItems: "center", 
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
  },
  checkbox:{
    borderColor:'#777'
  },
  dayText: {
    lineHeight:40,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    flex: 1,
    fontSize: 15,
  },
  timeInput: {
    width:60,
    height:30,
    borderRadius: 5,
    backgroundColor:'#e0e0e0',
    backgroundColor:colors.BLUE
  },
  disabledInput:{
    backgroundColor:null
  },
  timeText: {
    lineHeight:30,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    fontSize: 14,
  },
  activeTimeText:{
    color:colors.WHITE
  },
  timeSeparator: {
    marginHorizontal: 5,
    fontSize: 14,
    fontWeight: "bold",
  },
  doneButton: {
    width:100,
    marginTop: 10,
    backgroundColor: colors.PRIMARY,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 5,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  copyButtonContainer:{
    alignItems:'center',
  },
  copyButton:{
    width:150,
    height:40,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  copyButtonText:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    color:colors.WHITE,
  },
  lines_container:{
    height:'100%',
    marginTop:40,
    alignItems:'center',
    justifyContent:'center',
  },
  lines_pick_type_and_add_line:{
    marginTop:45,
    marginBottom:20,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:10
  },
  dropdown:{
    width:200,
    height:40,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
  },
  dropdownStyle:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  add_new_line_button:{
    width:110,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderRadius: 15,
  },
  add_new_line_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 40,
  },
  join_this_line_button:{
    width:150,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderRadius: 15,
  },
  join_this_line_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 40,
  },
  flatList_style:{
    alignItems:'center',
    justifyContent:'center',
  },
  available_lines_flatList_style:{
    paddingBottom:50,
  },
  lines_group:{
    alignItems:'center',
  },
  lines_group_text:{
    lineHeight:40,
    marginBottom:10,
    fontSize:14,
    textAlign:'center',
    backgroundColor:colors.WHITE,
    fontFamily:'Cairo_700Bold'
  },
  line_data_box:{
    width:350,
    height:220,
    borderRadius:15,
    marginBottom:15,
    backgroundColor:colors.GRAY,
    justifyContent:'center',
    alignItems:'center',
    gap:5
  },
  line_data_box_title:{
    flexDirection:'row-reverse',
    gap:10,
  },
  line_data_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 40,
    textAlign: 'center',
  },
  line_age_data_text:{
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 40,
    textAlign: 'center',
  },
  line_startTime_container:{
    flexDirection:'row-reverse',
    marginBottom:8
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
  no_lines_under_this_type:{
    marginTop:100,
    alignItems:'center',
  },
  no_lines_under_this_type_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 45,
  },
})