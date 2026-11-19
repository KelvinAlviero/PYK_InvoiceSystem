export const registrationSteps = [
    {
        title: 'Terms of service',
        fields: `
            <div class="login-field">
                <label for="register-email">Email</label>
                <input id="register-email" name="email" type="email" autocomplete="username" required>
            </div>
            <div class="login-field">
                <label for="register-password">Password</label>
                <input id="register-password" name="password" type="password" autocomplete="new-password" required>
            </div>
            <div class="login-field">
                <label for="register-role">Role</label>
                <select id="register-role" name="role" required>
                    <option value="" selected disabled>Choose a role</option>
                    <option value="User">User</option>
                    <option value="Verification">Verification</option>
                    <option value="Treasury">Treasury</option>
                    <option value="Admin">Admin</option>
                </select>
            </div>
            <div class="login-field">
                <label for="terms-document">Terms document (PDF)</label>
                <input id="terms-document" name="termsDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
            <label class="login-checkbox">
                <input name="termsAccepted" type="checkbox" required>
                I agree to the terms of service
            </label>
        `
    },
    {
        title: 'Company information',
        fields: `
            <div class="login-field">
                <label for="company-name">Company name</label>
                <input id="company-name" name="companyName" type="text" required>
            </div>
            <div class="login-field">
                <label for="company-location">Location</label>
                <input id="company-location" name="companyLocation" type="text" required>
            </div>
            <div class="login-field">
                <label for="company-district">District</label>
                <select id="company-district" name="companyDistrict" required>
                    <option value="" selected disabled>Choose a district</option>
                    <option value="District 1">District 1</option>
                    <option value="District 2">District 2</option>
                </select>
            </div>
            <div class="login-field">
                <label for="company-document">Company document (PDF)</label>
                <input id="company-document" name="companyDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
        `
    },
    {
        title: 'Bank information',
        fields: `
            <div class="login-field">
                <label for="bank-name">Bank name</label>
                <input id="bank-name" name="bankName" type="text" required>
            </div>
            <div class="login-field">
                <label for="bank-account-name">Account holder name</label>
                <input id="bank-account-name" name="bankAccountName" type="text" required>
            </div>
            <div class="login-field">
                <label for="bank-account-number">Account number</label>
                <input id="bank-account-number" name="bankAccountNumber" type="text" required>
            </div>
            <div class="login-field">
                <label for="bank-document">Bank document (PDF)</label>
                <input id="bank-document" name="bankDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
        `
    },
    {
        title: 'Business information',
        fields: `
            <div class="login-field">
                <label for="business-type">Business type</label>
                <select id="business-type" name="businessType" required>
                    <option value="" selected disabled>Choose a business</option>
                    <option value="Business 1">Business 1</option>
                    <option value="Business 2">Business 2</option>
                </select>
            </div>
            <div class="login-field">
                <label for="business-description">Additional information</label>
                <textarea id="business-description" name="businessDescription" rows="3" required></textarea>
            </div>
            <div class="login-field">
                <label for="business-document">Business document (PDF)</label>
                <input id="business-document" name="businessDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
        `
    },
    {
        title: 'Business details',
        fields: (registrationData) => registrationData.businessType === 'Business 2'
            ? `
                <div class="login-field">
                    <label for="business-two-option">Business 2 option</label>
                    <select id="business-two-option" name="businessTwoOption" required>
                        <option value="" selected disabled>Choose an option</option>
                        <option value="Option 1">Option 1</option>
                        <option value="Option 2">Option 2</option>
                    </select>
                </div>
            `
            : `
                <div class="login-field">
                    <label for="business-one-document">Business 1 document (PDF)</label>
                    <input id="business-one-document" name="businessOneDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
            `
    }
];
