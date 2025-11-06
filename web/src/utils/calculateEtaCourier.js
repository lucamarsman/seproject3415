import { Timestamp } from 'firebase/firestore';
import { getDistanceInKm } from "../utils/getDistanceInKm.js";

const COURIER_SPEED_KMH = 60;

export const calculateEtaCourier = (courierLoc, userLoc, now) => {
    // 1. Calculate direct distance
    const C_U_distanceKm = getDistanceInKm(
        courierLoc.latitude, courierLoc.longitude, 
        userLoc.latitude, userLoc.longitude
    );

    // 2. Calculate travel time
    const U_travelTimeMinutes = (C_U_distanceKm / COURIER_SPEED_KMH) * 60;
    const courier_U_EtaMinutes = Math.max(1, Math.round(U_travelTimeMinutes));
    
    // 3. Calculate delivery time timestamp
    const estimatedDeliveryDate = new Date(now.getTime() + courier_U_EtaMinutes * 60000);
    const estimatedDeliveryTimeTimestamp = new Timestamp(
        Math.floor(estimatedDeliveryDate.getTime() / 1000), 
        0
    );

    return {
        courier_U_Distance: C_U_distanceKm,
        courier_U_EtaMinutes: courier_U_EtaMinutes,
        estimatedDeliveryTime: estimatedDeliveryTimeTimestamp,
    };
};