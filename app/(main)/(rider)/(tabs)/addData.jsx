import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const addData = () => {
  return (
    <SafeAreaView style={styles.container}>
        <View>
            <Text>add data</Text>
        </View>
    </SafeAreaView>
  )
}

export default addData

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
})