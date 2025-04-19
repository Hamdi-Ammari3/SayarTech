import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const lines = () => {
  return (
    <SafeAreaView style={styles.container}>
        <View>
            <Text>Lines</Text>
        </View>
    </SafeAreaView>
  )
}

export default lines

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
})