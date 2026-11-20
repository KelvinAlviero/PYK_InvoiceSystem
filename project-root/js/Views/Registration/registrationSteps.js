function getSubmissionDate() {
    return new Date().toISOString().slice(0, 10);
}

export const registrationSteps = [
    {
        title: 'Terms of Payment',
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
                <label for="terms-document">Terms of Payment document (PDF)</label>
                <input id="terms-document" name="termsDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
            <label class="login-checkbox">
                <input name="termsAccepted" type="checkbox" required>
                I agree to the Terms of Payment
            </label>
        `
    },
    {
        title: 'Informasi Perusahaan',
        fields: `
            <div class="login-field">
                <label for="company-entity">Entitas</label>
                <input id="company-entity" name="entity" type="text" required>
            </div>
            <div class="login-field">
                <label for="submission-date">Tanggal Pengajuan</label>
                <input id="submission-date" name="submissionDate" type="date" value="${getSubmissionDate()}" readonly required>
            </div>
            <div class="login-field">
                <label for="vendor-name">Nama Vendor</label>
                <input id="vendor-name" name="vendorName" type="text" required>
            </div>
            <div class="login-field">
                <label for="company-street">Jalan</label>
                <input id="company-street" name="street" type="text" required>
            </div>
            <div class="login-field">
                <label for="company-block">Blok</label>
                <input id="company-block" name="block" type="text" required>
            </div>
            <div class="login-field">
                <label for="company-province">Provinsi</label>
                <select id="company-province" name="province" required>
                    <option value="" selected disabled>Choose a province</option>
                    <option value="Jawa Barat">Jawa Barat</option>
                    <option value="Jawa Tengah">Jawa Tengah</option>
                </select>
            </div>
            <div class="login-field">
                <label for="company-city">Kota/Kabupaten</label>
                <select id="company-city" name="cityRegency" required disabled>
                    <option value="" selected disabled>Choose a city/regency</option>
                </select>
            </div>
            <div class="login-field">
                <label for="company-village">Kelurahan/Desa</label>
                <select id="company-village" name="village" required disabled>
                    <option value="" selected disabled>Choose a village</option>
                </select>
            </div>
            <div class="login-field">
                <label for="company-phone">Nomor Telepon</label>
                <input id="company-phone" name="phone" type="tel" required>
            </div>
            <div class="login-field">
                <label for="company-npwp">NPWP Perusahaan</label>
                <input id="company-npwp" name="companyNpwp" type="text" required>
            </div>
            <div class="login-field">
                <label for="company-email">Surel (Email)</label>
                <input id="company-email" name="companyEmail" type="email" required>
            </div>
            <div class="login-field">
                <label for="company-document">Informasi perusahaan (PDF)</label>
                <input id="company-document" name="companyDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
        `
    },
    {
        title: 'Data Bank',
        fields: `
            <fieldset class="login-fieldset">
                <legend>Data bank 1</legend>
                <div class="login-field">
                    <label for="bank-one-name">Nama Bank</label>
                    <select id="bank-one-name" name="bankOneName" required>
                        <option value="" selected disabled>Choose a bank</option>
                        <option value="BCA">BCA</option>
                        <option value="BRI">BRI</option>
                        <option value="BNI">BNI</option>
                        <option value="Mandiri">Mandiri</option>
                    </select>
                </div>
                <div class="login-field">
                    <label for="bank-one-number">Nomor Rekening</label>
                    <input id="bank-one-number" name="bankOneNumber" type="text" required>
                </div>
                <div class="login-field">
                    <label for="bank-one-owner">Nama Pemilik Bank</label>
                    <input id="bank-one-owner" name="bankOneOwner" type="text" required>
                </div>
            </fieldset>
            <fieldset class="login-fieldset">
                <legend>Data bank 2</legend>
                <div class="login-field">
                    <label for="bank-two-name">Nama Bank</label>
                    <select id="bank-two-name" name="bankTwoName" required>
                        <option value="" selected disabled>Choose a bank</option>
                        <option value="BCA">BCA</option>
                        <option value="BRI">BRI</option>
                        <option value="BNI">BNI</option>
                        <option value="Mandiri">Mandiri</option>
                    </select>
                </div>
                <div class="login-field">
                    <label for="bank-two-number">Nomor Rekening</label>
                    <input id="bank-two-number" name="bankTwoNumber" type="text" required>
                </div>
                <div class="login-field">
                    <label for="bank-two-owner">Nama Pemilik Bank</label>
                    <input id="bank-two-owner" name="bankTwoOwner" type="text" required>
                </div>
            </fieldset>
            <div class="login-field">
                <label for="bank-document">Data bank (PDF)</label>
                <input id="bank-document" name="bankDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
        `
    },
    {
        title: 'Extras',
        fields: `
            <div class="login-field">
                <label for="owner-name">Pemilik</label>
                <input id="owner-name" name="ownerName" type="text" required>
            </div>
            <div class="login-field">
                <label for="owner-contact">Kontak Pemilik</label>
                <input id="owner-contact" name="ownerContact" type="tel" required>
            </div>
            <div class="login-field">
                <label for="sales-person">Penanggung Jawab Sales</label>
                <input id="sales-person" name="salesPerson" type="text" required>
            </div>
            <div class="login-field">
                <label for="sales-contact">Kontak Sales</label>
                <input id="sales-contact" name="salesContact" type="tel" required>
            </div>
            <div class="login-field">
                <label for="business-type">Tipe Bisnis</label>
                <select id="business-type" name="businessType" required>
                    <option value="" selected disabled>Choose a business type</option>
                    <option value="Usaha Berbadan Hukum">Usaha Berbadan Hukum</option>
                    <option value="Usaha Perseorangan">Usaha Perseorangan</option>
                </select>
            </div>
            <div class="login-field">
                <label for="extras-document">Dokumen tambahan (PDF)</label>
                <input id="extras-document" name="extrasDocument" type="file" accept=".pdf,application/pdf" required>
            </div>
        `
    },
    {
        title: 'Business documents',
        fields: (registrationData) => registrationData.businessType === 'Usaha Perseorangan'
            ? `
                <div class="login-field">
                    <label for="sole-nib">Nomor Induk Berusaha (NIB) (PDF)</label>
                    <input id="sole-nib" name="businessLicenseDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
                <div class="login-field">
                    <label for="sole-npwp">Nomor Pokok Wajib Pajak (PDF)</label>
                    <input id="sole-npwp" name="taxDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
                <div class="login-field">
                    <label for="sole-ktp">Kartu Tanda Penduduk (Pemilik) (PDF)</label>
                    <input id="sole-ktp" name="identityDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
            `
            : `
                <div class="login-field">
                    <label for="legal-nib">Nomor Induk Berusaha (NIB) (PDF)</label>
                    <input id="legal-nib" name="businessLicenseDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
                <div class="login-field">
                    <label for="legal-npwp">Nomor Pokok Wajib Pajak (PDF)</label>
                    <input id="legal-npwp" name="taxDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
                <div class="login-field">
                    <label for="legal-ktp">Kartu Tanda Penduduk (Direktur) (PDF)</label>
                    <input id="legal-ktp" name="identityDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
                <div class="login-field">
                    <label for="deed-document">Akta Pendirian (PDF)</label>
                    <input id="deed-document" name="establishmentDeedDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
                <div class="login-field">
                    <label for="ministry-document">SK Kemenkumham (PDF)</label>
                    <input id="ministry-document" name="ministryApprovalDocument" type="file" accept=".pdf,application/pdf" required>
                </div>
            `
    }
];
