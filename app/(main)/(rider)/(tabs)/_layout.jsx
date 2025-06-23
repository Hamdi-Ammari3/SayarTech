import { Tabs } from 'expo-router'
import colors from '../../../../constants/Colors'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import Entypo from '@expo/vector-icons/Entypo'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const TabsLayout = () => {
  return (
    <Tabs screenOptions={{
      tabBarShowLabel:true,
      tabBarLabelStyle: {
        fontSize: 12,
        fontFamily: 'Cairo_400Regular',
        height: 20,
        lineHeight: 20,
      },
      tabBarStyle: { 
        height: 60,
        justifyContent: 'space-around',
        alignItems: 'center',
        borderColor: '#dddd',
      },
      tabBarActiveTintColor:colors.BLACK,
      tabBarInactiveTintColor:'#CCC',
    }}>
        {/* 🟪 Section Profile */}
        <Tabs.Screen 
          name='profile' 
          options={{
            headerShown:false,
            title: 'حسابي',
            tabBarIcon:({color}) => (<FontAwesome5 name="user-alt" size={20} color={color}/>)
          }}
        />

        {/* 🟦 Section Daily Trips */}
        <Tabs.Screen 
          name='(dailyTrips)' 
          options={{
            headerShown:false,
            title: 'بين المدن',
            tabBarIcon:({color}) => (<FontAwesome6 name="location-dot" size={22} color={color} />)
          }}
        />

        {/* 🟨 Section Lines */}
        <Tabs.Screen 
          name='lines'
          options={{
            headerShown:false,
            title: 'خطوطي',
            tabBarIcon:({color}) => (<MaterialCommunityIcons name="bus-school" size={30} color={color}/>)
          }}
        />  

        {/* 🟩 Section Home Page */}
        <Tabs.Screen 
          name='home'
          options={{
            headerShown:false,
            title: 'الرئيسية',
            tabBarIcon:({color}) => (<Entypo name="home" size={21} color={color} />)
          }}
        />
    </Tabs>
  )
}
export default TabsLayout