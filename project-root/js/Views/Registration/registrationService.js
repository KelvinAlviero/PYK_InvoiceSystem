import { registerAccount } from '../../authService.js';

export function submitRegistration(registrationData) {
    const email = String(registrationData.email ?? '').trim();
    const password = String(registrationData.password ?? '');
    const role = String(registrationData.role ?? '');

    return registerAccount(email, password, role, registrationData);
}
