// Every message the API sends to people, in Indonesian and English.
// Routes throw `new HttpError(status, 'some.key', { params })`; the error handler in
// index.js turns the key into text in the language the browser asked for
// (the X-Language header the front end sends: 'id' or 'en').
//
// Adding a message: add the key to BOTH languages. Placeholders like {field} are
// filled from the params object.

export const LANGUAGES = ['id', 'en'];
export const DEFAULT_LANGUAGE = 'id';

const messages = {
    id: {
        'error.notFound': 'Tidak ditemukan.',
        'error.server': 'Terjadi kesalahan di server.',
        'error.invalidId': 'ID tidak valid.',
        'error.invalidStatus': 'Status harus salah satu dari: {options}.',

        'auth.loginRequired': 'Silakan masuk terlebih dahulu.',
        'auth.forbidden': 'Anda tidak memiliki akses ke halaman ini.',
        'auth.emailPasswordRequired': 'Email dan kata sandi wajib diisi.',
        'auth.invalidCredentials': 'Email atau kata sandi salah.',
        'auth.deactivated': 'Akun ini telah dinonaktifkan. Hubungi administrator.',
        'auth.pendingReview': 'Pendaftaran Anda masih ditinjau. Anda dapat masuk setelah disetujui.',
        'auth.registrationRejected': 'Pendaftaran Anda ditolak. Hubungi PYK untuk informasi lebih lanjut.',
        'auth.tooManyLogins': 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.',
        'auth.tooManyRegistrations': 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.',
        'auth.registered': 'Pendaftaran terkirim. Anda dapat masuk setelah PYK menyetujui perusahaan Anda.',
        'auth.emailTaken': 'Akun dengan email ini sudah ada.',

        'validation.missingField': 'Kolom wajib belum diisi: {field}.',
        'validation.fieldTooLong': 'Isian terlalu panjang: {field}.',
        'validation.missingDocument': 'Dokumen wajib belum diunggah: {field}.',
        'validation.notPdf': '{name} bukan file PDF.',
        'validation.fileTooLarge': 'Setiap PDF maksimal 5 MB.',
        'validation.uploadRejected': 'Unggahan ditolak: {reason}',
        'validation.termsRequired': 'Anda harus menyetujui Syarat Pembayaran.',
        'validation.invalidEmails': 'Masukkan alamat email yang valid.',
        'validation.invalidEmail': 'Masukkan email yang valid.',
        'validation.passwordTooShort': 'Kata sandi minimal {min} karakter.',
        'validation.newPasswordTooShort': 'Kata sandi baru minimal {min} karakter.',
        'validation.invalidBusinessType': 'Tipe bisnis tidak valid.',
        'validation.invalidBank': 'Nama bank tidak valid.',
        'validation.chooseRegion': 'Pilih provinsi, kota, dan kelurahan dari daftar.',
        'validation.regionMismatch': 'Provinsi, kota, dan kelurahan yang dipilih tidak cocok.',
        'validation.invalidAmount': 'Jumlah harus berupa angka positif (Rupiah), contoh: 48500000.',

        'users.currentPasswordWrong': 'Kata sandi saat ini salah.',
        'users.invalidStaffRole': 'Role harus salah satu dari: {options}. Vendor mendaftar sendiri.',
        'users.isActiveRequired': 'isActive (true/false) wajib diisi.',
        'users.cannotDeactivateSelf': 'Anda tidak dapat menonaktifkan akun Anda sendiri.',
        'users.notFound': 'Pengguna tidak ditemukan.',

        'vendors.notFound': 'Vendor tidak ditemukan.',
        'vendors.rejectNoteRequired': 'Catatan alasan penolakan wajib diisi.',
        'vendors.notPending': 'Vendor ini tidak sedang menunggu review (sudah diputuskan, atau tidak ada).',

        'documents.notFound': 'Dokumen tidak ditemukan.',
        'notifications.notFound': 'Notifikasi tidak ditemukan.',

        'invoices.notFound': 'Tagihan tidak ditemukan.',
        'invoices.onlyRejectedResubmit': 'Hanya tagihan berstatus "Tidak Sesuai" yang dapat disubmit ulang.',
        'invoices.changedConcurrently': 'Tagihan ini baru saja diubah oleh orang lain. Muat ulang lalu coba lagi.',
        'invoices.invalidDecision': "Keputusan harus 'approve' atau 'reject'.",
        'invoices.rejectNoteRequired': 'Tulis catatan untuk vendor tentang apa yang perlu diperbaiki.',
        'invoices.notAwaitingVerification': 'Tagihan ini tidak sedang menunggu verifikasi (sudah diputuskan, atau tidak ada).',
        'invoices.invalidPaymentMethod': 'Metode pembayaran harus salah satu dari: {options}.',
        'invoices.invalidAccount': 'Rekening tujuan harus 1 atau 2 (rekening bank vendor).',
        'invoices.notReadyForPayment': 'Tagihan ini belum siap dibayar (belum disetujui AP, atau sudah dibayar).'
    },

    en: {
        'error.notFound': 'Not found.',
        'error.server': 'Something went wrong on the server.',
        'error.invalidId': 'Invalid id.',
        'error.invalidStatus': 'Status must be one of: {options}.',

        'auth.loginRequired': 'Please log in.',
        'auth.forbidden': 'You do not have access to this.',
        'auth.emailPasswordRequired': 'Email and password are required.',
        'auth.invalidCredentials': 'Invalid email or password.',
        'auth.deactivated': 'This account has been deactivated. Contact an administrator.',
        'auth.pendingReview': 'Your registration is still being reviewed. You can log in once it has been approved.',
        'auth.registrationRejected': 'Your registration was rejected. Contact PYK for details.',
        'auth.tooManyLogins': 'Too many login attempts. Try again in 15 minutes.',
        'auth.tooManyRegistrations': 'Too many registrations from this network. Try again later.',
        'auth.registered': 'Registration submitted. You can log in once PYK has approved your company.',
        'auth.emailTaken': 'An account with this email already exists.',

        'validation.missingField': 'Missing required field: {field}.',
        'validation.fieldTooLong': 'Field is too long: {field}.',
        'validation.missingDocument': 'Missing required document: {field}.',
        'validation.notPdf': '{name} is not a PDF file.',
        'validation.fileTooLarge': 'Each PDF must be 5 MB or smaller.',
        'validation.uploadRejected': 'Upload rejected: {reason}',
        'validation.termsRequired': 'You must accept the Terms of Payment.',
        'validation.invalidEmails': 'Please enter valid email addresses.',
        'validation.invalidEmail': 'Please enter a valid email.',
        'validation.passwordTooShort': 'Password must be at least {min} characters.',
        'validation.newPasswordTooShort': 'New password must be at least {min} characters.',
        'validation.invalidBusinessType': 'Invalid business type.',
        'validation.invalidBank': 'Invalid bank name.',
        'validation.chooseRegion': 'Please choose a province, city and village from the lists.',
        'validation.regionMismatch': 'The chosen province, city and village do not match.',
        'validation.invalidAmount': 'Amount must be a positive number (Rupiah), e.g. 48500000.',

        'users.currentPasswordWrong': 'Current password is incorrect.',
        'users.invalidStaffRole': 'Role must be one of: {options}. Vendors register themselves.',
        'users.isActiveRequired': 'isActive (true/false) is required.',
        'users.cannotDeactivateSelf': 'You cannot deactivate your own account.',
        'users.notFound': 'User not found.',

        'vendors.notFound': 'Vendor not found.',
        'vendors.rejectNoteRequired': 'A note explaining the rejection is required.',
        'vendors.notPending': 'This vendor is not pending (already decided, or does not exist).',

        'documents.notFound': 'Document not found.',
        'notifications.notFound': 'Notification not found.',

        'invoices.notFound': 'Invoice not found.',
        'invoices.onlyRejectedResubmit': 'Only invoices marked "Rejected" can be resubmitted.',
        'invoices.changedConcurrently': 'This invoice was changed by someone else. Reload and try again.',
        'invoices.invalidDecision': "Decision must be 'approve' or 'reject'.",
        'invoices.rejectNoteRequired': 'Please write a note telling the vendor what to fix.',
        'invoices.notAwaitingVerification': 'This invoice is not waiting for verification (already decided, or does not exist).',
        'invoices.invalidPaymentMethod': 'Payment method must be one of: {options}.',
        'invoices.invalidAccount': "The destination account must be 1 or 2 (the vendor's bank account).",
        'invoices.notReadyForPayment': 'This invoice is not ready for payment (not approved by AP, or already paid).'
    }
};

