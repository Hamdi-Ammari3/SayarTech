import { View,Text,ActivityIndicator,StyleSheet,TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { doc, getDoc,writeBatch,arrayRemove } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import colors from '../constants/Colors'

const LineWithoutDriver = ({rider}) => {
    const [line, setLine] = useState(null)
    const [loading, setLoading] = useState(false)
    const [leavingLineLoading,setLeavingLineLoading] = useState(false)

    useEffect(() => {
        const fetchLine = async () => {
            if (!rider?.line_id) return;
            setLoading(true)
            try {
                const lineRef = doc(DB, 'lines', rider.line_id)
                const lineSnap = await getDoc(lineRef)

                if (lineSnap.exists()) {
                    setLine({ id: lineSnap.id, ...lineSnap.data() })
                }
            } catch (err) {
                console.error("Error fetching line:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchLine()
    }, [rider?.line_id])

    const leaveLineHandler = async(line) => {
        if (!rider || !line) return createAlert('المستخدم أو الخط غير معرف');

        // Only allow leaving if no driver assigned to line
        if (line.driver_id) {
            return createAlert('لا يمكن مغادرة الخط بعد تعيين سائق');
        }

        setLeavingLineLoading(true)

        try {
            const riderRef = doc(DB, 'riders', rider.id);
            const lineRef = doc(DB, 'lines', line.id);
            const userRef = doc(DB, 'users', rider.user_doc_id);

            const updatedRiders = line.riders.filter((r) => r.id !== rider.id);

            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                return createAlert('❌ تعذر العثور على حساب المستخدم.');
            }
            const userData = userSnap.data();
            const currentBalance = userData.account_balance || 0;
            const newBalance = currentBalance + rider.temporary_hold_amount;

            const batch = writeBatch(DB);

            // Step 1: Remove rider from line.riders array
            batch.update(lineRef, {
                riders: updatedRiders,
            });

            // Step 2: Reset rider's line_id and driver_id
            batch.update(riderRef, {
                line_id: null,
                driver_id: null,
                company_commission:0,
                driver_commission:0,
                temporary_hold_amount:0
            });

            // Step3: Update user account balance
            batch.update(userRef, {
                account_balance: newBalance,
            });

            await batch.commit();
            createAlert('تم مغادرة الخط بنجاح');
            
        } catch (error) {
            console.error(err);
            createAlert('حدث خطأ أثناء مغادرة الخط');
        } finally {
            setLeavingLineLoading(false)
        }
    }

    const totalSubscriptionFee = rider?.driver_commission + rider?.company_commission;
    const formattedSubscription = totalSubscriptionFee.toLocaleString('ar-IQ', {
        style: 'currency',
        currency: 'IQD',
        minimumFractionDigits: 0,
    });


    if (loading) {
        return(
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.PRIMARY} />
            </View>
        )
    }

    if (!line) {
        return (
            <View>
                <Text>لم يتم العثور على بيانات الخط.</Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={styles.line_title_box}>
                <Text style={styles.line_title}>تفاصيل الخط</Text>
            </View> 
            <View style={styles.line_text_box}>
                <Text style={styles.line_text}>الوجهة: {line.destination}</Text>
            </View>
            <View style={styles.line_text_box}>
                <Text style={styles.line_text}>نوع الخط: {line.line_type}</Text>
            </View>
            <View style={styles.line_text_box}>
                <Text style={styles.line_text}>الاشتراك الشهري: {formattedSubscription}</Text>
            </View>
            <View style={styles.line_text_box}>
                <Text style={styles.line_text}>سائق الخط: لم يتم تعيين سائق بعد</Text>
            </View>
            <View style={styles.line_button_box}>
                <TouchableOpacity 
                    style={styles.line_button} 
                    onPress={() => leaveLineHandler(line)}
                    disabled={leavingLineLoading}
                >
                    <Text style={styles.line_button_text}>{leavingLineLoading ? '...' : 'مغادرة الخط'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default LineWithoutDriver

const styles = StyleSheet.create({
    container:{
        flex:1,
        justifyContent:'center',
        alignItems:'center'
    },
    line_title_box:{
        width:300,
        height:70,
        marginBottom:20,
        justifyContent:'center',
        alignItems:'center',
    },
    line_title:{
        lineHeight:50,
        fontSize: 14,
        fontFamily: 'Cairo_700Bold',
    },
    line_text_box:{
        width:300,
        height:60,
        flexDirection:'row-reverse',
        justifyContent:'flex-start',
        alignItems:'center',
        gap:10,
        borderBottomColor:colors.GRAY,
        borderBottomWidth:1,
    },
    line_text:{
        lineHeight:50,
        fontSize: 14,
        fontFamily: 'Cairo_400Regular',
    },
    line_button_box:{
        width:300,
        height:70,
        justifyContent:'center',
        alignItems:'center',
    },
    line_button:{
        width:120,
        height:40,
        marginTop:20,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'rgba(190, 154, 78, 0.30)',
        borderColor:colors.BLACK,
        borderWidth:1,
        borderRadius: 15,
    },
    line_button_text:{
        fontSize: 14,
        fontFamily: 'Cairo_400Regular',
        lineHeight: 40,
    },
})