export function coordinateFormat(locationObject) {
    if (!locationObject) return null;

    let lat = null;
    let lng = null;

    if (typeof locationObject.latitude === 'number' && typeof locationObject.longitude === 'number') {
        lat = locationObject.latitude;
        lng = locationObject.longitude;
    } 
    else if (typeof locationObject._lat === 'number' && typeof locationObject._long === 'number') {
        lat = locationObject._lat;
        lng = locationObject._long;
    }
    
    if (lat !== null && lng !== null) {
        return {
            latitude: lat,
            longitude: lng,
        };
    }

    return null;
}