// Readable names for form fields that appear in "missing field" messages.
const FIELD_LABELS = {
    id: {
        email: 'Email', password: 'Kata sandi', entity: 'Entitas', vendorName: 'Nama Vendor',
        street: 'Jalan', block: 'Blok', province: 'Provinsi', cityRegency: 'Kota/Kabupaten',
        village: 'Kelurahan/Desa', phone: 'Nomor Telepon', companyNpwp: 'NPWP Perusahaan',
        companyEmail: 'Email Perusahaan', ownerName: 'Pemilik', ownerContact: 'Kontak Pemilik',
        salesPerson: 'Penanggung Jawab Sales', salesContact: 'Kontak Sales', businessType: 'Tipe Bisnis',
        bankOneName: 'Nama Bank 1', bankOneNumber: 'Nomor Rekening 1', bankOneOwner: 'Pemilik Rekening 1',
        bankTwoName: 'Nama Bank 2', bankTwoNumber: 'Nomor Rekening 2', bankTwoOwner: 'Pemilik Rekening 2',
        termsDocument: 'Dokumen Syarat Pembayaran', companyDocument: 'Dokumen Informasi Perusahaan',
        bankDocument: 'Dokumen Data Bank', extrasDocument: 'Dokumen Tambahan',
        businessLicenseDocument: 'NIB', taxDocument: 'NPWP', identityDocument: 'KTP',
        establishmentDeedDocument: 'Akta Pendirian', ministryApprovalDocument: 'SK Kemenkumham',
        branchName: 'Nama Cabang', poNumber: 'Nomor PO', invoiceNumber: 'Nomor Invoice',
        vendorNote: 'Catatan', paymentReference: 'Nomor Referensi Bank',
        purchaseOrder: 'Purchase Order (PO)', goodsReceipt: 'Goods Receipt (GR)',
        supplierInvoice: 'Invoice Supplier', deliveryNote: 'Surat Jalan', taxInvoice: 'Faktur Pajak'
    },
    en: {
        email: 'Email', password: 'Password', entity: 'Entity', vendorName: 'Vendor Name',
        street: 'Street', block: 'Block', province: 'Province', cityRegency: 'City/Regency',
        village: 'Village', phone: 'Phone Number', companyNpwp: 'Company NPWP',
        companyEmail: 'Company Email', ownerName: 'Owner', ownerContact: 'Owner Contact',
        salesPerson: 'Sales Person in Charge', salesContact: 'Sales Contact', businessType: 'Business Type',
        bankOneName: 'Bank Name 1', bankOneNumber: 'Account Number 1', bankOneOwner: 'Account Holder 1',
        bankTwoName: 'Bank Name 2', bankTwoNumber: 'Account Number 2', bankTwoOwner: 'Account Holder 2',
        termsDocument: 'Terms of Payment document', companyDocument: 'Company information document',
        bankDocument: 'Bank details document', extrasDocument: 'Additional document',
        businessLicenseDocument: 'Business License (NIB)', taxDocument: 'Tax ID (NPWP)',
        identityDocument: 'ID Card (KTP)', establishmentDeedDocument: 'Deed of Establishment',
        ministryApprovalDocument: 'Ministry Decree (SK Kemenkumham)',
        branchName: 'Branch name', poNumber: 'PO number', invoiceNumber: 'Invoice number',
        vendorNote: 'Note', paymentReference: 'Bank reference number',
        purchaseOrder: 'Purchase Order (PO)', goodsReceipt: 'Goods Receipt (GR)',
        supplierInvoice: 'Supplier Invoice', deliveryNote: 'Delivery Note (Surat Jalan)',
        taxInvoice: 'Tax Invoice (Faktur Pajak)'
    }
};

// The language a request asked for: X-Language header first, then Accept-Language.
export function requestLanguage(req) {
    const explicit = String(req.get('X-Language') ?? '').toLowerCase();
    if (LANGUAGES.includes(explicit)) {
        return explicit;
    }
    return req.acceptsLanguages(...LANGUAGES) || DEFAULT_LANGUAGE;
}

export function translate(language, key, params = {}) {
    const lang = LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
    const template = messages[lang][key] ?? messages[DEFAULT_LANGUAGE][key];
    if (!template) {
        return key; // not a known key: an already-written message, pass it through
    }
    return template.replace(/\{(\w+)\}/g, (match, name) => {
        if (!(name in params)) {
            return match;
        }
        const value = String(params[name]);
        return name === 'field' ? (FIELD_LABELS[lang][value] ?? value) : value;
    });
}

// For checks: keys present in one language but not the other.
export function missingTranslations() {
    return {
        missingInEnglish: Object.keys(messages.id).filter((key) => !(key in messages.en)),
        missingInIndonesian: Object.keys(messages.en).filter((key) => !(key in messages.id))
    };
}
