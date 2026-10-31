import { showGlobalBottomSheet } from '../context/BottomSheetContext';

export function showAdminFeedback(title, message, type = 'info', options = {}) {
  const isError = type === 'error';
  return showGlobalBottomSheet({
    type: isError ? 'error' : type === 'success' ? 'success' : 'info',
    title,
    message: message || '',
    icon: isError ? 'alert-circle-outline' : type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline',
    buttonText: options.buttonText || 'OK',
    buttonAction: options.buttonAction || null,
  });
}
