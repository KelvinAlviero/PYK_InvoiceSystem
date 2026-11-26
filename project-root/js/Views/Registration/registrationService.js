import { registerVendor } from '../../authService.js';

// Builds the multipart request from everything collected across the 5 steps.
export function submitRegistration(registrationData) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(registrationData)) {
        if (value instanceof File) {
            formData.append(key, value, value.name);
        } else if (value !== undefined && value !== null) {
            formData.append(key, String(value));
        }
    }

    return registerVendor(formData);
}
