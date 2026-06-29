import { useSelector, useDispatch } from 'react-redux';
import {
  addNotifications,
  clearNotifications,
  addSeenAlertId,
  addMultipleSeenAlertIds,
  setAudioEnabled,
  setBootstrapped,
  clearSeenAlertIds,
  resetNotificationState,
  filterNotificationsByValidIds, 
  cleanupSeenAlertIds,          
} from '../redux/notificationSlice';

export const useNotifications = () => {
  const dispatch = useDispatch();
  const { notifications, seenAlertIds, audioEnabled, isBootstrapped } = useSelector(
    (state) => state.notifications
  );

  return {
    // State
    notifications,
    seenAlertIds,
    audioEnabled,
    isBootstrapped,
    
    // Actions
    addNotifications: (newNotifications) => dispatch(addNotifications(newNotifications)),
    clearNotifications: () => dispatch(clearNotifications()),
    addSeenAlertId: (id) => dispatch(addSeenAlertId(id)),
    addMultipleSeenAlertIds: (ids) => dispatch(addMultipleSeenAlertIds(ids)),
    setAudioEnabled: (enabled) => dispatch(setAudioEnabled(enabled)),
    setBootstrapped: (bootstrapped) => dispatch(setBootstrapped(bootstrapped)),
    clearSeenAlertIds: () => dispatch(clearSeenAlertIds()),
    resetNotificationState: () => dispatch(resetNotificationState()),
    filterNotificationsByValidIds: (ids) => dispatch(filterNotificationsByValidIds(ids)), 
    cleanupSeenAlertIds: (ids) => dispatch(cleanupSeenAlertIds(ids)),                   
  };
};
