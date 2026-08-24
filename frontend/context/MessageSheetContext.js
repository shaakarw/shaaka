import { Alert } from 'react-native';
import AppAlert from '../utils/alert';

export const showAppAlert = (title, message, buttons, options) => {
  return AppAlert.alert(title, message, buttons, options);
};

export default { showAppAlert };
