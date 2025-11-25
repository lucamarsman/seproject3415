import { Timestamp } from 'firebase/firestore';
import { getDistanceInKm } from "../utils/getDistanceInKm.js";

const COURIER_SPEED_KMH = 30; 

export function calculateEtaRestaurant(locations, now, preppedDate) {
    const { courierLoc, restaurantLoc, userLoc } = locations;
    let total_Distance = null;
    
    // DISTANCE CALCULATION
    const C_R_distanceKm = getDistanceInKm(
        courierLoc.latitude, courierLoc.longitude, 
        restaurantLoc.latitude, restaurantLoc.longitude
    );
    const R_U_distanceKm = getDistanceInKm(
        restaurantLoc.latitude, restaurantLoc.longitude, 
        userLoc.latitude, userLoc.longitude
    );

    if (C_R_distanceKm !== null && R_U_distanceKm !== null) {
        const total_Distance_Calculated = C_R_distanceKm + R_U_distanceKm;
        total_Distance = total_Distance_Calculated.toFixed(2);
    } else {
        total_Distance = null;
    }

    // ETA DURATION CALCULATION
    const R_travelTimeMinutes = (C_R_distanceKm / COURIER_SPEED_KMH) * 60;
    const courier_R_EtaMinutes = Math.max(1, Math.round(R_travelTimeMinutes)); // C -> R Duration
    
    const U_travelTimeMinutes = (R_U_distanceKm / COURIER_SPEED_KMH) * 60;
    const R_U_courierTime = Math.max(1, Math.round(U_travelTimeMinutes)); // R -> U Duration
    
    // ESTIMATED PICKUP TIME (TIMESTAMP)
    const courierArrivalDate = new Date(now.getTime() + courier_R_EtaMinutes * 60000);
    const earliestPickupTime = Math.max(courierArrivalDate.getTime(), preppedDate.getTime());
    const estimatedPickUpDate = new Date(earliestPickupTime);
    
    const estimatedPickUpTimeTimestamp = Timestamp.fromDate(estimatedPickUpDate);

    // ESTIMATED DELIVERY TIME (TIMESTAMP)
    const estimatedDeliveryDate = new Date(estimatedPickUpDate.getTime() + R_U_courierTime * 60000);
    const estimatedDeliveryTimeTimestamp = Timestamp.fromDate(estimatedDeliveryDate);
    
    // Total estimated time from NOW until delivery
    const courier_U_EtaMinutes = Math.round((estimatedDeliveryDate.getTime() - now.getTime()) / 60000);

    return {
        C_R_distanceKm,
        R_U_distanceKm,
        courier_R_EtaMinutes, //
        R_U_courierTime,
        courier_U_EtaMinutes, //
        total_Distance,
        estimatedPickUpTimeTimestamp,
        estimatedDeliveryTimeTimestamp,
    };
}