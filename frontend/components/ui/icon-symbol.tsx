// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'react-native';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], { icon: string; family: 'material' | 'fontawesome5' | 'fontawesome6' }>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons or FontAwesome5 mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see FontAwesome5 in the [FontAwesome Icon Directory](https://fontawesome.com/icons).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': { icon: 'home', family: 'material' },
  'paperplane.fill': { icon: 'send', family: 'material' },
  'chevron.left.forwardslash.chevron.right': { icon: 'code', family: 'material' },
  'chevron.right': { icon: 'chevron-right', family: 'material' },
  'chevron.left': { icon: 'chevron-left', family: 'material' },
  'water.drop.fill': { icon: 'water-drop', family: 'material' },
  'temperature.low.fill': { icon: 'temperature-low', family: 'fontawesome5' },
  'oxygen.fill': { icon: 'arrow-up-from-water-pump', family: 'fontawesome6' },
  'fish.fill': { icon: 'fish', family: 'fontawesome5' },
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, Material Icons or FontAwesome5 on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons or FontAwesome5.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  imageSource,
}: {
  name?: IconSymbolName;
  size?: number;
  color?: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  imageSource?: any;
  weight?: SymbolWeight;
}) {
  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={{ width: size, height: size, ...(style as any) }}
      />
    );
  }

  if (!name) {
    return null;
  }

  const iconConfig = MAPPING[name];
  
  if (!iconConfig) {
    console.warn(`Icon mapping not found for: ${name}`);
    return <MaterialIcons color={color} size={size} name="help" style={style} />;
  }
  
  if (iconConfig.family === 'fontawesome6') {
    return <FontAwesome6 color={color} size={size} name={iconConfig.icon} style={style} />;
  }
  
  if (iconConfig.family === 'fontawesome5') {
    return <FontAwesome5 color={color} size={size} name={iconConfig.icon} style={style} />;
  }
  
  return <MaterialIcons color={color} size={size} name={iconConfig.icon} style={style} />;
}
