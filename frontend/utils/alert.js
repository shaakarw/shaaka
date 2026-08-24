import { Alert } from 'react-native';
import { showGlobalBottomSheet } from '../context/BottomSheetContext';

const nativeAlert = Alert.alert.bind(Alert);

const resolveSheetType = (title = '', message = '') => {
  const text = `${title} ${message}`.toLowerCase();
  if (text.includes('error') || text.includes('failed') || text.includes('denied') || text.includes('permission')) {
    return 'error';
  }
  if (text.includes('success') || text.includes('saved') || text.includes('updated') || text.includes('logged out')) {
    return 'success';
  }
  if (text.includes('login') || text.includes('sign in') || text.includes('account')) {
    return 'login';
  }
  return 'info';
};

const resolveIcon = (type) => {
  switch (type) {
    case 'login': return 'log-in-outline';
    case 'success': return 'checkmark-circle-outline';
    case 'error': return 'alert-circle-outline';
    case 'logout': return 'log-out-outline';
    default: return 'information-circle-outline';
  }
};

const AppAlert = {
  alert: (title, message, buttons, options) => {
    const normalizedButtons = Array.isArray(buttons) ? buttons : [{ text: 'OK' }];
    const primary = normalizedButtons[0] || { text: 'OK' };
    const secondary = normalizedButtons[1] || null;
    const sheetType = resolveSheetType(title, message);

    const config = {
      type: sheetType,
      title: title || 'Info',
      message: message || '',
      icon: resolveIcon(sheetType),
      buttonText: primary.text || 'OK',
      buttonAction: primary.onPress || (() => {}),
      secondaryButtonText: secondary ? secondary.text : null,
      secondaryAction: secondary ? secondary.onPress || (() => {}) : null,
      autoDismiss: 0,
    };

    if (showGlobalBottomSheet(config)) {
      return { type: 'bottom-sheet' };
    }

    return nativeAlert(title, message, buttons, options);
  },
  confirm: (title, message, buttons, options) => {
    return AppAlert.alert(title, message, buttons, options);
  },
};

Alert.alert = (title, message, buttons, options) => {
  return AppAlert.alert(title, message, buttons, options);
};

export default AppAlert;
