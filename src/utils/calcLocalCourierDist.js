import { getDistanceInKm } from "../utils/getDistanceInKm.js";

export const calcLocalCourierDist = (order, courierCoords) => {
    const restaurantCoords = order.restaurantLocation;
    const userCoords = order.userLocation;

    let courier_R_Distance = null;
    let restaurant_U_Distance = null;
    let courier_U_Distance = null;
    let total_Distance = null;

    if (restaurantCoords) {
        courier_R_Distance = Number(getDistanceInKm(
            courierCoords.latitude, courierCoords.longitude, 
            restaurantCoords.latitude, restaurantCoords.longitude
        ));
    }
    if (userCoords) {
        courier_U_Distance = Number(getDistanceInKm(
            courierCoords.latitude, courierCoords.longitude, 
            userCoords.latitude, userCoords.longitude
        ));
    }

    if (restaurantCoords && userCoords) {
        restaurant_U_Distance = Number(getDistanceInKm(
            restaurantCoords.latitude, restaurantCoords.longitude, 
            userCoords.latitude, userCoords.longitude
        ));
    }

    if (courier_R_Distance !== null && courier_U_Distance !== null) {
        // inital total distance : courier_R_Distance + restaurant_U_Distance
        const total_Distance_Calculated = courier_R_Distance + restaurant_U_Distance;
        total_Distance = total_Distance_Calculated.toFixed(2);
    } else {
        total_Distance = null;
    }

    return {
        courier_R_Distance: courier_R_Distance !== null ? courier_R_Distance.toFixed(2) : null,
        total_Distance: total_Distance,
    };
};